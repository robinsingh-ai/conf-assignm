import { z } from 'zod';

/** Shared request fragments used by more than one module. */
export const uuid = z.string().uuid('must be a valid UUID');

export const idParams = z.object({ id: uuid });

export const referenceId = z
  .string({ required_error: 'reference_id is required' })
  .trim()
  .min(1, 'reference_id is required')
  .max(100, 'reference_id must be at most 100 characters');

export const description = z
  .string()
  .trim()
  .max(255, 'description must be at most 255 characters')
  .optional();
