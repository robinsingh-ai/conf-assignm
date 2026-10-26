import { Router } from 'express';
import { idParams } from '../../lib/schemas';
import { validate } from '../../middleware/validate';
import type { AccountController } from './account.controller';
import { createAccountBody } from './account.schemas';

export function accountRouter(controller: AccountController): Router {
  const router = Router();

  router.post('/accounts', validate({ body: createAccountBody }), controller.create);
  router.get('/accounts', controller.list);
  router.get('/accounts/:id', validate({ params: idParams }), controller.getById);
  router.get('/accounts/:id/balance', validate({ params: idParams }), controller.getBalance);

  return router;
}
