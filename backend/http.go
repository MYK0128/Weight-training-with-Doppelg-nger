// JSONの入出力、APIエラー、フォームの数値変換を共通化する。
package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"math"
	"mime"
	"net/http"
	"strconv"
	"strings"
)

func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("encoding response: %v", err)
	}
}

func problem(w http.ResponseWriter, status int, message string) {
	respond(w, status, map[string]string{"error": message})
}

func fail(w http.ResponseWriter, err error) {
	log.Printf("API error: %v", err)
	problem(w, http.StatusInternalServerError, "処理に失敗しました。もう一度お試しください。")
}

func decode(w http.ResponseWriter, r *http.Request, target any) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		problem(w, http.StatusUnsupportedMediaType, "JSONで送信してください。")
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128<<10))
	if err := decoder.Decode(target); err == nil && decoder.Decode(new(any)) == io.EOF {
		return true
	}
	problem(w, http.StatusBadRequest, "入力内容が不正です。")
	return false
}

// Existing forms submit numbers as strings, while direct API callers can send JSON numbers.
type formNumber struct {
	value *float64
}

func (n *formNumber) UnmarshalJSON(data []byte) error {
	var text string
	if string(data) == "null" {
		return nil
	}
	if len(data) > 0 && data[0] == '"' {
		if err := json.Unmarshal(data, &text); err != nil {
			return err
		}
	} else {
		text = string(data)
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	value, err := strconv.ParseFloat(text, 64)
	if err != nil || math.IsInf(value, 0) || math.IsNaN(value) {
		return errors.New("expected a finite number")
	}
	n.value = &value
	return nil
}

func (n formNumber) between(minimum, maximum float64, optional bool) bool {
	if n.value == nil {
		return optional
	}
	return *n.value >= minimum && *n.value <= maximum
}

func (n formNumber) integer(minimum, maximum float64) bool {
	return n.between(minimum, maximum, false) && math.Trunc(*n.value) == *n.value
}
