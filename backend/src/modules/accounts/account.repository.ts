import type { Account } from '@prisma/client';
import { Decimal, type Money } from '../../lib/money';
import type { DbClient } from '../../lib/prisma';

export interface LockedAccount {
  id: string;
  balance: Money;
}

/**
 * The only code that knows how accounts are stored. Every method takes the
 * client to run on, so a service can run several calls in one transaction.
 */
export class AccountRepository {
  create(db: DbClient, name: string): Promise<Account> {
    return db.account.create({ data: { name } });
  }

  findById(db: DbClient, id: string): Promise<Account | null> {
    return db.account.findUnique({ where: { id } });
  }

  list(db: DbClient, skip: number, take: number): Promise<Account[]> {
    return db.account.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take });
  }

  count(db: DbClient): Promise<number> {
    return db.account.count();
  }

  /**
   * Reads the account and takes a row lock until the surrounding transaction
   * ends. Concurrent writers to the same account queue here, which is what makes
   * the balance check in the service race-free. Returns null if no such account.
   */
  async lockForUpdate(db: DbClient, id: string): Promise<LockedAccount | null> {
    const rows = await db.$queryRaw<Array<{ id: string; balance: unknown }>>`
      SELECT "id", "balance" FROM "accounts" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, balance: new Decimal(String(row.balance)) };
  }

  /** Applies a signed delta (credit positive, debit negative) and returns the row. */
  adjustBalance(db: DbClient, id: string, delta: Money): Promise<Account> {
    return db.account.update({
      where: { id },
      data: { balance: { increment: delta } },
    });
  }
}
