import { destroySessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  await destroySessionCookie();
  return Response.json({ ok: true });
}
