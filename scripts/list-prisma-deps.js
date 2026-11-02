import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const req = createRequire(import.meta.url);
const deps = new Set();

function walk(p) {
  try {
    const pkgPath = path.join(p, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    for (const d of Object.keys(pkg.dependencies || {})) {
      if (!deps.has(d)) {
        deps.add(d);
        try {
          const resolved = req
            .resolve(`${d}/package.json`)
            .replace(/[/\\]package\.json$/, "");
          walk(resolved);
        } catch {
          // Ignore unresolvable optional sub-dependencies
        }
      }
    }
  } catch {
    // Ignore unreadable package directories
  }
}

walk(path.resolve("./node_modules/prisma"));
console.log([...deps].sort().join("\n"));
