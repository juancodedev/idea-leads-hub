/**
 * Schema drift detection between the app's database contract and production.
 *
 * `src/infrastructure/database/database.types.ts` is the hand-written contract
 * the whole codebase is typed against. If production is missing a table or a
 * column that this contract declares, the app compiles and deploys fine and
 * then fails at runtime (PostgREST answers PGRST204 / 404). That is exactly how
 * the CRM integration shipped broken: the code wrote six columns the database
 * did not have yet.
 *
 * These helpers are pure so the deploy gate can be tested without a database.
 */

export interface DbContract {
  /** Table name -> column names. */
  tables: Record<string, string[]>;
}

export interface SchemaDiff {
  missingTables: string[];
  missingColumns: Array<{ table: string; column: string }>;
}

const TABLES_BLOCK = /^ {4}Tables: \{$/;
const TABLE_DECLARATION = /^ {6}([A-Za-z0-9_]+): \{$/;
const ROW_OPEN = /^ {8}Row: \{$/;
const ROW_CLOSE = '        };';
const COLUMN_DECLARATION = /^ {10}([A-Za-z0-9_]+)\??: /;
const TABLES_CLOSE = /^ {4}\};$/;

/**
 * Read the table/column map out of the generated `Database` interface.
 * Throws when the file shape is not recognised, so a refactor cannot silently
 * turn the gate into a no-op.
 */
export function parseDatabaseContract(source: string): DbContract {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => TABLES_BLOCK.test(line));

  if (start === -1) {
    throw new Error('Could not find the `Tables` block in database.types.ts');
  }

  const tables: Record<string, string[]> = {};
  let currentTable: string | null = null;
  let insideRow = false;

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (TABLES_CLOSE.test(line)) break;

    const table = TABLE_DECLARATION.exec(line);
    if (table) {
      currentTable = table[1];
      tables[currentTable] = [];
      insideRow = false;
      continue;
    }

    if (currentTable && ROW_OPEN.test(line)) {
      insideRow = true;
      continue;
    }

    if (insideRow && line === ROW_CLOSE) {
      insideRow = false;
      continue;
    }

    if (insideRow && currentTable) {
      const column = COLUMN_DECLARATION.exec(line);
      if (column) tables[currentTable].push(column[1]);
    }
  }

  if (Object.keys(tables).length === 0) {
    throw new Error('Parsed no tables out of database.types.ts; the file format changed');
  }

  return { tables };
}

/**
 * Read table/column names out of the PostgREST root OpenAPI document
 * (`GET /rest/v1/`), which reflects the schema production actually serves.
 */
export function parsePostgrestSpec(spec: unknown): DbContract {
  const definitions = (spec as { definitions?: Record<string, unknown> } | null)?.definitions;

  if (!definitions || typeof definitions !== 'object') {
    throw new Error('Response has no `definitions`; expected the PostgREST root spec at /rest/v1/');
  }

  const tables: Record<string, string[]> = {};
  for (const [table, definition] of Object.entries(definitions)) {
    const properties = (definition as { properties?: Record<string, unknown> } | null)?.properties;
    tables[table] = Object.keys(properties ?? {});
  }

  return { tables };
}

/** Contract entries that production does not serve. */
export function diffContract(expected: DbContract, actual: DbContract): SchemaDiff {
  const missingTables = Object.keys(expected.tables)
    .filter((table) => !(table in actual.tables))
    .sort();

  const missingColumns: SchemaDiff['missingColumns'] = [];
  for (const [table, columns] of Object.entries(expected.tables)) {
    const served = actual.tables[table];
    if (!served) continue;
    const available = new Set(served);
    for (const column of columns) {
      if (!available.has(column)) missingColumns.push({ table, column });
    }
  }

  return { missingTables, missingColumns };
}

export function isInSync(diff: SchemaDiff): boolean {
  return diff.missingTables.length === 0 && diff.missingColumns.length === 0;
}
