// 筋トレ・身体情報を保存し、ユーザーごとの記録を取得する。
package main

import (
	"context"
	"database/sql"
	"net/http"
	"time"
)

const dateFormat = "2006-01-02"

type workout struct {
	ID           string  `json:"id"`
	Date         string  `json:"date"`
	ExerciseName string  `json:"exerciseName"`
	BodyPart     string  `json:"bodyPart"`
	WeightKg     float64 `json:"weightKg"`
	Reps         int     `json:"reps"`
	Sets         int     `json:"sets"`
	Memo         *string `json:"memo"`
}

type bodyMetric struct {
	ID           string   `json:"id"`
	Date         string   `json:"date"`
	WeightKg     float64  `json:"weightKg"`
	BodyFatRate  *float64 `json:"bodyFatRate"`
	MuscleMassKg *float64 `json:"muscleMassKg"`
	ChestCm      *float64 `json:"chestCm"`
	ArmCm        *float64 `json:"armCm"`
	LegCm        *float64 `json:"legCm"`
}

func (a *application) saveWorkout(w http.ResponseWriter, r *http.Request, u user) {
	var input struct {
		Date, ExerciseID, Memo string
		WeightKg, Reps, Sets   formNumber
	}
	if !decode(w, r, &input) {
		return
	}
	date, err := time.Parse(dateFormat, input.Date)
	selected, known := exerciseCatalog[input.ExerciseID]
	if err != nil || !known || len(input.Memo) > 4000 ||
		!input.WeightKg.between(0, 10000, false) || !input.Reps.integer(1, 10000) || !input.Sets.integer(1, 10000) {
		problem(w, http.StatusBadRequest, "一覧から種目を選び、日付・重量・回数・セット数を確認してください。")
		return
	}
	row := workout{randomHex(16), input.Date, selected.Name, workoutPart(selected.Part), *input.WeightKg.value,
		int(*input.Reps.value), int(*input.Sets.value), &input.Memo}
	_, err = a.db.ExecContext(r.Context(), `INSERT INTO WorkoutLog(id,userId,date,exerciseName,bodyPart,weightKg,reps,sets,memo,createdAt)
		VALUES (?,?,?,?,?,?,?,?,?,?)`, row.ID, u.ID, date.UnixMilli(), row.ExerciseName, row.BodyPart, row.WeightKg,
		row.Reps, row.Sets, row.Memo, time.Now().UnixMilli())
	if err != nil {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]any{"ok": true, "workout": row})
}

func (a *application) saveBodyMetric(w http.ResponseWriter, r *http.Request, u user) {
	var input struct {
		Date                                                       string
		WeightKg, BodyFatRate, MuscleMassKg, ChestCm, ArmCm, LegCm formNumber
	}
	if !decode(w, r, &input) {
		return
	}
	date, err := time.Parse(dateFormat, input.Date)
	if err != nil || !input.WeightKg.between(1, 1000, false) || !input.BodyFatRate.between(0, 100, true) ||
		!input.MuscleMassKg.between(0, 1000, true) || !input.ChestCm.between(0, 1000, true) ||
		!input.ArmCm.between(0, 1000, true) || !input.LegCm.between(0, 1000, true) {
		problem(w, http.StatusBadRequest, "日付・体重・測定値を確認してください。")
		return
	}
	row := bodyMetric{randomHex(16), input.Date, *input.WeightKg.value, input.BodyFatRate.value,
		input.MuscleMassKg.value, input.ChestCm.value, input.ArmCm.value, input.LegCm.value}
	_, err = a.db.ExecContext(r.Context(), `INSERT INTO BodyMetric(id,userId,date,weightKg,bodyFatRate,muscleMassKg,chestCm,armCm,legCm,createdAt)
		VALUES (?,?,?,?,?,?,?,?,?,?)`, row.ID, u.ID, date.UnixMilli(), row.WeightKg, row.BodyFatRate, row.MuscleMassKg,
		row.ChestCm, row.ArmCm, row.LegCm, time.Now().UnixMilli())
	if err != nil {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]any{"ok": true, "metric": row})
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func workouts(ctx context.Context, db queryer, userID string) ([]workout, error) {
	rows, err := db.QueryContext(ctx, `SELECT id,CAST(date AS INTEGER),exerciseName,bodyPart,weightKg,reps,sets,memo
		FROM WorkoutLog WHERE userId = ? ORDER BY date,createdAt,id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []workout{}
	for rows.Next() {
		var row workout
		var millis int64
		if err := rows.Scan(&row.ID, &millis, &row.ExerciseName, &row.BodyPart, &row.WeightKg,
			&row.Reps, &row.Sets, &row.Memo); err != nil {
			return nil, err
		}
		row.Date = time.UnixMilli(millis).UTC().Format(dateFormat)
		result = append(result, row)
	}
	return result, rows.Err()
}

func metrics(ctx context.Context, db queryer, userID string) ([]bodyMetric, error) {
	rows, err := db.QueryContext(ctx, `SELECT id,CAST(date AS INTEGER),weightKg,bodyFatRate,muscleMassKg,chestCm,armCm,legCm
		FROM BodyMetric WHERE userId = ? ORDER BY date,createdAt,id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []bodyMetric{}
	for rows.Next() {
		var row bodyMetric
		var millis int64
		if err := rows.Scan(&row.ID, &millis, &row.WeightKg, &row.BodyFatRate, &row.MuscleMassKg,
			&row.ChestCm, &row.ArmCm, &row.LegCm); err != nil {
			return nil, err
		}
		row.Date = time.UnixMilli(millis).UTC().Format(dateFormat)
		result = append(result, row)
	}
	return result, rows.Err()
}

func (a *application) dashboard(w http.ResponseWriter, r *http.Request, u user) {
	ctx := r.Context()
	tx, err := a.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback()
	workoutRows, err := workouts(ctx, tx, u.ID)
	if err != nil {
		fail(w, err)
		return
	}
	metricRows, err := metrics(ctx, tx, u.ID)
	if err != nil {
		fail(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]any{"workouts": workoutRows, "bodyMetrics": metricRows})
}
