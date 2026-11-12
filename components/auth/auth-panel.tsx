"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

async function postJSON(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "処理に失敗しました");
  }

  return data;
}

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="auth-tabs">
        <button className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")} type="button">
          ログイン
        </button>
        <button className={`tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")} type="button">
          新規登録
        </button>
      </div>

      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
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
                  password: formData.get("password")
                };

          startTransition(async () => {
            try {
              const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
              await postJSON(path, payload);
              router.push("/plan");
              router.refresh();
            } catch (authError) {
              setError(authError instanceof Error ? authError.message : "認証に失敗しました");
            }
          });
        }}
      >
        {mode === "register" && (
          <div className="field">
            <label htmlFor="name">表示名</label>
            <input id="name" name="name" placeholder="例: Iron Taro" required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">メールアドレス</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div className="field">
          <label htmlFor="password">パスワード</label>
          <input id="password" name="password" type="password" placeholder="8文字以上" required minLength={8} />
        </div>
        <button className="button" disabled={pending} type="submit">
          {pending ? "送信中..." : mode === "login" ? "ログインして始める" : "アカウントを作成する"}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
