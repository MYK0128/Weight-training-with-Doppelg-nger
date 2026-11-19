package main

import (
	"testing"
)

func TestFreshSeedHasBodyProfileAndFatReadings(t *testing.T) {
	a := testApplication(t)
	if err := a.seedDemo(); err != nil {
		t.Fatal(err)
	}
	cookie := request(t, a.routes(), "POST", "/api/auth/login", `{"email":"demo@muscle.quest","password":"demo1234"}`, nil, 200).Result().Cookies()[0]
	var profile struct {
		HeightCm, WeightKg, BodyFatRate float64
		LatestMetric                    struct{ BodyFatRate float64 }
	}
	readJSON(t, request(t, a.routes(), "GET", "/api/body-profile", "", cookie, 200), &profile)
	if profile.HeightCm != 174 || profile.WeightKg != 68.4 || profile.BodyFatRate != 22 || profile.LatestMetric.BodyFatRate != 21 {
		t.Fatalf("unexpected demo profile: %+v", profile)
	}
	rows, err := a.db.Query(`SELECT bodyFatRate FROM BodyMetric ORDER BY date`)
	if err != nil {
		t.Fatal(err)
	}
	var fats []float64
	for rows.Next() {
		var fat float64
		if err := rows.Scan(&fat); err != nil {
			rows.Close()
			t.Fatal(err)
		}
		fats = append(fats, fat)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	rows.Close()
	if len(fats) != 3 || fats[0] != 22 || fats[1] != 21.5 || fats[2] != 21 {
		t.Fatalf("unexpected sample fats: %v", fats)
	}
	// Reseeding must not overwrite the user's saved profile or edited metrics.
	request(t, a.routes(), "PUT", "/api/body-profile", `{"heightCm":180,"weightKg":75}`, cookie, 200)
	if _, err := a.db.Exec(`UPDATE BodyMetric SET bodyFatRate=23`); err != nil {
		t.Fatal(err)
	}
	if err := a.seedDemo(); err != nil {
		t.Fatal(err)
	}
	readJSON(t, request(t, a.routes(), "GET", "/api/body-profile", "", cookie, 200), &profile)
	if profile.HeightCm != 180 || profile.WeightKg != 75 || profile.LatestMetric.BodyFatRate != 23 {
		t.Fatalf("seed overwrote existing data: %+v", profile)
	}
	for table, want := range map[string]int{"User": 1, "BodyProfile": 1, "BodyMetric": 3, "WorkoutLog": 3} {
		var count int
		if err := a.db.QueryRow(`SELECT COUNT(*) FROM "` + table + `"`).Scan(&count); err != nil || count != want {
			t.Fatalf("%s count=%d want=%d err=%v", table, count, want, err)
		}
	}
}

func TestSeedDoesNotBackfillExistingDemoAccount(t *testing.T) {
	a := testApplication(t)
	if _, err := a.db.Exec(`INSERT INTO "User" VALUES ('existing','demo@muscle.quest','Existing','untouched',1,2)`); err != nil {
		t.Fatal(err)
	}
	if err := a.seedDemo(); err != nil {
		t.Fatal(err)
	}
	var name, hash string
	if err := a.db.QueryRow(`SELECT name,passwordHash FROM "User" WHERE id='existing'`).Scan(&name, &hash); err != nil || name != "Existing" || hash != "untouched" {
		t.Fatalf("existing demo changed: %q %q %v", name, hash, err)
	}
	for _, table := range []string{"BodyProfile", "BodyMetric", "WorkoutLog"} {
		var count int
		if err := a.db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&count); err != nil || count != 0 {
			t.Fatalf("existing demo backfilled %s: %d %v", table, count, err)
		}
	}
}

func TestSeedRollsBackProfileWithOtherDemoRows(t *testing.T) {
	a := testApplication(t)
	if _, err := a.db.Exec(`CREATE TRIGGER seed_failure BEFORE INSERT ON BodyMetric BEGIN SELECT RAISE(ABORT,'test seed failure'); END`); err != nil {
		t.Fatal(err)
	}
	if err := a.seedDemo(); err == nil {
		t.Fatal("expected seeded metric failure")
	}
	for _, table := range []string{"User", "BodyProfile", "BodyMetric", "WorkoutLog"} {
		var count int
		if err := a.db.QueryRow(`SELECT COUNT(*) FROM "` + table + `"`).Scan(&count); err != nil || count != 0 {
			t.Fatalf("seed left partial %s: %d %v", table, count, err)
		}
	}
}
