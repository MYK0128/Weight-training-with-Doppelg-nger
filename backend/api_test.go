// 一時SQLiteで認証・保存・既存データとの互換性を検証する。
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func testApplication(t *testing.T) *application {
	t.Helper()
	db, err := openDatabase(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return &application{db: db}
}

func request(t *testing.T, handler http.Handler, method, path, body string, cookie *http.Cookie, status int) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != status {
		t.Fatalf("%s %s: got %d, want %d: %s", method, path, w.Code, status, w.Body)
	}
	return w
}

func readJSON(t *testing.T, w *httptest.ResponseRecorder, data any) {
	t.Helper()
	if err := json.Unmarshal(w.Body.Bytes(), data); err != nil {
		t.Fatal(err)
	}
}

func TestRecordAndPlanLifecycle(t *testing.T) {
	a := testApplication(t)
	api := a.routes()
	request(t, api, "GET", "/api/weekly-plan", "", nil, 401)
	first := request(t, api, "POST", "/api/auth/register",
		`{"name":"First","email":"first@example.com","password":"a-good-test-password"}`, nil, 200).Result().Cookies()[0]
	second := request(t, api, "POST", "/api/auth/register",
		`{"name":"Second","email":"second@example.com","password":"another-test-password"}`, nil, 200).Result().Cookies()[0]
	if !first.HttpOnly || first.SameSite != http.SameSiteLaxMode || first.Path != "/" {
		t.Fatal("session cookie flags are not set")
	}
	request(t, api, "POST", "/api/auth/register",
		`{"name":"First","email":"first@example.com","password":"a-good-test-password"}`, nil, 409)
	request(t, api, "POST", "/api/workouts",
		`{"date":"2026-11-12","exerciseId":"squat","exerciseName":"Free text","bodyPart":"CHEST","weightKg":"60","reps":"8","sets":"3"}`, first, 200)
	request(t, api, "POST", "/api/workouts",
		`{"date":"2026-11-12","exerciseId":"unknown","weightKg":60,"reps":8,"sets":3}`, first, 400)
	request(t, api, "POST", "/api/body-metrics",
		`{"date":"2026-11-12","weightKg":"70","muscleMassKg":"52.5","bodyFatRate":""}`, first, 200)
	request(t, api, "POST", "/api/body-metrics", `{"date":"2026-02-31","weightKg":70}`, first, 400)
	request(t, api, "PUT", "/api/weekly-plan", `{"days":[null,[],[],[],[],[],[]],"months":3}`, first, 400)
	request(t, api, "PUT", "/api/weekly-plan",
		`{"days":[[{"name":"Unregistered","part":"legs","sets":3}],[],[],[],[],[],[]],"months":12}`, first, 400)
	request(t, api, "PUT", "/api/weekly-plan",
		`{"days":[[{"exerciseId":"squat","name":"Free text","part":"chest","sets":3,"reps":10}],[],[],[],[],[],[]],"months":12,"currentMassKg":52.5,"paceKg":0.2,"referenceReps":60}`, first, 200)
	request(t, api, "PUT", "/api/weekly-plan",
		`{"days":[[{"exerciseId":"squat","sets":3,"reps":0}],[],[],[],[],[],[]],"months":12}`, first, 400)
	request(t, api, "PUT", "/api/weekly-plan",
		`{"days":[[],[],[],[],[],[],[]],"months":12,"referenceReps":0}`, first, 400)
	var saved struct {
		Settings plan
		Readings []struct {
			Date string
			Kg   float64
		}
	}
	readJSON(t, request(t, api, "GET", "/api/weekly-plan", "", first, 200), &saved)
	if saved.Settings.Months != 12 || saved.Settings.Days[0][0].Name != "スクワット" ||
		saved.Settings.Days[0][0].Part == nil || *saved.Settings.Days[0][0].Part != "legs" ||
		saved.Settings.Days[0][0].Reps == nil || *saved.Settings.Days[0][0].Reps != 10 ||
		saved.Settings.ReferenceReps == nil || *saved.Settings.ReferenceReps != 60 ||
		len(saved.Readings) != 1 || saved.Readings[0].Date != "2026-11-12" || saved.Readings[0].Kg != 52.5 {
		t.Fatalf("unexpected persisted plan or readings: %+v", saved)
	}
	var dashboard struct {
		Workouts    []workout
		BodyMetrics []bodyMetric
	}
	readJSON(t, request(t, api, "GET", "/api/dashboard", "", first, 200), &dashboard)
	if len(dashboard.Workouts) != 1 || dashboard.Workouts[0].WeightKg != 60 ||
		dashboard.Workouts[0].ExerciseName != "スクワット" || dashboard.Workouts[0].BodyPart != "LEGS" ||
		len(dashboard.BodyMetrics) != 1 || dashboard.BodyMetrics[0].BodyFatRate != nil {
		t.Fatalf("unexpected dashboard: %+v", dashboard)
	}
	readJSON(t, request(t, api, "GET", "/api/dashboard", "", second, 200), &dashboard)
	if len(dashboard.Workouts) != 0 || len(dashboard.BodyMetrics) != 0 {
		t.Fatal("user data was shared")
	}
	var other struct {
		Settings json.RawMessage
		Readings []json.RawMessage
	}
	readJSON(t, request(t, api, "GET", "/api/weekly-plan", "", second, 200), &other)
	if string(other.Settings) != "null" || len(other.Readings) != 0 {
		t.Fatal("plan data was shared")
	}
	request(t, api, "POST", "/api/auth/logout", "", first, 200)
	request(t, api, "GET", "/api/auth/me", "", first, 401)
}

func TestPreserveSavedCustomExercises(t *testing.T) {
	previous := `{"days":[{"menu":"旧メニュー"},{ "menu":"" },{"menu":""},{"menu":""},{"menu":""},{"menu":""},{"menu":""}]}`
	p := plan{Days: [][]exercise{{{Name: "旧メニュー"}}, {}, {}, {}, {}, {}, {}}, Months: 3}
	if !p.validate(legacyEntries(previous)) {
		t.Fatal("existing custom exercise should survive saving")
	}
	p.Days[0] = append(p.Days[0], exercise{Name: "旧メニュー"})
	if p.validate(legacyEntries(previous)) {
		t.Fatal("cannot add a new copy of a legacy exercise")
	}
}

func TestLegacyLoginAndSession(t *testing.T) {
	a := testApplication(t)
	// Fixture generated with Node's previous scryptSync(password, salt, 64).
	const legacyHash = "0123456789abcdef0123456789abcdef:f6ba3ad7adb8155fde5b4209f3e694e9bea46e59a12f5a6e0d19fd41a8e029d31d7a416a31b055ca3c831eed8d24104c491eeadc596cb165ed60a5a13316d7e6"
	now := time.Now()
	if _, err := a.db.Exec(`INSERT INTO "User" VALUES ('legacy','legacy@example.com','Legacy',?,?,?)`,
		legacyHash, now.UnixMilli(), now.UnixMilli()); err != nil {
		t.Fatal(err)
	}
	if _, err := a.db.Exec(`INSERT INTO Session VALUES ('legacy-id','legacy-token','legacy',?,?)`,
		now.UnixMilli(), now.Add(time.Hour).UnixMilli()); err != nil {
		t.Fatal(err)
	}
	api := a.routes()
	request(t, api, "GET", "/api/auth/me", "", &http.Cookie{Name: sessionCookie, Value: "legacy-token"}, 200)
	request(t, api, "POST", "/api/auth/login", `{"email":"legacy@example.com","password":"wrong-password"}`, nil, 401)
	request(t, api, "POST", "/api/auth/login", `{"email":"legacy@example.com","password":"old-password"}`, nil, 200)
}
