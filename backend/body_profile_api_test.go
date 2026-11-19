package main

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestBodyProfileAuthIsolationAndReadback(t *testing.T) {
	a := testApplication(t)
	api := a.routes()
	for _, method := range []string{"GET", "PUT"} {
		request(t, api, method, "/api/body-profile", `{}`, nil, 401)
		request(t, api, method, "/api/body-profile", `{}`, &http.Cookie{Name: sessionCookie, Value: "invalid"}, 401)
	}
	first := registerBodyUser(t, a, "first@example.com")
	second := registerBodyUser(t, a, "second@example.com")
	var other user
	readJSON(t, request(t, api, "GET", "/api/auth/me", "", second, 200), &other)
	initial := `{"heightCm":174,"weightKg":68.4,"bodyFatRate":22,"latestMetric":null}`
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", first, 200).Body.Bytes(), initial)
	assertJSON(t, request(t, api, "PUT", "/api/body-profile", fmt.Sprintf(
		`{"heightCm":"180.5","weightKg":"75.2","bodyFatRate":"19.5","userId":%q}`, other.ID), first, 200).Body.Bytes(), `{"ok":true}`)
	assertJSON(t, request(t, api, "GET", "/api/body-profile?userId="+other.ID, "", first, 200).Body.Bytes(),
		`{"heightCm":180.5,"weightKg":75.2,"bodyFatRate":19.5,"latestMetric":null}`)
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", second, 200).Body.Bytes(), initial)
	request(t, api, "PUT", "/api/body-profile", `{"heightCm":181,"weightKg":76,"bodyFatRate":""}`, first, 200)
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", first, 200).Body.Bytes(),
		`{"heightCm":181,"weightKg":76,"bodyFatRate":null,"latestMetric":null}`)
	for _, body := range []string{
		`{}`, `{"heightCm":79.9,"weightKg":70}`, `{"heightCm":250.1,"weightKg":70}`,
		`{"heightCm":174,"weightKg":19.9}`, `{"heightCm":174,"weightKg":500.1}`,
		`{"heightCm":174,"weightKg":70,"bodyFatRate":0.9}`, `{"heightCm":174,"weightKg":70,"bodyFatRate":75.1}`,
		`{"heightCm":174,"weightKg":"NaN"}`, `{"heightCm":174,"weightKg":null}`,
	} {
		request(t, api, "PUT", "/api/body-profile", body, first, 400)
	}
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", first, 200).Body.Bytes(),
		`{"heightCm":181,"weightKg":76,"bodyFatRate":null,"latestMetric":null}`)
	var count int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM BodyMetric`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("profile updates created metrics: %d %v", count, err)
	}
	if _, err := a.db.Exec(`UPDATE Session SET expiresAt=0 WHERE token=?`, first.Value); err != nil {
		t.Fatal(err)
	}
	request(t, api, "GET", "/api/body-profile", "", first, 401)
	request(t, api, "PUT", "/api/body-profile", `{}`, first, 401)
}

func TestBodyProfileLatestMetricIsOneCoherentDeterministicRecord(t *testing.T) {
	a := testApplication(t)
	api := a.routes()
	first := registerBodyUser(t, a, "first@example.com")
	second := registerBodyUser(t, a, "second@example.com")
	var owner user
	readJSON(t, request(t, api, "GET", "/api/auth/me", "", first, 200), &owner)
	request(t, api, "POST", "/api/body-metrics", `{"date":"2030-01-01","weightKg":90,"bodyFatRate":30}`, second, 200)
	insert := func(id, date string, weight any, fat any, created int64) {
		t.Helper()
		day, err := time.Parse(dateFormat, date)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := a.db.Exec(`INSERT INTO BodyMetric(id,userId,date,weightKg,bodyFatRate,createdAt) VALUES (?,?,?,?,?,?)`,
			id, owner.ID, day.UnixMilli(), weight, fat, created); err != nil {
			t.Fatal(err)
		}
	}
	// A malformed old value must never be hydrated; read only the single latest row.
	insert("old", "2026-11-01", "not-a-number", 28, 999)
	insert("new-day", "2026-11-12", 70, 20, 1)
	insert("same-day-a", "2026-11-12", 71, 19, 2)
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", first, 200).Body.Bytes(),
		`{"heightCm":174,"weightKg":68.4,"bodyFatRate":22,"latestMetric":{"weightKg":71,"bodyFatRate":19,"date":"2026-11-12"}}`)
	insert("same-day-z", "2026-11-12", 72, nil, 2)
	for i := 0; i < 3; i++ {
		assertJSON(t, request(t, api, "GET", "/api/body-profile", "", first, 200).Body.Bytes(),
			`{"heightCm":174,"weightKg":68.4,"bodyFatRate":22,"latestMetric":{"weightKg":72,"bodyFatRate":null,"date":"2026-11-12"}}`)
	}
}

func TestLegacyBodyProfileStartsNullAndCanBeSaved(t *testing.T) {
	a := testApplication(t)
	api := a.routes()
	const hash = "0123456789abcdef0123456789abcdef:f6ba3ad7adb8155fde5b4209f3e694e9bea46e59a12f5a6e0d19fd41a8e029d31d7a416a31b055ca3c831eed8d24104c491eeadc596cb165ed60a5a13316d7e6"
	if _, err := a.db.Exec(`INSERT INTO "User" VALUES ('legacy','legacy@example.com','Legacy',?,0,0)`, hash); err != nil {
		t.Fatal(err)
	}
	cookie := request(t, api, "POST", "/api/auth/login", `{"email":"legacy@example.com","password":"old-password"}`, nil, 200).Result().Cookies()[0]
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", cookie, 200).Body.Bytes(),
		`{"heightCm":null,"weightKg":null,"bodyFatRate":null,"latestMetric":null}`)
	request(t, api, "POST", "/api/body-metrics", `{"date":"2026-11-12","weightKg":73,"bodyFatRate":20}`, cookie, 200)
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", cookie, 200).Body.Bytes(),
		`{"heightCm":null,"weightKg":null,"bodyFatRate":null,"latestMetric":{"weightKg":73,"bodyFatRate":20,"date":"2026-11-12"}}`)
	request(t, api, "PUT", "/api/body-profile", `{"heightCm":174,"weightKg":70}`, cookie, 200)
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", cookie, 200).Body.Bytes(),
		`{"heightCm":174,"weightKg":70,"bodyFatRate":null,"latestMetric":{"weightKg":73,"bodyFatRate":20,"date":"2026-11-12"}}`)
}
