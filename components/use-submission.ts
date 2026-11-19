"use client";

import { useRef, useState } from "react";

// Reactの再描画前に届いた再送信も止め、失敗時は入力をリセットしない。
export function useSubmission() {
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setPending(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "処理に失敗しました。もう一度お試しください。");
    } finally {
      active.current = false;
      setPending(false);
    }
  }

  return { pending, error, run };
}
