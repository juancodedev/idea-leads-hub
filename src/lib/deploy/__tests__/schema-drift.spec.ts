/**
 * @jest-environment node
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  diffContract,
  isInSync,
  parseDatabaseContract,
  parsePostgrestSpec,
} from '../schema-drift';

const CONTRACT_SOURCE = readFileSync(
  join(process.cwd(), 'src/infrastructure/database/database.types.ts'),
  'utf8'
);

const TYPES_SOURCE = `
export interface Database {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          email: string | null;
          external_id: string | null;
        };
        Insert: {
          id?: string;
          email?: string | null;
          not_a_column: string;
        };
        Update: {
          id?: string;
        };
      };
      api_keys: {
        Row: {
          id: string;
          key_hash: string;
        };
      };
    };
    Enums: {};
  };
}
`;

function spec(definitions: Record<string, string[]>) {
  return {
    swagger: '2.0',
    definitions: Object.fromEntries(
      Object.entries(definitions).map(([table, columns]) => [
        table,
        {
          type: 'object',
          properties: Object.fromEntries(columns.map((column) => [column, { format: column }])),
        },
      ])
    ),
  };
}

describe('parseDatabaseContract', () => {
  it('reads only the Row columns of each table', () => {
    const contract = parseDatabaseContract(TYPES_SOURCE);

    expect(contract.tables).toEqual({
      leads: ['id', 'email', 'external_id'],
      api_keys: ['id', 'key_hash'],
    });
    expect(contract.tables.leads).not.toContain('not_a_column');
  });

  it('reads the real database.types.ts of this repo', () => {
    const contract = parseDatabaseContract(CONTRACT_SOURCE);

    // Tables the CRM code depends on.
    expect(Object.keys(contract.tables)).toEqual(
      expect.arrayContaining(['leads', 'ideas', 'activities', 'api_keys'])
    );
    // Columns added by the integration migration.
    expect(contract.tables.leads).toEqual(
      expect.arrayContaining([
        'external_id',
        'city',
        'industry',
        'opportunity_score',
        'rating',
        'reviews_count',
      ])
    );
    // Insert/Update-only keys must not leak in as columns.
    expect(contract.tables.leads).not.toContain('created_at_optional');
  });

  it('refuses to silently return nothing when the file format changes', () => {
    expect(() => parseDatabaseContract('export interface Database {}')).toThrow(
      /Could not find the `Tables` block/
    );
    expect(() => parseDatabaseContract('    Tables: {\n    };')).toThrow(/Parsed no tables/);
  });
});

describe('parsePostgrestSpec', () => {
  it('maps definitions to table/column lists', () => {
    const parsed = parsePostgrestSpec(spec({ leads: ['id', 'email'], api_keys: ['id'] }));

    expect(parsed.tables).toEqual({ leads: ['id', 'email'], api_keys: ['id'] });
  });

  it('rejects a response that is not the PostgREST root spec', () => {
    expect(() => parsePostgrestSpec({ message: 'not found' })).toThrow(/no `definitions`/);
    expect(() => parsePostgrestSpec(null)).toThrow(/no `definitions`/);
  });
});

describe('diffContract', () => {
  const expected = parseDatabaseContract(TYPES_SOURCE);

  it('reports nothing when production serves the whole contract', () => {
    const diff = diffContract(
      expected,
      parsePostgrestSpec(spec({ leads: ['id', 'email', 'external_id'], api_keys: ['id', 'key_hash'] }))
    );

    expect(diff).toEqual({ missingTables: [], missingColumns: [] });
    expect(isInSync(diff)).toBe(true);
  });

  it('reports a table production does not have', () => {
    const diff = diffContract(expected, parsePostgrestSpec(spec({ leads: ['id', 'email', 'external_id'] })));

    expect(diff.missingTables).toEqual(['api_keys']);
    expect(isInSync(diff)).toBe(false);
  });

  it('reports the columns that are missing, table by table', () => {
    const diff = diffContract(
      expected,
      parsePostgrestSpec(spec({ leads: ['id'], api_keys: ['id'] }))
    );

    expect(diff.missingColumns).toEqual([
      { table: 'leads', column: 'email' },
      { table: 'leads', column: 'external_id' },
      { table: 'api_keys', column: 'key_hash' },
    ]);
  });

  it('ignores extra tables and columns that production exposes', () => {
    const diff = diffContract(
      expected,
      parsePostgrestSpec(
        spec({
          leads: ['id', 'email', 'external_id', 'legacy_column'],
          api_keys: ['id', 'key_hash'],
          analytics_events: ['id'],
        })
      )
    );

    expect(isInSync(diff)).toBe(true);
  });
});
