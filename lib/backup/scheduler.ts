import "server-only";

import cron, { type ScheduledTask } from "node-cron";

import { runBackup } from "./runner";

let scheduled: ScheduledTask | null = null;

/**
 * Registers the daily backup cron when the Node.js server boots.
 * Called once from `instrumentation.ts`.
 */
export function startBackupScheduler() {
  if (scheduled) return;
  if (process.env.ENABLE_BACKUP_CRON !== "1") {
    console.log(
      "[backup] cron disabled (set ENABLE_BACKUP_CRON=1 to schedule)"
    );
    return;
  }

  const expr = process.env.BACKUP_CRON ?? "0 0 * * *";
  if (!cron.validate(expr)) {
    console.error(`[backup] invalid BACKUP_CRON expression: ${expr}`);
    return;
  }

  scheduled = cron.schedule(
    expr,
    async () => {
      console.log("[backup] cron tick — starting run");
      try {
        const summary = await runBackup();
        console.log("[backup] cron run finished", {
          durationMs: summary.durationMs,
          artifacts: summary.artifacts.length,
          drive:
            "skipped" in summary.drive
              ? `skipped (${summary.drive.reason ?? "n/a"})`
              : `${summary.drive.uploaded.length} files uploaded`,
        });
      } catch (err) {
        console.error("[backup] cron run failed", err);
      }
    },
    { timezone: process.env.TZ }
  );

  console.log(`[backup] cron scheduled: "${expr}" (TZ=${process.env.TZ ?? "default"})`);
}
