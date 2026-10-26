import type { Transaction, TransactionType } from '@prisma/client';
import type { Money } from '../../lib/money';
import type { DbClient } from '../../lib/prisma';

export interface NewTransaction {
  accountId: string;
  type: TransactionType;
  amount: Money;
  referenceId: string;
  description?: string | null;
  transferId?: string | null;
}

export interface TransactionFilter {
  accountId: string;
  type?: TransactionType;
}

/** Latest first, with `id` as a tiebreaker so paging is stable. */
const LATEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

export class TransactionRepository {
  /** Lets PostgreSQL's UNIQUE (account_id, reference_id) reject duplicates. */
  create(db: DbClient, data: NewTransaction): Promise<Transaction> {
    return db.transaction.create({
      data: {
        accountId: data.accountId,
        type: data.type,
        amount: data.amount,
        referenceId: data.referenceId,
        description: data.description ?? null,
        transferId: data.transferId ?? null,
      },
    });
  }

  findById(db: DbClient, id: string): Promise<Transaction | null> {
    return db.transaction.findUnique({ where: { id } });
  }

  findByReference(db: DbClient, accountId: string, referenceId: string): Promise<Transaction | null> {
    return db.transaction.findUnique({
      where: { accountId_referenceId: { accountId, referenceId } },
    });
  }

  list(db: DbClient, filter: TransactionFilter, skip: number, take: number): Promise<Transaction[]> {
    return db.transaction.findMany({
      where: { accountId: filter.accountId, ...(filter.type ? { type: filter.type } : {}) },
      orderBy: LATEST_FIRST,
      skip,
      take,
    });
  }

  count(db: DbClient, filter: TransactionFilter): Promise<number> {
    return db.transaction.count({
      where: { accountId: filter.accountId, ...(filter.type ? { type: filter.type } : {}) },
    });
  }
}
