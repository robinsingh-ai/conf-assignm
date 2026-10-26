import type { RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ValidationError, type ValidationIssue } from '../lib/errors';

type Part = 'params' | 'query' | 'body';

export interface Schemas {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
}

export type Validated<S extends Schemas> = {
  [K in keyof S as S[K] extends ZodTypeAny ? K : never]: S[K] extends ZodTypeAny ? z.infer<S[K]> : never;
};

/**
 * Validates the request at the boundary and stores the *parsed* values on
 * `res.locals.input`. Controllers read trusted, typed data from there and never
 * look at `req.body`/`req.query` directly. All issues across params, query and
 * body are collected into one 400 so the client can fix everything at once.
 */
export function validate<S extends Schemas>(schemas: S): RequestHandler {
  return (req, res, next) => {
    const issues: ValidationIssue[] = [];
    const input: Partial<Record<Part, unknown>> = {};

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        input[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ path: [part, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) return next(new ValidationError(issues));
    res.locals.input = input;
    next();
  };
}

export function input<S extends Schemas>(res: Response): Validated<S> {
  return res.locals.input as Validated<S>;
}
