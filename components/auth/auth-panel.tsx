// ログインと新規登録を切り替え、入力を認証APIへ送る。
"use client";

import { useState } from "react";
import { BodyFields } from "@/components/body-fields";
import { bodyPayload } from "@/lib/body-profile";
import { requestJSON } from "@/lib/client-request";
import { useSubmission } from "@/components/use-submission";
import { useRouter } from "next/navigation";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const { pending, error, run } = useSubmission();

  return (
    <div>
      <div className="auth-tabs">
        <button className={`tab ${mode === "login" ? "active" : ""}`} disabled={pending} onClick={() => setMode("login")} type="button">
          ログイン
        </button>
        <button className={`tab ${mode === "register" ? "active" : ""}`} disabled={pending} onClick={() => setMode("register")} type="button">
          新規登録
        </button>
      </div>

      <form
        className="form-grid"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const payload =
            mode === "login"
              ? {
                  email: formData.get("email"),
                  password: formData.get("password")
                }
              : {
                  name: formData.get("name"),
                  email: formData.get("email"),
                  password: formData.get("password"),
                  ...bodyPayload(formData)
                };

          void run(async () => {
            const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
            await requestJSON(path, payload);
            router.replace("/");
            router.refresh();
          });
        }}
      >
        <fieldset className="submission-fields form-grid" disabled={pending} aria-label="認証情報の入力">
          {mode === "register" && (
            <div className="field">
              <label htmlFor="name">表示名</label>
              <input id="name" name="name" placeholder="例: Iron Taro" autoComplete="nickname" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">メールアドレス</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">パスワード</label>
            <input id="password" name="password" type="password" placeholder="8文字以上"
              autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
          </div>
          {mode === "register" && <div className="auth-body form-grid">
            <div><h2 className="section-title">アバターの身体データ</h2>
              <p className="muted">身長と体重は必須です。体脂肪率は空欄でも構いません。入力内容はアカウントに保存されます。</p></div>
            <BodyFields prefix="register" />
          </div>}
          <button className="button" type="submit">
            {pending ? "送信中…" : mode === "login" ? "ログインして始める" : "アカウントを作成する"}
          </button>
        </fieldset>
      </form>

      {error ? <p role="alert" className="error-text">{error}</p> : null}
    </div>
  );
}
