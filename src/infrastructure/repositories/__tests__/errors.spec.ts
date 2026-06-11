import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  DatabaseError,
} from '../errors';

describe('NotFoundError', () => {
  it('should have the correct name and message', () => {
    const error = new NotFoundError('Resource not found');
    expect(error.name).toBe('NotFoundError');
    expect(error.message).toBe('Resource not found');
    expect(error.statusCode).toBe(404);
  });

  it('should be an instance of Error', () => {
    const error = new NotFoundError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ConflictError', () => {
  it('should have the correct name and message', () => {
    const error = new ConflictError('Resource already exists');
    expect(error.name).toBe('ConflictError');
    expect(error.message).toBe('Resource already exists');
    expect(error.statusCode).toBe(409);
  });

  it('should be an instance of Error', () => {
    const error = new ConflictError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('UnauthorizedError', () => {
  it('should have the correct name and message', () => {
    const error = new UnauthorizedError('Not authenticated');
    expect(error.name).toBe('UnauthorizedError');
    expect(error.message).toBe('Not authenticated');
    expect(error.statusCode).toBe(401);
  });

  it('should be an instance of Error', () => {
    const error = new UnauthorizedError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('DatabaseError', () => {
  it('should have the correct name, message, and default statusCode', () => {
    const error = new DatabaseError('Database connection failed');
    expect(error.name).toBe('DatabaseError');
    expect(error.message).toBe('Database connection failed');
    expect(error.statusCode).toBe(500);
  });

  it('should accept an optional cause', () => {
    const cause = new Error('Underlying cause');
    const error = new DatabaseError('DB error', cause);
    expect(error.cause).toBe(cause);
  });

  it('should be an instance of Error', () => {
    const error = new DatabaseError('test');
    expect(error).toBeInstanceOf(Error);
  });
});
