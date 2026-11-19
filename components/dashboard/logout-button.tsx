// セッション終了に成功した場合だけ、ログイン画面に戻る。
"use client";

import { useRouter } from "next/navigation";
import { requestJSON } from "@/lib/client-request";
import { useSubmission } from "@/components/use-submission";

export function LogoutButton() {
  const router = useRouter();
  const { pending, error, run } = useSubmission();

  return (
    <div>
      <button
        className="button-secondary"
        disabled={pending}
        aria-busy={pending}
        onClick={() => { void run(async () => {
          await requestJSON("/api/auth/logout");
          router.push("/login");
          router.refresh();
        }); }}
        type="button"
      >
        {pending ? "ログアウト中…" : "ログアウト"}
      </button>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
    </div>
  );
}
