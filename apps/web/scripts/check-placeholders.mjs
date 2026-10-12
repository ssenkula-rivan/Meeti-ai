// Fails when a legal/contact placeholder ([SET: ...]) is still present in the
// rendered HTML output. It scans prerendered .html files only, because the
// [SET: marker is generated at runtime by lib/site-config.ts and would otherwise
// appear in the JS bundle even after every field has been filled in.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['.next', '.open-next'];
const PATTERN = /\[SET:/;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(full);
    else if (name.endsWith('.html')) yield full;
  }
}

const offenders = [];
for (const root of roots) {
  for (const file of walk(root)) {
    if (PATTERN.test(readFileSync(file, 'utf8'))) offenders.push(file);
  }
}

if (offenders.length) {
  console.error(
    `\nplaceholder check FAILED: ${offenders.length} built page(s) still contain [SET: ...].`,
  );
  console.error('Fill the remaining fields in apps/web/lib/site-config.ts.\n');
  for (const f of offenders) console.error('  ' + f);
  process.exit(1);
}

console.log('placeholder check passed: no [SET: markers in built HTML.');
