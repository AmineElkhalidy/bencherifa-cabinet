const path = require('path');
const deps = new Set();
function walk(p) {
  try {
    const pkg = require(path.join(p, 'package.json'));
    for (const d of Object.keys(pkg.dependencies || {})) {
      if (!deps.has(d)) {
        deps.add(d);
        try {
          const resolved = require.resolve(d + '/package.json').replace(/[/\\]package\.json$/, '');
          walk(resolved);
        } catch {}
      }
    }
  } catch {}
}
walk(path.resolve('./node_modules/prisma'));
console.log([...deps].sort().join('\n'));
