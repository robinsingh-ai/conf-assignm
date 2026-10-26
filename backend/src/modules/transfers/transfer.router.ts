import { Router } from 'express';
import { idParams } from '../../lib/schemas';
import { validate } from '../../middleware/validate';
import type { TransferController } from './transfer.controller';
import { createTransferBody } from './transfer.schemas';

export function transferRouter(controller: TransferController): Router {
  const router = Router();
  router.post('/transfers', validate({ body: createTransferBody }), controller.create);
  router.get('/transfers/:id', validate({ params: idParams }), controller.getById);
  return router;
}
