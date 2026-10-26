import type { Request, Response } from 'express';
import { parsePagination } from '../../lib/pagination';
import { idParams } from '../../lib/schemas';
import { input } from '../../middleware/validate';
import { createAccountBody } from './account.schemas';
import type { AccountService } from './account.service';

/** HTTP in, HTTP out. No business rules, no SQL. */
export class AccountController {
  constructor(private readonly service: AccountService) {}

  create = async (_req: Request, res: Response) => {
    const { body } = input<{ body: typeof createAccountBody }>(res);
    res.status(201).json(await this.service.create(body.name));
  };

  list = async (req: Request, res: Response) => {
    res.json(await this.service.list(parsePagination(req.query as Record<string, unknown>)));
  };

  getById = async (_req: Request, res: Response) => {
    const { params } = input<{ params: typeof idParams }>(res);
    res.json(await this.service.getById(params.id));
  };

  getBalance = async (_req: Request, res: Response) => {
    const { params } = input<{ params: typeof idParams }>(res);
    res.json(await this.service.getBalance(params.id));
  };
}
