// SQLiteを初期化し、Go APIのルーティングとHTTPサーバーを設定する。
package main

import (
	"database/sql"
	_ "embed"
	"flag"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"
)

//go:embed schema.sql
var schema string

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func openDatabase(path string) (*sql.DB, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	dsn := (&url.URL{Scheme: "file", Path: absolute, RawQuery: "_busy_timeout=5000&_foreign_keys=on"}).String()
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func main() {
	seed := flag.Bool("seed", false, "create the optional demo account and sample data, then exit")
	flag.Parse()
	db, err := openDatabase(env("MUSCLE_DB_PATH", "prisma/dev.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	app := &application{db: db, secureCookies: os.Getenv("MUSCLE_SECURE_COOKIES") == "true"}
	if *seed {
		if err := app.seedDemo(); err != nil {
			log.Fatal(err)
		}
		log.Print("Demo account ready (existing accounts are not changed).")
		return
	}
	server := &http.Server{
		Addr: env("MUSCLE_API_ADDR", "127.0.0.1:8080"), Handler: app.routes(),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second,
	}
	log.Printf("Muscle Quest API listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

type application struct {
	db            *sql.DB
	secureCookies bool
}

func (a *application) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := a.db.PingContext(r.Context()); err != nil {
			fail(w, err)
			return
		}
		respond(w, http.StatusOK, map[string]bool{"ok": true})
	})
	mux.HandleFunc("POST /api/auth/register", a.register)
	mux.HandleFunc("POST /api/auth/login", a.login)
	mux.HandleFunc("POST /api/auth/logout", a.logout)
	mux.HandleFunc("GET /api/auth/me", a.authenticated(func(w http.ResponseWriter, _ *http.Request, u user) {
		respond(w, http.StatusOK, u)
	}))
	mux.HandleFunc("POST /api/workouts", a.authenticated(a.saveWorkout))
	mux.HandleFunc("POST /api/body-metrics", a.authenticated(a.saveBodyMetric))
	mux.HandleFunc("GET /api/body-profile", a.authenticated(a.getBodyProfile))
	mux.HandleFunc("PUT /api/body-profile", a.authenticated(a.saveBodyProfile))
	mux.HandleFunc("GET /api/body-goal", a.authenticated(a.getBodyGoal))
	mux.HandleFunc("PUT /api/body-goal", a.authenticated(a.saveBodyGoal))
	mux.HandleFunc("GET /api/dashboard", a.authenticated(a.dashboard))
	mux.HandleFunc("GET /api/weekly-plan", a.authenticated(a.getPlan))
	mux.HandleFunc("PUT /api/weekly-plan", a.authenticated(a.savePlan))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The browser uses Next's same-origin proxy; other sites cannot submit writes.
		site := r.Header.Get("Sec-Fetch-Site")
		if r.Method != http.MethodGet && r.Method != http.MethodHead && (site == "cross-site" || site == "same-site") {
			problem(w, http.StatusForbidden, "この送信元からの操作は許可されていません。")
			return
		}
		mux.ServeHTTP(w, r)
	})
}
