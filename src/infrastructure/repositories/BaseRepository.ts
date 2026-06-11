import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../database/database.types';
import { NotFoundError, ConflictError, UnauthorizedError, DatabaseError } from './errors';

export type OrderDirection = 'asc' | 'ascending' | 'desc' | 'descending';

export interface FindAllOptions {
  filters?: Record<string, unknown>;
  order?: { column: string; direction?: OrderDirection };
  limit?: number;
  range?: { from: number; to: number };
}

export class BaseRepository {
  constructor(
    protected readonly supabase: SupabaseClient<Database>,
    protected readonly tableName: string,
  ) {}

  /**
   * Require authenticated user. Returns userId or throws UnauthorizedError.
   */
  protected async requireUser(): Promise<string> {
    const { data, error } = await this.supabase.auth.getUser();
    if (error || !data?.user) {
      throw new UnauthorizedError('No autenticado');
    }
    return data.user.id;
  }

  /**
   * Map PostgREST/PG error codes to typed errors.
   */
  protected handleError(error: { code?: string; message: string; details?: string; hint?: string }): never {
    if (error.code === 'PGRST116') {
      throw new NotFoundError(error.message);
    }
    if (error.code === '23505') {
      throw new ConflictError(error.message);
    }
    throw new DatabaseError(error.message);
  }

  /**
   * Find all rows with optional filters, ordering, and pagination.
   */
  protected async findAll<T>(options?: FindAllOptions): Promise<T[]> {
    const result = await this.executeFindAll(options);

    if (result.error) {
      this.handleError(result.error);
    }

    return (result.data ?? []) as unknown as T[];
  }

  private async executeFindAll(options?: FindAllOptions) {
    const builder: any = this.supabase.from(this.tableName).select('*');
    let q = builder;

    if (options?.filters) {
      for (const [column, value] of Object.entries(options.filters)) {
        q = q.eq(column, value);
      }
    }
    if (options?.order) {
      q = q.order(options.order.column, {
        ascending: options.order.direction === undefined
          ? false
          : ['asc', 'ascending'].includes(options.order.direction),
      });
    }
    if (options?.limit !== undefined) {
      q = q.limit(options.limit);
    }
    if (options?.range) {
      q = q.range(options.range.from, options.range.to);
    }

    return await q;
  }

  /**
   * Find a single row by primary key `id`.
   */
  protected async findById<T>(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.handleError(error);
    }

    return data as unknown as T | null;
  }

  /**
   * Create a new entity. Auto-adds `user_id` and `created_at`.
   */
  protected async createEntity<T>(data: Record<string, unknown>): Promise<T> {
    const userId = await this.requireUser();

    const payload = {
      ...data,
      user_id: userId,
      created_at: new Date().toISOString(),
    };

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert([payload] as never)
      .select()
      .single();

    if (error) {
      this.handleError(error);
    }

    return result as unknown as T;
  }

  /**
   * Update an entity by primary key `id`. Auto-adds `updated_at`.
   */
  protected async updateEntity<T>(id: string, data: Record<string, unknown>): Promise<T> {
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update(payload as never)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.handleError(error);
    }

    return result as unknown as T;
  }

  /**
   * Delete an entity by primary key `id`.
   */
  protected async deleteEntity(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      this.handleError(error);
    }
  }
}
