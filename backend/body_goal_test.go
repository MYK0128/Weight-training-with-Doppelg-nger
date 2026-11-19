package main

import (
	"fmt"
	"net/http"
	"testing"
)

func TestBodyGoalAuthIsolationAndReadback(t *testing.T) {
	a := testApplication(t)
	api := a.routes()
	for _, method := range []string{"GET", "PUT"} {
		request(t, api, method, "/api/body-goal", `{}`, nil, 401)
		request(t, api, method, "/api/body-goal", `{}`, &http.Cookie{Name: sessionCookie, Value: "invalid"}, 401)
	}
	first := registerBodyUser(t, a, "first@example.com")
	second := registerBodyUser(t, a, "second@example.com")
	var other user
	readJSON(t, request(t, api, "GET", "/api/auth/me", "", second, 200), &other)
	assertJSON(t, request(t, api, "GET", "/api/body-goal", "", first, 200).Body.Bytes(), `{"goal":null}`)
	assertJSON(t, request(t, api, "PUT", "/api/body-goal", fmt.Sprintf(
		`{"targetWeightKg":"65.5","targetBodyFatRate":"18.5","trainingDays":"2","equipment":"gym","userId":%q}`, other.ID), first, 200).Body.Bytes(), `{"ok":true}`)
	assertJSON(t, request(t, api, "GET", "/api/body-goal?userId="+other.ID, "", first, 200).Body.Bytes(),
		`{"goal":{"targetWeightKg":65.5,"targetBodyFatRate":18.5,"trainingDays":2,"equipment":"gym"}}`)
	assertJSON(t, request(t, api, "GET", "/api/body-goal", "", second, 200).Body.Bytes(), `{"goal":null}`)
	request(t, api, "PUT", "/api/body-goal", `{"targetWeightKg":66,"targetBodyFatRate":19,"trainingDays":3,"equipment":"dumbbells"}`, first, 200)
	assertJSON(t, request(t, api, "GET", "/api/body-goal", "", first, 200).Body.Bytes(),
		`{"goal":{"targetWeightKg":66,"targetBodyFatRate":19,"trainingDays":3,"equipment":"dumbbells"}}`)
	assertJSON(t, request(t, api, "GET", "/api/body-profile", "", first, 200).Body.Bytes(),
		`{"heightCm":174,"weightKg":68.4,"bodyFatRate":22,"latestMetric":null}`)
	if _, err := a.db.Exec(`UPDATE Session SET expiresAt=0 WHERE token=?`, first.Value); err != nil {
		t.Fatal(err)
	}
	request(t, api, "GET", "/api/body-goal", "", first, 401)
	request(t, api, "PUT", "/api/body-goal", `{}`, first, 401)
}

func TestBodyGoalValidation(t *testing.T) {
	a := testApplication(t)
	api := a.routes()
	cookie := registerBodyUser(t, a, "body@example.com")
	for _, test := range []struct{ body, expected string }{
		{`{"targetWeightKg":20,"targetBodyFatRate":1,"trainingDays":2,"equipment":"gym"}`,
			`{"goal":{"targetWeightKg":20,"targetBodyFatRate":1,"trainingDays":2,"equipment":"gym"}}`},
		{`{"targetWeightKg":"500","targetBodyFatRate":"75","trainingDays":"3","equipment":"dumbbells"}`,
			`{"goal":{"targetWeightKg":500,"targetBodyFatRate":75,"trainingDays":3,"equipment":"dumbbells"}}`},
	} {
		request(t, api, "PUT", "/api/body-goal", test.body, cookie, 200)
		assertJSON(t, request(t, api, "GET", "/api/body-goal", "", cookie, 200).Body.Bytes(), test.expected)
	}
	for _, body := range []string{
		`{}`, `null`,
		`{"targetBodyFatRate":20,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":70,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"trainingDays":2}`,
		`{"targetWeightKg":19.9,"targetBodyFatRate":20,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":500.1,"targetBodyFatRate":20,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":0.9,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":75.1,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"trainingDays":1,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"trainingDays":4,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"trainingDays":2.5,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"trainingDays":2,"equipment":"bodyweight"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"trainingDays":2,"equipment":"Gym"}`,
		`{"targetWeightKg":null,"targetBodyFatRate":20,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":"","targetBodyFatRate":20,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":"NaN","targetBodyFatRate":20,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":"Infinity","trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":true,"targetBodyFatRate":20,"trainingDays":2,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"trainingDays":null,"equipment":"gym"}`,
		`{"targetWeightKg":70,"targetBodyFatRate":20,"trainingDays":2,"equipment":null}`,
	} {
		t.Run(body, func(t *testing.T) { request(t, api, "PUT", "/api/body-goal", body, cookie, 400) })
	}
	assertJSON(t, request(t, api, "GET", "/api/body-goal", "", cookie, 200).Body.Bytes(),
		`{"goal":{"targetWeightKg":500,"targetBodyFatRate":75,"trainingDays":3,"equipment":"dumbbells"}}`)
}
