import type { Prisma, Transfer } from '@prisma/client';
import type { Money } from '../../lib/money';
import type { DbClient } from '../../lib/prisma';

export type TransferWithLegs = Prisma.TransferGetPayload<{ include: { transactions: true } }>;

export interface NewTransfer {
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
  referenceId: string;
  description?: string | null;
}

export class TransferRepository {
  create(db: DbClient, data: NewTransfer): Promise<Transfer> {
    return db.transfer.create({
      data: {
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        referenceId: data.referenceId,
        description: data.description ?? null,
      },
    });
  }

  findById(db: DbClient, id: string): Promise<TransferWithLegs | null> {
    return db.transfer.findUnique({ where: { id }, include: { transactions: true } });
  }
}
