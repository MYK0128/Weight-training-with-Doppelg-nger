// Store onboarding values separately from dated body measurements.
package main

import (
	"database/sql"
	"errors"
	"net/http"
	"time"
)

type bodyProfileInput struct {
	HeightCm    formNumber `json:"heightCm"`
	WeightKg    formNumber `json:"weightKg"`
	BodyFatRate formNumber `json:"bodyFatRate"`
}

func (p bodyProfileInput) valid() bool {
	return p.HeightCm.between(80, 250, false) && p.WeightKg.between(20, 500, false) &&
		p.BodyFatRate.between(1, 75, true)
}

type latestBodyMetric struct {
	WeightKg    float64  `json:"weightKg"`
	BodyFatRate *float64 `json:"bodyFatRate"`
	Date        string   `json:"date"`
}

type bodyProfile struct {
	HeightCm     *float64          `json:"heightCm"`
	WeightKg     *float64          `json:"weightKg"`
	BodyFatRate  *float64          `json:"bodyFatRate"`
	LatestMetric *latestBodyMetric `json:"latestMetric"`
}

func (a *application) getBodyProfile(w http.ResponseWriter, r *http.Request, u user) {
	ctx := r.Context()
	tx, err := a.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback()
	var profile bodyProfile
	err = tx.QueryRowContext(ctx, `SELECT heightCm,weightKg,bodyFatRate FROM BodyProfile WHERE userId=?`, u.ID).
		Scan(&profile.HeightCm, &profile.WeightKg, &profile.BodyFatRate)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		fail(w, err)
		return
	}
	var latest latestBodyMetric
	var millis int64
	// Keep weight and fat together, including a null fat value; never backfill from another record.
	err = tx.QueryRowContext(ctx, `SELECT weightKg,bodyFatRate,CAST(date AS INTEGER) FROM BodyMetric
		WHERE userId=? ORDER BY date DESC,createdAt DESC,id DESC LIMIT 1`, u.ID).
		Scan(&latest.WeightKg, &latest.BodyFatRate, &millis)
	if err == nil {
		latest.Date = time.UnixMilli(millis).UTC().Format(dateFormat)
		profile.LatestMetric = &latest
	} else if !errors.Is(err, sql.ErrNoRows) {
		fail(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, profile)
}

func (a *application) saveBodyProfile(w http.ResponseWriter, r *http.Request, u user) {
	var input bodyProfileInput
	if !decode(w, r, &input) {
		return
	}
	if !input.valid() {
		problem(w, http.StatusBadRequest, "身長・体重・体脂肪率を確認してください。")
		return
	}
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO BodyProfile(userId,heightCm,weightKg,bodyFatRate,updatedAt)
		VALUES (?,?,?,?,?) ON CONFLICT(userId) DO UPDATE SET
		heightCm=excluded.heightCm,weightKg=excluded.weightKg,bodyFatRate=excluded.bodyFatRate,updatedAt=excluded.updatedAt`,
		u.ID, input.HeightCm.value, input.WeightKg.value, input.BodyFatRate.value, time.Now().UnixMilli())
	if err != nil {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]bool{"ok": true})
}
