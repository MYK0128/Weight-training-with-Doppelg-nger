// Persist each user's body-composition target and training constraints.
package main

import (
	"database/sql"
	"errors"
	"net/http"
	"time"
)

type bodyGoal struct {
	TargetWeightKg    float64 `json:"targetWeightKg"`
	TargetBodyFatRate float64 `json:"targetBodyFatRate"`
	TrainingDays      int     `json:"trainingDays"`
	Equipment         string  `json:"equipment"`
}

func (a *application) getBodyGoal(w http.ResponseWriter, r *http.Request, u user) {
	var goal bodyGoal
	var result *bodyGoal
	err := a.db.QueryRowContext(r.Context(), `SELECT targetWeightKg,targetBodyFatRate,trainingDays,equipment
		FROM BodyGoal WHERE userId=?`, u.ID).
		Scan(&goal.TargetWeightKg, &goal.TargetBodyFatRate, &goal.TrainingDays, &goal.Equipment)
	if err == nil {
		result = &goal
	} else if !errors.Is(err, sql.ErrNoRows) {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]any{"goal": result})
}

func (a *application) saveBodyGoal(w http.ResponseWriter, r *http.Request, u user) {
	var input struct {
		TargetWeightKg    formNumber `json:"targetWeightKg"`
		TargetBodyFatRate formNumber `json:"targetBodyFatRate"`
		TrainingDays      formNumber `json:"trainingDays"`
		Equipment         string     `json:"equipment"`
	}
	if !decode(w, r, &input) {
		return
	}
	if !input.TargetWeightKg.between(20, 500, false) || !input.TargetBodyFatRate.between(1, 75, false) ||
		!input.TrainingDays.integer(2, 3) || (input.Equipment != "gym" && input.Equipment != "dumbbells") {
		problem(w, http.StatusBadRequest, "目標体重・体脂肪率・トレーニング条件を確認してください。")
		return
	}
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO BodyGoal(userId,targetWeightKg,targetBodyFatRate,trainingDays,equipment,updatedAt)
		VALUES (?,?,?,?,?,?) ON CONFLICT(userId) DO UPDATE SET targetWeightKg=excluded.targetWeightKg,
		targetBodyFatRate=excluded.targetBodyFatRate,trainingDays=excluded.trainingDays,equipment=excluded.equipment,updatedAt=excluded.updatedAt`,
		u.ID, input.TargetWeightKg.value, input.TargetBodyFatRate.value, int(*input.TrainingDays.value), input.Equipment, time.Now().UnixMilli())
	if err != nil {
		fail(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]bool{"ok": true})
}
