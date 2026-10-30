import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from './auth';
import { config } from '../config';
import { AppError } from './error-handler';

// authenticate only reads the Authorization header and calls next()/throws;
// it never touches the response, so a stub res is enough to unit-test it.
function run(header?: string) {
  const req = { headers: header ? { authorization: header } : {} } as unknown as AuthRequest;
  const next = vi.fn();
  authenticate(req, {} as never, next);
  return { req, next };
}

function captureThrow(fn: () => void): AppError {
  try {
    fn();
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected authenticate() to throw');
}

describe('authenticate', () => {
  it('throws 401 when there is no Authorization header', () => {
    const err = captureThrow(() => run());
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it('throws 401 when the header is not a Bearer token', () => {
    const err = captureThrow(() => run('Basic abc123'));
    expect(err.statusCode).toBe(401);
    expect(err.message).toMatch(/Authentication required/);
  });

  it('accepts a valid token and attaches the userId', () => {
    const token = jwt.sign({ userId: 'user-123' }, config.jwt.secret);
    const { req, next } = run(`Bearer ${token}`);
    expect(req.userId).toBe('user-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws 401 for a token signed with the wrong secret (cannot forge identity)', () => {
    const token = jwt.sign({ userId: 'attacker' }, 'not-the-real-secret');
    const err = captureThrow(() => run(`Bearer ${token}`));
    expect(err.statusCode).toBe(401);
    expect(err.message).toMatch(/Invalid or expired/);
  });

  it('throws 401 for an expired token', () => {
    const token = jwt.sign({ userId: 'user-1' }, config.jwt.secret, { expiresIn: '-1s' });
    const err = captureThrow(() => run(`Bearer ${token}`));
    expect(err.statusCode).toBe(401);
  });
});
