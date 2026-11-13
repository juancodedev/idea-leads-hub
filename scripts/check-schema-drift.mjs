/**
 * Deploy gate: fails when production does not serve the schema the app is
 * typed against.
 *
 * Merging to main deploys instantly, so a migration that was never applied
 * ships broken code to production. This compares
 * `src/infrastructure/database/database.types.ts` (the app's contract) with the
 * PostgREST root spec of the target project (the schema it actually serves).
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-schema-drift.mjs
 *
 *   node scripts/check-schema-drift.mjs --spec ./spec.json   # offline check
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  diffContract,
  isInSync,
  parseDatabaseContract,
  parsePostgrestSpec,
} from '../src/lib/deploy/schema-drift.ts';

const CONTRACT_PATH = join(process.cwd(), 'src/infrastructure/database/database.types.ts');

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

async function loadProductionSpec() {
  const specArgIndex = process.argv.indexOf('--spec');
  if (specArgIndex !== -1) {
    const path = process.argv[specArgIndex + 1];
    if (!path) fail('--spec needs a file path');
    return JSON.parse(await readFile(path, 'utf8'));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to inspect production');
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
  });

  if (!response.ok) {
    fail(`PostgREST returned ${response.status} for the root spec of ${url}`);
  }

  return response.json();
}

const contract = parseDatabaseContract(await readFile(CONTRACT_PATH, 'utf8'));
const production = parsePostgrestSpec(await loadProductionSpec());
const diff = diffContract(contract, production);

if (!isInSync(diff)) {
  const problems = [
    ...diff.missingTables.map((table) => `table ${table}`),
    ...diff.missingColumns.map(({ table, column }) => `${table}.${column}`),
  ];

  console.error(`::error::Production is missing ${problems.length} schema object(s) the app requires:`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('Apply the migrations before deploying: supabase db push');
  console.error('If a migration was applied by hand, record it: supabase migration repair --status applied <version>');
  process.exit(1);
}

const tableCount = Object.keys(contract.tables).length;
console.log(`Production schema matches the app contract (${tableCount} tables checked).`);
