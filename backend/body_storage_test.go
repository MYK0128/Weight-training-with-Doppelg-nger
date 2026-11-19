package main

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRegistrationRollbackIncludesProfileAndSession(t *testing.T) {
	for _, table := range []string{"BodyProfile", "Session"} {
		t.Run(table, func(t *testing.T) {
			a := testApplication(t)
			if _, err := a.db.Exec(`CREATE TRIGGER registration_failure BEFORE INSERT ON ` + table + ` BEGIN SELECT RAISE(ABORT,'test registration failure'); END`); err != nil {
				t.Fatal(err)
			}
			response := request(t, a.routes(), "POST", "/api/auth/register",
				`{"name":"Body User","email":"body@example.com","password":"test-password","heightCm":174,"weightKg":68.4}`, nil, 500)
			if len(response.Result().Cookies()) != 0 {
				t.Fatal("failed registration issued cookie")
			}
			for _, table := range []string{"User", "Session", "BodyProfile", "BodyMetric"} {
				var count int
				if err := a.db.QueryRow(`SELECT COUNT(*) FROM "` + table + `"`).Scan(&count); err != nil || count != 0 {
					t.Fatalf("partial registration in %s: %d %v", table, count, err)
				}
			}
		})
	}
}

func TestBodyTablesForeignKeysAndSingleRowPerUser(t *testing.T) {
	a := testApplication(t)
	cookie := registerBodyUser(t, a, "body@example.com")
	var owner user
	readJSON(t, request(t, a.routes(), "GET", "/api/auth/me", "", cookie, 200), &owner)
	request(t, a.routes(), "PUT", "/api/body-goal", `{"targetWeightKg":65,"targetBodyFatRate":18,"trainingDays":2,"equipment":"gym"}`, cookie, 200)
	for _, statement := range []string{
		`INSERT INTO BodyProfile VALUES (?,174,68.4,22,0)`,
		`INSERT INTO BodyGoal VALUES (?,65,18,2,'gym',0)`,
	} {
		if _, err := a.db.Exec(statement, "missing-user"); err == nil {
			t.Fatalf("missing foreign key enforcement: %s", statement)
		}
		if _, err := a.db.Exec(statement, owner.ID); err == nil {
			t.Fatalf("missing user primary key enforcement: %s", statement)
		}
	}
	if _, err := a.db.Exec(`DELETE FROM "User" WHERE id=?`, owner.ID); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"BodyProfile", "BodyGoal"} {
		var count int
		if err := a.db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&count); err != nil || count != 0 {
			t.Fatalf("orphaned %s rows: %d %v", table, count, err)
		}
	}
}

func TestBodyTablesAdditiveMigrationAndPersistence(t *testing.T) {
	// Build an old-format database entirely in the test's temporary directory.
	path := filepath.Join(t.TempDir(), "legacy.db")
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(`
		CREATE TABLE "User" (id TEXT PRIMARY KEY NOT NULL,email TEXT NOT NULL,name TEXT NOT NULL,
			passwordHash TEXT NOT NULL,createdAt DATETIME NOT NULL,updatedAt DATETIME NOT NULL);
		CREATE TABLE Session (id TEXT PRIMARY KEY NOT NULL,token TEXT NOT NULL,userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
			createdAt DATETIME NOT NULL,expiresAt DATETIME NOT NULL);
		CREATE TABLE BodyMetric (id TEXT PRIMARY KEY NOT NULL,userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
			date DATETIME NOT NULL,weightKg REAL NOT NULL,bodyFatRate REAL,muscleMassKg REAL,chestCm REAL,armCm REAL,legCm REAL,createdAt DATETIME NOT NULL);
		INSERT INTO "User" VALUES ('legacy','legacy@example.com','Legacy','untouched-hash',123,456);`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO Session VALUES ('sid','legacy-token','legacy',123,?)`, time.Now().Add(time.Hour).UnixMilli()); err != nil {
		t.Fatal(err)
	}
	day, err := time.Parse(dateFormat, "2026-11-12")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO BodyMetric(id,userId,date,weightKg,bodyFatRate,createdAt) VALUES ('metric','legacy',?,73,20,123)`, day.UnixMilli()); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	db, err = openDatabase(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	a := &application{db: db}
	cookie := &http.Cookie{Name: sessionCookie, Value: "legacy-token"}
	assertJSON(t, request(t, a.routes(), "GET", "/api/body-profile", "", cookie, 200).Body.Bytes(),
		`{"heightCm":null,"weightKg":null,"bodyFatRate":null,"latestMetric":{"weightKg":73,"bodyFatRate":20,"date":"2026-11-12"}}`)
	assertJSON(t, request(t, a.routes(), "GET", "/api/body-goal", "", cookie, 200).Body.Bytes(), `{"goal":null}`)
	request(t, a.routes(), "PUT", "/api/body-profile", `{"heightCm":175,"weightKg":72,"bodyFatRate":21}`, cookie, 200)
	request(t, a.routes(), "PUT", "/api/body-goal", `{"targetWeightKg":65,"targetBodyFatRate":18,"trainingDays":3,"equipment":"dumbbells"}`, cookie, 200)
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	db, err = openDatabase(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	a.db = db
	assertJSON(t, request(t, a.routes(), "GET", "/api/body-profile", "", cookie, 200).Body.Bytes(),
		`{"heightCm":175,"weightKg":72,"bodyFatRate":21,"latestMetric":{"weightKg":73,"bodyFatRate":20,"date":"2026-11-12"}}`)
	assertJSON(t, request(t, a.routes(), "GET", "/api/body-goal", "", cookie, 200).Body.Bytes(),
		`{"goal":{"targetWeightKg":65,"targetBodyFatRate":18,"trainingDays":3,"equipment":"dumbbells"}}`)
	var hash string
	var created, updated int64
	if err := db.QueryRow(`SELECT passwordHash,CAST(createdAt AS INTEGER),CAST(updatedAt AS INTEGER) FROM "User" WHERE id='legacy'`).Scan(&hash, &created, &updated); err != nil || hash != "untouched-hash" || created != 123 || updated != 456 {
		t.Fatalf("legacy user changed: %s %d %d %v", hash, created, updated, err)
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM BodyMetric`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("legacy metrics changed: %d %v", count, err)
	}
}

func TestBodyWritesRejectCrossSiteAndNonJSON(t *testing.T) {
	a := testApplication(t)
	cookie := registerBodyUser(t, a, "body@example.com")
	for path, body := range map[string]string{
		"/api/body-profile": `{"heightCm":180,"weightKg":75}`,
		"/api/body-goal":    `{"targetWeightKg":65,"targetBodyFatRate":18,"trainingDays":2,"equipment":"gym"}`,
	} {
		for _, site := range []string{"cross-site", "same-site"} {
			r := httptest.NewRequest("PUT", path, strings.NewReader(body))
			r.AddCookie(cookie)
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Sec-Fetch-Site", site)
			w := httptest.NewRecorder()
			a.routes().ServeHTTP(w, r)
			if w.Code != 403 {
				t.Fatalf("%s %s write status=%d", path, site, w.Code)
			}
		}
		r := httptest.NewRequest("PUT", path, strings.NewReader(body))
		r.AddCookie(cookie)
		r.Header.Set("Content-Type", "text/plain")
		w := httptest.NewRecorder()
		a.routes().ServeHTTP(w, r)
		if w.Code != 415 {
			t.Fatalf("%s non-JSON status=%d", path, w.Code)
		}
		request(t, a.routes(), "PUT", path, body+` {}`, cookie, 400)
	}
	assertJSON(t, request(t, a.routes(), "GET", "/api/body-profile", "", cookie, 200).Body.Bytes(),
		`{"heightCm":174,"weightKg":68.4,"bodyFatRate":22,"latestMetric":null}`)
	assertJSON(t, request(t, a.routes(), "GET", "/api/body-goal", "", cookie, 200).Body.Bytes(), `{"goal":null}`)
}
