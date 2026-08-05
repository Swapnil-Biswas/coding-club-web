// Tiny error class + asyncHandler. Lets route handlers throw HttpError(403, '...')
// and have it surface as a proper JSON response without try/catch noise.

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<unknown>;

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
