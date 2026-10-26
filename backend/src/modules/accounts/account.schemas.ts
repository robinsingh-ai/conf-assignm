import { z } from 'zod';

/**
 * `.strict()` rejects unknown keys. The brief says the client must not set the
 * initial balance; failing loudly on `balance` beats silently ignoring it.
 */
export const createAccountBody = z
  .object({
    name: z
      .string({ required_error: 'name is required', invalid_type_error: 'name must be a string' })
      .trim()
      .min(1, 'name is required')
      .max(100, 'name must be at most 100 characters'),
  })
  .strict();

export type CreateAccountInput = z.infer<typeof createAccountBody>;
