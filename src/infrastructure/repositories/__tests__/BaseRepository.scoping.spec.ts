/**
 * API-key requests run on the service-role client, which bypasses RLS. These
 * helpers are the only thing that keeps those queries scoped to the key owner.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '../BaseRepository';
import { Database } from '../../database/database.types';

interface Recorded {
  method: string;
  args: unknown[];
}

/** Minimal thenable stand-in for the PostgREST query builder. */
class FakeQuery {
  readonly calls: Recorded[] = [];

  constructor(private readonly result: unknown = { data: null, error: null }) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
  }

  maybeSingle() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onFulfilled, onRejected);
  }
}

function fakeSupabase(user: { id: string } | null = { id: 'session-user' }) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'no session' },
      }),
    },
  } as unknown as SupabaseClient<Database>;
}

class TestRepository extends BaseRepository {
  constructor(supabase: SupabaseClient<Database>, scopedUserId?: string) {
    super(supabase, 'leads', scopedUserId);
  }

  scope<T>(query: T): T {
    return this.scopeToUser(query);
  }

  resolve(): Promise<string> {
    return this.resolveUserId();
  }
}

describe('BaseRepository — machine-path scoping', () => {
  it('uses the scoped user without asking for a session', async () => {
    const supabase = fakeSupabase(null);
    const repo = new TestRepository(supabase, 'key-owner');

    await expect(repo.resolve()).resolves.toBe('key-owner');
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('falls back to the session user on RLS paths', async () => {
    const repo = new TestRepository(fakeSupabase());

    await expect(repo.resolve()).resolves.toBe('session-user');
  });

  it('filters every query by user_id when a key owner is set', () => {
    const repo = new TestRepository(fakeSupabase(), 'key-owner');
    const query = new FakeQuery();

    repo.scope(query);

    expect(query.calls).toEqual([{ method: 'eq', args: ['user_id', 'key-owner'] }]);
  });

  it('leaves queries untouched on session paths, where RLS scopes them', () => {
    const repo = new TestRepository(fakeSupabase());
    const query = new FakeQuery();

    repo.scope(query);

    expect(query.calls).toEqual([]);
  });
});
