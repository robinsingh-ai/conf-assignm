import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/** Single PrismaClient for the process; Prisma manages the connection pool. */
export const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace' ? ['query', 'warn', 'error'] : ['warn'],
});

/**
 * Anything that can run queries: the root client or a transaction client.
 * Repositories accept this so a service can compose several repository calls
 * inside one `prisma.$transaction` (the Unit of Work).
 */
export type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Interactive transaction options. `maxWait` is how long a request may wait for
 * a pooled connection; `timeout` bounds the transaction itself. Both are generous
 * because requests against one hot account queue on its row lock by design.
 */
export const TX_OPTIONS: { maxWait: number; timeout: number } = { maxWait: 10_000, timeout: 20_000 };

/** True when `err` is PostgreSQL unique-violation (23505) surfaced by Prisma as P2002. */
export function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
