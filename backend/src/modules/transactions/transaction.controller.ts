import type { Request, Response } from 'express';
import { parsePagination } from '../../lib/pagination';
import { idParams } from '../../lib/schemas';
import { input } from '../../middleware/validate';
import { createTransactionBody, listTransactionsQuery } from './transaction.schemas';
import type { TransactionService } from './transaction.service';

export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  create = async (_req: Request, res: Response) => {
    const { params, body } = input<{ params: typeof idParams; body: typeof createTransactionBody }>(res);
    const created = await this.service.create({
      accountId: params.id,
      type: body.type,
      amount: body.amount,
      referenceId: body.reference_id,
      description: body.description,
    });
    res.status(201).json(created);
  };

  listForAccount = async (req: Request, res: Response) => {
    const { params, query } = input<{ params: typeof idParams; query: typeof listTransactionsQuery }>(res);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    res.json(await this.service.listForAccount(params.id, query.type, pagination));
  };

  getById = async (_req: Request, res: Response) => {
    const { params } = input<{ params: typeof idParams }>(res);
    res.json(await this.service.getById(params.id));
  };
}
