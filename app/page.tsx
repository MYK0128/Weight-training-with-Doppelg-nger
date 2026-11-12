// Redirect to the weekly plan or login based on the session.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/plan" : "/login");
}
