// Embed and index the exercise catalog by ID.
package main

import (
	_ "embed"
	"encoding/json"
	"strings"
)

//go:embed exercises.json
var catalogJSON []byte

type catalogExercise struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Part string `json:"part"`
}

var exerciseCatalog = func() map[string]catalogExercise {
	var entries []catalogExercise
	if err := json.Unmarshal(catalogJSON, &entries); err != nil {
		panic(err)
	}
	result := make(map[string]catalogExercise, len(entries))
	for _, entry := range entries {
		if entry.ID == "" || entry.Name == "" || entry.Part == "" || result[entry.ID].ID != "" {
			panic("invalid exercise catalog")
		}
		result[entry.ID] = entry
	}
	return result
}()

func workoutPart(part string) string {
	return strings.ToUpper(part)
}
