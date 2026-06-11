export class NotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  public readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class DatabaseError extends Error {
  public readonly statusCode = 500;

  constructor(message: string, cause?: Error) {
    super(message, cause ? { cause } : undefined);
    this.name = 'DatabaseError';
  }
}
