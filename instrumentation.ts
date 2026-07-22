/**
 * Next.js boot hook (see node_modules/next/dist/docs/01-app/02-guides/instrumentation.md).
 * Runs once when the Node.js server starts — we use it to register the
 * backup cron, so no separate sidecar process is required.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startBackupScheduler } = await import("@/lib/backup/scheduler");
  startBackupScheduler();
}
