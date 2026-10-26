import { z } from 'zod';
import { InvalidPaginationError } from './errors';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

const paginationSchema = z.object({
  page: z.coerce.number({ invalid_type_error: 'page must be an integer' }).int('page must be an integer').min(1, 'page must be >= 1').default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'limit must be an integer' })
    .int('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(MAX_LIMIT, `limit must be <= ${MAX_LIMIT}`)
    .default(DEFAULT_LIMIT),
});

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
}

/**
 * Parses `page`/`limit` from a raw query object. Invalid values are a client
 * error (400 INVALID_PAGINATION) rather than silently clamped: clamping hides bugs.
 */
export function parsePagination(query: Record<string, unknown>): Pagination {
  const candidate: Record<string, unknown> = {};
  if (query.page !== undefined) candidate.page = query.page;
  if (query.limit !== undefined) candidate.limit = query.limit;

  const result = paginationSchema.safeParse(candidate);
  if (!result.success) {
    throw new InvalidPaginationError(
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const { page, limit } = result.data;
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginationMeta(p: Pagination, total: number): PaginationMeta {
  return {
    page: p.page,
    limit: p.limit,
    total_records: total,
    total_pages: Math.ceil(total / p.limit),
  };
}

export interface Page<T> {
  data: T[];
  pagination: PaginationMeta;
}
