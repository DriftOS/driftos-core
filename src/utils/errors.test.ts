import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  formatErrorResponse,
} from './errors';

describe('AppError', () => {
  it('creates error with default values', () => {
    const error = new AppError('Something went wrong');
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('creates error with custom values', () => {
    const details = { field: 'email' };
    const error = new AppError('Custom error', 418, false, details);
    expect(error.message).toBe('Custom error');
    expect(error.statusCode).toBe(418);
    expect(error.isOperational).toBe(false);
    expect(error.details).toEqual(details);
  });

  it('is an instance of Error', () => {
    const error = new AppError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ValidationError', () => {
  it('has status code 400', () => {
    const error = new ValidationError('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ValidationError');
    expect(error.isOperational).toBe(true);
  });

  it('accepts details', () => {
    const details = { fields: ['email', 'password'] };
    const error = new ValidationError('Validation failed', details);
    expect(error.details).toEqual(details);
  });
});

describe('NotFoundError', () => {
  it('has status code 404 with default message', () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Resource not found');
    expect(error.name).toBe('NotFoundError');
  });

  it('accepts custom message', () => {
    const error = new NotFoundError('User not found');
    expect(error.message).toBe('User not found');
  });
});

describe('UnauthorizedError', () => {
  it('has status code 401 with default message', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Unauthorized');
    expect(error.name).toBe('UnauthorizedError');
  });
});

describe('ForbiddenError', () => {
  it('has status code 403 with default message', () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Forbidden');
    expect(error.name).toBe('ForbiddenError');
  });
});

describe('ConflictError', () => {
  it('has status code 409', () => {
    const error = new ConflictError('Resource already exists');
    expect(error.statusCode).toBe(409);
    expect(error.name).toBe('ConflictError');
  });

  it('accepts details', () => {
    const error = new ConflictError('Duplicate', { existingId: '123' });
    expect(error.details).toEqual({ existingId: '123' });
  });
});

describe('RateLimitError', () => {
  it('has status code 429 with default message', () => {
    const error = new RateLimitError();
    expect(error.statusCode).toBe(429);
    expect(error.message).toBe('Too many requests');
    expect(error.name).toBe('RateLimitError');
  });
});

describe('formatErrorResponse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats AppError correctly', () => {
    const error = new ValidationError('Invalid email', { field: 'email' });
    const response = formatErrorResponse(error, '/api/users', 'req-123');

    expect(response).toEqual({
      success: false,
      error: {
        message: 'Invalid email',
        code: 'ValidationError',
        statusCode: 400,
        details: { field: 'email' },
        timestamp: '2024-01-15T12:00:00.000Z',
        path: '/api/users',
        requestId: 'req-123',
      },
    });
  });

  it('formats generic Error with status 500', () => {
    const error = new Error('Something broke');
    const response = formatErrorResponse(error);

    expect(response.success).toBe(false);
    expect(response.error.statusCode).toBe(500);
    expect(response.error.message).toBe('Something broke');
    expect(response.error.details).toBeUndefined();
  });

  it('includes optional path and requestId when provided', () => {
    const error = new AppError('Test');
    const response = formatErrorResponse(error, '/test', 'abc-123');

    expect(response.error.path).toBe('/test');
    expect(response.error.requestId).toBe('abc-123');
  });

  it('omits path and requestId when not provided', () => {
    const error = new AppError('Test');
    const response = formatErrorResponse(error);

    expect(response.error.path).toBeUndefined();
    expect(response.error.requestId).toBeUndefined();
  });
});
