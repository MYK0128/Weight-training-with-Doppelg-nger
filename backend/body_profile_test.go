package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func registerBodyUser(t *testing.T, a *application, email string) *http.Cookie {
	t.Helper()
	return request(t, a.routes(), "POST", "/api/auth/register", fmt.Sprintf(
		`{"name":"Body User","email":%q,"password":"test-password","heightCm":174,"weightKg":68.4,"bodyFatRate":22}`, email), nil, 200).Result().Cookies()[0]
}

func assertJSON(t *testing.T, actual []byte, expected string) {
	t.Helper()
	var got, want any
	if err := json.Unmarshal(actual, &got); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(expected), &want); err != nil {
		t.Fatal(err)
	}
	gotJSON, _ := json.Marshal(got)
	wantJSON, _ := json.Marshal(want)
	if string(gotJSON) != string(wantJSON) {
		t.Fatalf("got %s, want %s", gotJSON, wantJSON)
	}
}

func TestRegistrationStoresSeparateBodyProfile(t *testing.T) {
	for _, fields := range []string{
		`"heightCm":"174","weightKg":"68.4","bodyFatRate":"22"`,
		`"heightCm":174,"weightKg":68.4,"bodyFatRate":22`,
		`"heightCm":80,"weightKg":20,"bodyFatRate":1`,
		`"heightCm":250,"weightKg":500,"bodyFatRate":75`,
		`"heightCm":174,"weightKg":68.4`,
		`"heightCm":174,"weightKg":68.4,"bodyFatRate":""`,
		`"heightCm":174,"weightKg":68.4,"bodyFatRate":null`,
	} {
		t.Run(fields, func(t *testing.T) {
			a := testApplication(t)
			response := request(t, a.routes(), "POST", "/api/auth/register",
				`{"name":"Body User","email":"body@example.com","password":"test-password",`+fields+`}`, nil, 200)
			var result struct{ User user }
			readJSON(t, response, &result)
			var height, weight float64
			var fat *float64
			if err := a.db.QueryRow(`SELECT heightCm,weightKg,bodyFatRate FROM BodyProfile WHERE userId=?`, result.User.ID).Scan(&height, &weight, &fat); err != nil {
				t.Fatal(err)
			}
			var expected struct{ HeightCm, WeightKg, BodyFatRate formNumber }
			if err := json.Unmarshal([]byte(`{`+fields+`}`), &expected); err != nil {
				t.Fatal(err)
			}
			if height != *expected.HeightCm.value || weight != *expected.WeightKg.value || (fat == nil) != (expected.BodyFatRate.value == nil) || (fat != nil && *fat != *expected.BodyFatRate.value) {
				t.Fatalf("incorrect profile: %v %v %v", height, weight, fat)
			}
			var metrics, sessions int
			if err := a.db.QueryRow(`SELECT COUNT(*) FROM BodyMetric`).Scan(&metrics); err != nil {
				t.Fatal(err)
			}
			if err := a.db.QueryRow(`SELECT COUNT(*) FROM Session WHERE userId=?`, result.User.ID).Scan(&sessions); err != nil {
				t.Fatal(err)
			}
			if metrics != 0 || sessions != 1 || len(response.Result().Cookies()) != 1 {
				t.Fatalf("metrics=%d sessions=%d; registration must not create a metric", metrics, sessions)
			}
		})
	}
}

func TestRegistrationRequiresValidBodyProfile(t *testing.T) {
	for _, fields := range []string{
		``, `,"heightCm":174`, `,"weightKg":68.4`,
		`,"heightCm":null,"weightKg":68.4`, `,"heightCm":"","weightKg":68.4`,
		`,"heightCm":79.9,"weightKg":68.4`, `,"heightCm":250.1,"weightKg":68.4`,
		`,"heightCm":174,"weightKg":19.9`, `,"heightCm":174,"weightKg":500.1`,
		`,"heightCm":174,"weightKg":null`, `,"heightCm":174,"weightKg":""`,
		`,"heightCm":174,"weightKg":68.4,"bodyFatRate":0.9`,
		`,"heightCm":174,"weightKg":68.4,"bodyFatRate":75.1`,
		`,"heightCm":"NaN","weightKg":68.4`, `,"heightCm":174,"weightKg":"Infinity"`,
		`,"heightCm":true,"weightKg":68.4`, `,"heightCm":174,"weightKg":68.4,"bodyFatRate":{}`,
	} {
		t.Run(fields, func(t *testing.T) {
			a := testApplication(t)
			response := request(t, a.routes(), "POST", "/api/auth/register",
				`{"name":"Body User","email":"body@example.com","password":"test-password"`+fields+`}`, nil, 400)
			var count int
			if err := a.db.QueryRow(`SELECT COUNT(*) FROM "User"`).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if count != 0 || len(response.Result().Cookies()) != 0 {
				t.Fatal("invalid registration created user or session cookie")
			}
		})
	}
}
