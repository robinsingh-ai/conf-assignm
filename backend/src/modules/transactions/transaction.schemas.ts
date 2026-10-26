import { z } from 'zod';
import { amountSchema } from '../../lib/money';
import { description, referenceId } from '../../lib/schemas';

export const transactionType = z.enum(['credit', 'debit'], {
  errorMap: () => ({ message: 'type must be either "credit" or "debit"' }),
});

export const createTransactionBody = z
  .object({
    type: transactionType,
    amount: amountSchema,
    reference_id: referenceId,
    description,
  })
  .strict();

export type CreateTransactionInput = z.infer<typeof createTransactionBody>;

/** Only `type` is validated here; page/limit go through parsePagination. */
export const listTransactionsQuery = z
  .object({ type: transactionType.optional() })
  .passthrough();
