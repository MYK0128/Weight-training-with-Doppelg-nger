// 週間プランを検証・保存し、実測の筋肉量と一緒に取得する。
package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

type exercise struct {
	ExerciseID string  `json:"exerciseId,omitempty"`
	Name       string  `json:"name"`
	Part       *string `json:"part"`
	Sets       *int    `json:"sets"`
	Reps       *int    `json:"reps,omitempty"`
}

type plan struct {
	Days          [][]exercise `json:"days"`
	CurrentMassKg *float64     `json:"currentMassKg"`
	PaceKg        *float64     `json:"paceKg"`
	ReferenceReps *int         `json:"referenceReps,omitempty"`
	UpperPaceKg   *float64     `json:"upperPaceKg"`
	TargetMassKg  *float64     `json:"targetMassKg"`
	Months        int          `json:"months"`
}

type legacyKey struct{ name, part string }

func keyFor(e exercise) legacyKey {
	key := legacyKey{name: strings.TrimSpace(e.Name)}
	if e.Part != nil {
		key.part = *e.Part
	}
	return key
}

func legacyEntries(settings string) map[legacyKey]int {
	var previous struct {
		Days []json.RawMessage `json:"days"`
	}
	result := make(map[legacyKey]int)
	if json.Unmarshal([]byte(settings), &previous) != nil {
		return result
	}
	for _, raw := range previous.Days {
		var day []exercise
		if json.Unmarshal(raw, &day) != nil {
			var old struct {
				Menu string `json:"menu"`
			}
			if json.Unmarshal(raw, &old) == nil && strings.TrimSpace(old.Menu) != "" {
				result[keyFor(exercise{Name: old.Menu})]++
			}
			continue
		}
		for _, item := range day {
			if item.ExerciseID == "" {
				result[keyFor(item)]++
			}
		}
	}
	return result
}

func (p *plan) validate(legacy map[legacyKey]int) bool {
	if len(p.Days) != 7 || p.Months < 1 || p.Months > 60 ||
		(p.ReferenceReps != nil && (*p.ReferenceReps < 1 || *p.ReferenceReps > 14_000_000)) ||
		!(formNumber{p.CurrentMassKg}).between(0.01, 1000, true) ||
		!(formNumber{p.TargetMassKg}).between(0.01, 1000, true) ||
		!(formNumber{p.PaceKg}).between(0, 25, true) || !(formNumber{p.UpperPaceKg}).between(0, 25, true) ||
		(p.UpperPaceKg != nil && (p.PaceKg == nil || *p.UpperPaceKg < *p.PaceKg)) {
		return false
	}
	for _, day := range p.Days {
		if day == nil || len(day) > 20 {
			return false
		}
		for i := range day {
			e := &day[i]
			// 旧プランの未入力は残し、入力された回数・セット数は範囲を検証する。
			if (e.Sets != nil && (*e.Sets < 1 || *e.Sets > 100)) || (e.Reps != nil && (*e.Reps < 1 || *e.Reps > 1000)) {
				return false
			}
			if e.ExerciseID != "" {
				selected, known := exerciseCatalog[e.ExerciseID]
				if !known {
					return false
				}
				// 画面から届いた名称・部位より、種目一覧の定義を優先する。
				e.Name, e.Part = selected.Name, &selected.Part
				continue
			}
			// Only previously saved custom entries may remain without a catalog ID.
			key := keyFor(*e)
			if key.name == "" || utf8.RuneCountInString(key.name) > 120 || legacy[key] == 0 {
				return false
			}
			legacy[key]--
			e.Name = key.name
		}
	}
	return true
}

func (a *application) getPlan(w http.ResponseWriter, r *http.Request, u user) {
	ctx := r.Context()
	var settings string
	err := a.db.QueryRowContext(ctx, "SELECT json(settings) FROM WeeklyPlan WHERE userId = ?", u.ID).Scan(&settings)
	if errors.Is(err, sql.ErrNoRows) {
		settings = "null"
	} else if err != nil {
		fail(w, err)
		return
	}

	rows, err := a.db.QueryContext(ctx, `SELECT CAST(date AS INTEGER),muscleMassKg FROM BodyMetric
		WHERE userId = ? AND muscleMassKg > 0 ORDER BY date,createdAt,id`, u.ID)
	if err != nil {
		fail(w, err)
		return
	}
	defer rows.Close()
	type reading struct {
		Date string  `json:"date"`
		Kg   float64 `json:"kg"`
	}
	readings := []reading{}
	for rows.Next() {
		var item reading
		var date int64
		if err := rows.Scan(&date, &item.Kg); err != nil {
			fail(w, err)
			return
		}
		item.Date = time.UnixMilli(date).UTC().Format(dateFormat)
		readings = append(readings, item)
	}
	if err := rows.Err(); err != nil {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]any{"settings": json.RawMessage(settings), "readings": readings})
}

func (a *application) savePlan(w http.ResponseWriter, r *http.Request, u user) {
	var p plan
	if !decode(w, r, &p) {
		return
	}
	ctx := r.Context()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback()
	var previous string
	err = tx.QueryRowContext(ctx, "SELECT json(settings) FROM WeeklyPlan WHERE userId = ?", u.ID).Scan(&previous)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		fail(w, err)
		return
	}
	if !p.validate(legacyEntries(previous)) {
		problem(w, http.StatusBadRequest, "週間プランの入力内容を確認してください。")
		return
	}
	encoded, err := json.Marshal(p)
	if err != nil {
		fail(w, err)
		return
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO WeeklyPlan(userId,settings,updatedAt) VALUES (?,jsonb(?),?)
		ON CONFLICT(userId) DO UPDATE SET settings=excluded.settings,updatedAt=excluded.updatedAt`,
		u.ID, string(encoded), time.Now().UnixMilli())
	if err != nil {
		fail(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]bool{"ok": true})
}
