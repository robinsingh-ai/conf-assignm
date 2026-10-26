import type { Request, Response } from 'express';
import { idParams } from '../../lib/schemas';
import { input } from '../../middleware/validate';
import { createTransferBody } from './transfer.schemas';
import type { TransferService } from './transfer.service';

export class TransferController {
  constructor(private readonly service: TransferService) {}

  create = async (_req: Request, res: Response) => {
    const { body } = input<{ body: typeof createTransferBody }>(res);
    const created = await this.service.create({
      fromAccountId: body.from_account_id,
      toAccountId: body.to_account_id,
      amount: body.amount,
      referenceId: body.reference_id,
      description: body.description,
    });
    res.status(201).json(created);
  };

  getById = async (_req: Request, res: Response) => {
    const { params } = input<{ params: typeof idParams }>(res);
    res.json(await this.service.getById(params.id));
  };
}
