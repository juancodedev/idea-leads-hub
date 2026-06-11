import { BaseRepository } from '../BaseRepository';
import { NotFoundError, ConflictError, DatabaseError } from '../errors';

class TestRepo extends BaseRepository {
  constructor(supabase: any) {
    super(supabase, 'test_table');
  }

  async pubFindAll(options?: any) { return this.findAll(options); }
  async pubFindById(id: string) { return this.findById(id); }
  async pubCreateEntity(data: any) { return this.createEntity(data); }
  async pubUpdateEntity(id: string, data: any) { return this.updateEntity(id, data); }
  async pubRequireUser() { return this.requireUser(); }
  pubHandleError(error: any) { return this.handleError(error); }
}

function createMockQuery() {
  const chained: any = {};
  chained.select = jest.fn(() => chained);
  chained.eq = jest.fn(() => chained);
  chained.order = jest.fn(() => chained);
  chained.limit = jest.fn(() => chained);
  chained.range = jest.fn(() => chained);
  chained.maybeSingle = jest.fn(() => chained);
  chained.insert = jest.fn(() => chained);
  chained.update = jest.fn(() => chained);
  chained.delete = jest.fn(() => chained);
  chained.single = jest.fn(() => chained);
  return chained;
}

describe('BaseRepository', () => {
  let mockSupabase: any;
  let repo: TestRepo;
  let query: any;

  beforeEach(() => {
    query = createMockQuery();
    mockSupabase = {
      auth: { getUser: jest.fn() },
      from: jest.fn(() => query),
    };
    repo = new TestRepo(mockSupabase);
  });

  describe('requireUser', () => {
    it('should return userId when authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
      expect(await repo.pubRequireUser()).toBe('user-1');
    });

    it('should throw UnauthorizedError when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(repo.pubRequireUser()).rejects.toThrow('No autenticado');
    });
  });

  describe('handleError', () => {
    it('should throw NotFoundError for PGRST116', () => {
      expect(() => repo.pubHandleError({ code: 'PGRST116', message: 'x', details: '', hint: '' })).toThrow(NotFoundError);
    });

    it('should throw ConflictError for 23505', () => {
      expect(() => repo.pubHandleError({ code: '23505', message: 'x', details: '', hint: '' })).toThrow(ConflictError);
    });

    it('should throw DatabaseError for unknown codes', () => {
      expect(() => repo.pubHandleError({ code: 'XXX', message: 'x', details: '', hint: '' })).toThrow(DatabaseError);
    });
  });

  describe('findAll', () => {
    it('should return all rows', async () => {
      query.select.mockResolvedValue({ data: [{ id: '1' }], error: null });
      const result = await repo.pubFindAll();
      expect(result).toEqual([{ id: '1' }]);
    });

    it('should throw DatabaseError on query error', async () => {
      query.select.mockResolvedValue({ data: null, error: { code: '42P01', message: 'err', details: '', hint: '' } });
      await expect(repo.pubFindAll()).rejects.toThrow(DatabaseError);
    });
  });

  describe('findById', () => {
    it('should return a row when found', async () => {
      query.maybeSingle.mockResolvedValue({ data: { id: 'abc' }, error: null });
      const result = await repo.pubFindById('abc');
      expect(result).toEqual({ id: 'abc' });
      expect(query.eq).toHaveBeenCalledWith('id', 'abc');
    });

    it('should return null when not found', async () => {
      query.maybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await repo.pubFindById('missing');
      expect(result).toBeNull();
    });
  });

  describe('createEntity', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    });

    it('should insert data with user_id and created_at', async () => {
      query.single.mockResolvedValue({ data: { id: 'new-id' }, error: null });
      const result = await repo.pubCreateEntity({ name: 'Foo' });
      expect(result).toEqual({ id: 'new-id' });
      expect(query.insert).toHaveBeenCalledWith(
        [expect.objectContaining({ name: 'Foo', user_id: 'user-1', created_at: expect.any(String) })]
      );
    });

    it('should throw UnauthorizedError when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(repo.pubCreateEntity({ name: 'Foo' })).rejects.toThrow('No autenticado');
    });
  });

  describe('updateEntity', () => {
    it('should update data with updated_at', async () => {
      query.single.mockResolvedValue({ data: { id: 'abc' }, error: null });
      const result = await repo.pubUpdateEntity('abc', { name: 'Updated' });
      expect(result).toEqual({ id: 'abc' });
      expect(query.eq).toHaveBeenCalledWith('id', 'abc');
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated', updated_at: expect.any(String) })
      );
    });

    it('should throw ConflictError on duplicate key', async () => {
      query.single.mockResolvedValue({ data: null, error: { code: '23505', message: 'dup', details: '', hint: '' } });
      await expect(repo.pubUpdateEntity('abc', { name: 'X' })).rejects.toThrow(ConflictError);
    });
  });
});
