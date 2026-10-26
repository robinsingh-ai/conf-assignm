import { Router } from 'express';
import { idParams } from '../../lib/schemas';
import { validate } from '../../middleware/validate';
import type { TransactionController } from './transaction.controller';
import { createTransactionBody, listTransactionsQuery } from './transaction.schemas';

/**
 * Deliberately no PUT/PATCH/DELETE: transactions are immutable. Those verbs fall
 * through to the 404 handler. The database trigger enforces the same rule below the API.
 */
export function transactionRouter(controller: TransactionController): Router {
  const router = Router();

  router.post(
    '/accounts/:id/transactions',
    validate({ params: idParams, body: createTransactionBody }),
    controller.create,
  );
  router.get(
    '/accounts/:id/transactions',
    validate({ params: idParams, query: listTransactionsQuery }),
    controller.listForAccount,
  );
  router.get('/transactions/:id', validate({ params: idParams }), controller.getById);

  return router;
}
