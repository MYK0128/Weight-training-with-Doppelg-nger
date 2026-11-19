// Create demo records without overwriting an existing account.
package main

import "time"

func (a *application) seedDemo() error {
	const email = "demo@muscle.quest"
	var exists bool
	if err := a.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM "User" WHERE email = ?)`, email).Scan(&exists); err != nil || exists {
		return err
	}
	hash, err := hashPassword("demo1234")
	if err != nil {
		return err
	}
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now, id := time.Now().UTC(), randomHex(16)
	today := now.Truncate(24 * time.Hour)
	_, err = tx.Exec(`INSERT INTO "User"(id,email,name,passwordHash,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`,
		id, email, "Demo Lifter", hash, now.UnixMilli(), now.UnixMilli())
	if err != nil {
		return err
	}
	_, err = tx.Exec(`INSERT INTO BodyProfile(userId,heightCm,weightKg,bodyFatRate,updatedAt) VALUES (?,174,68.4,22,?)`,
		id, now.UnixMilli())
	if err != nil {
		return err
	}
	for i, days := range []int{42, 21, 0} {
		date := today.AddDate(0, 0, -days).UnixMilli()
		_, err = tx.Exec(`INSERT INTO BodyMetric(id,userId,date,weightKg,bodyFatRate,muscleMassKg,createdAt) VALUES (?,?,?,?,?,?,?)`,
			randomHex(16), id, date, 68.4+float64(i)*0.4, 22-float64(i)*0.5, 53.2+float64(i)*0.3, now.UnixMilli())
		if err != nil {
			return err
		}
		_, err = tx.Exec(`INSERT INTO WorkoutLog(id,userId,date,exerciseName,bodyPart,weightKg,reps,sets,createdAt)
			VALUES (?,?,?,'Bench Press','CHEST',?,8,4,?)`, randomHex(16), id, date, 55+i*2, now.UnixMilli())
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
