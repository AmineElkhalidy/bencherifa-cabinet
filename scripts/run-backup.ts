/**
 * One-shot backup script for cron jobs running outside the Next.js
 * server (host-level cron, GitHub Actions, etc.). Inside the running
 * app the backup is wired through `instrumentation.ts` instead.
 *
 * Usage: `npm run backup:run`
 */
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stubPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "server-only-stub.cjs"
);
const resolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === "server-only") return stubPath;
  return resolveFilename.call(this, request, parent, isMain, options);
};

async function main() {
  const { runBackup } = await import("@/lib/backup/runner");
  console.log("[backup-script] starting…");
  const summary = await runBackup();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("[backup-script] failed", err);
  process.exit(1);
});
