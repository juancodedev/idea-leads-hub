/**
 * `search()` filters for integrations that poll the CRM for changes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseLeadRepository } from '../SupabaseLeadRepository';
import type { Database } from '../../database/database.types';

interface Recorded {
  method: string;
  args: unknown[];
}

/** Chainable stand-in for the PostgREST query builder. */
class FakeQuery {
  readonly calls: Recorded[] = [];

  constructor(private readonly result: unknown = { data: [], error: null, count: 0 }) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
  }

  or(...args: unknown[]) {
    this.calls.push({ method: 'or', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
  }

  gte(...args: unknown[]) {
    this.calls.push({ method: 'gte', args });
    return this;
  }

  order(...args: unknown[]) {
    this.calls.push({ method: 'order', args });
    return this;
  }

  range(...args: unknown[]) {
    this.calls.push({ method: 'range', args });
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onFulfilled, onRejected);
  }
}

function repoWith(query: FakeQuery): SupabaseLeadRepository {
  const supabase = {
    from: jest.fn(() => query),
    auth: { getUser: jest.fn() },
  } as unknown as SupabaseClient<Database>;

  return new SupabaseLeadRepository(supabase);
}

describe('SupabaseLeadRepository.search — updatedSince', () => {
  it('filters by status_changed_at, not updated_at', async () => {
    const query = new FakeQuery();
    await repoWith(query).search({ updatedSince: '2026-11-12T00:00:00Z' });

    expect(query.calls).toContainEqual({
      method: 'gte',
      args: ['status_changed_at', '2026-11-12T00:00:00Z'],
    });
    // A Prospector push of contact data must not count as a CRM change.
    expect(query.calls.some((c) => c.method === 'gte' && c.args[0] === 'updated_at')).toBe(false);
  });

  it('reads forward by default, so a cursor pages without gaps', async () => {
    const query = new FakeQuery();
    await repoWith(query).search({ updatedSince: '2026-11-12T00:00:00Z' });

    expect(query.calls).toContainEqual({
      method: 'order',
      args: ['status_changed_at', { ascending: true }],
    });
  });

  it('keeps the newest-first default when no instant is given', async () => {
    const query = new FakeQuery();
    await repoWith(query).search({});

    expect(query.calls).toContainEqual({
      method: 'order',
      args: ['created_at', { ascending: false }],
    });
    expect(query.calls.some((c) => c.method === 'gte')).toBe(false);
  });

  it('honors an explicit sort and order over the polling default', async () => {
    const query = new FakeQuery();
    await repoWith(query).search({
      updatedSince: '2026-11-12T00:00:00Z',
      sort: 'createdAt',
      order: 'desc',
    });

    expect(query.calls).toContainEqual({
      method: 'order',
      args: ['created_at', { ascending: false }],
    });
  });

  it('combines the source and status filters with the instant', async () => {
    const query = new FakeQuery();
    await repoWith(query).search({
      source: 'Prospector',
      status: 'Perdido',
      updatedSince: '2026-11-12T00:00:00Z',
    });

    expect(query.calls).toContainEqual({ method: 'eq', args: ['status', 'Perdido'] });
    expect(query.calls).toContainEqual({ method: 'eq', args: ['source', 'Prospector'] });
    expect(query.calls).toContainEqual({
      method: 'gte',
      args: ['status_changed_at', '2026-11-12T00:00:00Z'],
    });
  });
});