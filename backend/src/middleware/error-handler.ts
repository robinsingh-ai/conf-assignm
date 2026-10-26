import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, InvalidJsonError } from '../lib/errors';
import { logger } from '../lib/logger';

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

/**
 * The single place where errors become HTTP responses. Everything the client
 * sees goes through here, which is what guarantees a consistent envelope.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Malformed JSON body (raised by express.json before any route runs).
  if ((err as BodyParserError).type === 'entity.parse.failed') {
    const e = new InvalidJsonError();
    res.status(e.status).json(e.toJSON());
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json(err.toJSON());
    return;
  }

  // A unique violation that escaped a service (should not happen; services map
  // it to DuplicateTransactionError) still gets a sane 409 rather than a 500.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({
      error: { code: 'DUPLICATE_TRANSACTION', message: 'Resource already exists' },
    });
    return;
  }

  logger.error({ err, path: req.originalUrl, method: req.method, requestId: req.id }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Nothing was persisted.',
    },
  });
};
