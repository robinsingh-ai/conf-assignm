import { z } from 'zod';
import { amountSchema } from '../../lib/money';
import { description, referenceId, uuid } from '../../lib/schemas';

export const createTransferBody = z
  .object({
    from_account_id: uuid,
    to_account_id: uuid,
    amount: amountSchema,
    reference_id: referenceId,
    description,
  })
  .strict();

export type CreateTransferInput = z.infer<typeof createTransferBody>;
