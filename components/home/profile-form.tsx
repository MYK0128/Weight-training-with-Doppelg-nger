"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BodyFields } from "@/components/body-fields";
import { useSubmission } from "@/components/use-submission";
import { bodyPayload, type BodyProfile } from "@/lib/body-profile";
import { requestJSON } from "@/lib/client-request";

export function ProfileForm({ profile }: { profile: BodyProfile }) {
  const router = useRouter();
  const panel = useRef<HTMLDetailsElement>(null);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useSubmission();
  const incomplete = profile.heightCm == null || profile.weightKg == null;

  return (
    <div id="body-profile" className="home-profile">
      <details ref={panel} className="panel-card" open={incomplete || undefined}>
        <summary>{incomplete ? "身体プロフィールを登録" : "身体プロフィールを編集"}</summary>
        <p className="muted">身長・初期の体重・分かる場合は体脂肪率を保存します。{profile.latestMetric && "ホームの体重・体脂肪率には、最新の測定記録が優先されます。"}</p>
        <form aria-busy={pending} onSubmit={(event) => {
          event.preventDefault();
          const payload = bodyPayload(new FormData(event.currentTarget));
          void run(async () => {
            setSaved(false);
            await requestJSON("/api/body-profile", payload, "PUT");
            setSaved(true);
            if (panel.current) panel.current.open = false;
            router.refresh();
          });
        }}>
          <fieldset className="submission-fields form-grid" disabled={pending} aria-label="身体プロフィールの入力">
            <BodyFields prefix="profile" values={{
              heightCm: profile.heightCm,
              weightKg: profile.weightKg ?? profile.latestMetric?.weightKg ?? null,
              bodyFatRate: profile.weightKg == null ? profile.latestMetric?.bodyFatRate ?? null : profile.bodyFatRate
            }} />
            <button className="button" type="submit">{pending ? "保存中…" : "身体プロフィールを保存"}</button>
          </fieldset>
        </form>
        {error && <p className="error-text" role="alert">{error}</p>}
      </details>
      <div role="status">{saved && <p className="success-text">身体プロフィールを保存しました。</p>}</div>
    </div>
  );
}
