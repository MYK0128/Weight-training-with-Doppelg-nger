// ユーザー登録・ログインと、Cookieで使うセッションを管理する。
package main

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/scrypt"
)

const sessionCookie = "muscle_quest_session"

type user struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func randomHex(size int) string {
	buffer := make([]byte, size)
	rand.Read(buffer)
	return hex.EncodeToString(buffer)
}

// Node's previous scrypt implementation used the printable hex salt as the input.
func deriveKey(password, salt string) ([]byte, error) {
	return scrypt.Key([]byte(password), []byte(salt), 16384, 8, 1, 64)
}

func hashPassword(password string) (string, error) {
	salt := randomHex(16)
	key, err := deriveKey(password, salt)
	return salt + ":" + hex.EncodeToString(key), err
}

func verifyPassword(password, stored string) bool {
	salt, encoded, ok := strings.Cut(stored, ":")
	key, err := hex.DecodeString(encoded)
	if !ok || err != nil || len(salt) != 32 || len(key) != 64 {
		return false
	}
	candidate, err := deriveKey(password, salt)
	return err == nil && subtle.ConstantTimeCompare(key, candidate) == 1
}

func validCredentials(c credentials) bool {
	address, err := mail.ParseAddress(c.Email)
	return err == nil && address.Address == c.Email && len(c.Email) <= 254 &&
		utf8.RuneCountInString(c.Password) >= 8 && len(c.Password) <= 1024
}

type session struct {
	token   string
	expires time.Time
}

func newSession() session {
	return session{randomHex(32), time.Now().UTC().Add(30 * 24 * time.Hour)}
}

func (a *application) setCookie(w http.ResponseWriter, s session, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: s.token, Path: "/", Expires: s.expires, MaxAge: maxAge,
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: a.secureCookies,
	})
}

func (a *application) authenticated(next func(http.ResponseWriter, *http.Request, user)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookie)
		if err != nil {
			problem(w, http.StatusUnauthorized, "ログインが必要です。")
			return
		}
		var u user
		err = a.db.QueryRowContext(r.Context(), `SELECT u.id, u.email, u.name
			FROM Session s JOIN "User" u ON u.id = s.userId WHERE s.token = ? AND s.expiresAt > ?`,
			cookie.Value, time.Now().UnixMilli()).Scan(&u.ID, &u.Email, &u.Name)
		if errors.Is(err, sql.ErrNoRows) {
			problem(w, http.StatusUnauthorized, "ログインが必要です。")
		} else if err != nil {
			fail(w, err)
		} else {
			next(w, r, u)
		}
	}
}

func (a *application) register(w http.ResponseWriter, r *http.Request) {
	var c struct {
		credentials
		bodyProfileInput
	}
	if !decode(w, r, &c) {
		return
	}
	c.Name, c.Email = strings.TrimSpace(c.Name), strings.TrimSpace(c.Email)
	if !validCredentials(c.credentials) || utf8.RuneCountInString(c.Name) < 2 || len(c.Name) > 240 {
		problem(w, http.StatusBadRequest, "表示名、メールアドレス、8文字以上のパスワードを確認してください。")
		return
	}
	if !c.bodyProfileInput.valid() {
		problem(w, http.StatusBadRequest, "身長・体重・体脂肪率を確認してください。")
		return
	}
	hash, err := hashPassword(c.Password)
	if err != nil {
		fail(w, err)
		return
	}
	u, s, now := user{randomHex(16), c.Email, c.Name}, newSession(), time.Now().UnixMilli()
	ctx := r.Context()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `INSERT INTO "User"(id,email,name,passwordHash,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`,
		u.ID, u.Email, u.Name, hash, now, now)
	if err != nil {
		var sqliteErr sqlite3.Error
		if errors.As(err, &sqliteErr) && sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
			problem(w, http.StatusConflict, "このメールアドレスはすでに登録されています。")
		} else {
			fail(w, err)
		}
		return
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO BodyProfile(userId,heightCm,weightKg,bodyFatRate,updatedAt) VALUES (?,?,?,?,?)`,
		u.ID, c.HeightCm.value, c.WeightKg.value, c.BodyFatRate.value, now)
	if err != nil {
		fail(w, err)
		return
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO Session(id,token,userId,createdAt,expiresAt) VALUES (?,?,?,?,?)`,
		randomHex(16), s.token, u.ID, now, s.expires.UnixMilli())
	if err != nil {
		fail(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, err)
		return
	}
	a.setCookie(w, s, 0)
	respond(w, http.StatusOK, map[string]any{"ok": true, "user": u})
}

func (a *application) login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	c.Email = strings.TrimSpace(c.Email)
	if !validCredentials(c) {
		problem(w, http.StatusBadRequest, "メールアドレスまたはパスワードが正しくありません。")
		return
	}
	var u user
	var hash string
	ctx := r.Context()
	err := a.db.QueryRowContext(ctx, `SELECT id,email,name,passwordHash FROM "User" WHERE email = ?`, c.Email).
		Scan(&u.ID, &u.Email, &u.Name, &hash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		fail(w, err)
		return
	}
	if errors.Is(err, sql.ErrNoRows) || !verifyPassword(c.Password, hash) {
		problem(w, http.StatusUnauthorized, "メールアドレスまたはパスワードが正しくありません。")
		return
	}
	s := newSession()
	_, err = a.db.ExecContext(ctx, `INSERT INTO Session(id,token,userId,createdAt,expiresAt) VALUES (?,?,?,?,?)`,
		randomHex(16), s.token, u.ID, time.Now().UnixMilli(), s.expires.UnixMilli())
	if err != nil {
		fail(w, err)
		return
	}
	a.setCookie(w, s, 0)
	respond(w, http.StatusOK, map[string]any{"ok": true, "user": u})
}

func (a *application) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		if _, err := a.db.ExecContext(r.Context(), "DELETE FROM Session WHERE token = ?", cookie.Value); err != nil {
			fail(w, err)
			return
		}
	}
	a.setCookie(w, session{expires: time.Unix(0, 0)}, -1)
	respond(w, http.StatusOK, map[string]bool{"ok": true})
}
