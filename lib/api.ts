// Call the Go API from Next.js with the session cookie.
import { cookies } from "next/headers";

const apiOrigin = process.env.MUSCLE_API_URL ?? "http://127.0.0.1:8080";
const sessionCookie = "muscle_quest_session";

export async function apiGet<T>(path: string): Promise<T | null> {
  const session = (await cookies()).get(sessionCookie);
  if (!session) return null;

  const response = await fetch(new URL(path, apiOrigin), {
    headers: { Cookie: `${sessionCookie}=${encodeURIComponent(session.value)}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Muscle Quest API returned ${response.status} for ${path}`);
  return response.json() as Promise<T>;
}
