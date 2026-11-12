// Read the signed-in user from the Go API.
import { apiGet } from "./api";

export function getCurrentUser() {
  return apiGet<{ id: string; name: string; email: string }>("/api/auth/me");
}
