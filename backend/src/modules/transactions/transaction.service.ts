import type { PrismaClient, TransactionType } from '@prisma/client';
import {
  AccountNotFoundError,
  DuplicateTransactionError,
  InsufficientBalanceError,
  NotFoundError,
} from '../../lib/errors';
import { formatMoney, type Money } from '../../lib/money';
import { paginationMeta, type Page, type Pagination } from '../../lib/pagination';
import { isUniqueViolation, TX_OPTIONS } from '../../lib/prisma';
import type { AccountRepository } from '../accounts/account.repository';
import { toTransactionDto, type TransactionDto } from './transaction.mapper';
import type { TransactionRepository } from './transaction.repository';

export interface CreateTransactionCommand {
  accountId: string;
  type: TransactionType;
  amount: Money;
  referenceId: string;
  description?: string | undefined;
}

export interface CreatedTransactionDto extends TransactionDto {
  balance_after: string;
}

/**
 * Owns the ledger rules. The critical path (`create`) is one database
 * transaction: lock the account, insert the row, check funds, move the balance.
 * Any throw rolls everything back, so a rejected transaction leaves no trace.
 */
export class TransactionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly accounts: AccountRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async create(cmd: CreateTransactionCommand): Promise<CreatedTransactionDto> {
    // Fast path: a friendly 409 with the existing id, without taking the lock.
    // The UNIQUE constraint below is still the authority if two replays race.
    const existing = await this.transactions.findByReference(this.prisma, cmd.accountId, cmd.referenceId);
    if (existing) throw new DuplicateTransactionError(cmd.accountId, cmd.referenceId, existing.id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await this.accounts.lockForUpdate(tx, cmd.accountId);
        if (!account) throw new AccountNotFoundError(cmd.accountId);

        // Insert first so a duplicate wins over "insufficient balance": the
        // caller learns the transaction already exists, which is the more useful fact.
        const row = await this.transactions.create(tx, {
          accountId: cmd.accountId,
          type: cmd.type,
          amount: cmd.amount,
          referenceId: cmd.referenceId,
          description: cmd.description,
        });

        if (cmd.type === 'debit' && account.balance.lt(cmd.amount)) {
          throw new InsufficientBalanceError(
            cmd.accountId,
            formatMoney(account.balance),
            formatMoney(cmd.amount),
          );
        }

        const delta = cmd.type === 'credit' ? cmd.amount : cmd.amount.neg();
        const updated = await this.accounts.adjustBalance(tx, cmd.accountId, delta);

        return { ...toTransactionDto(row), balance_after: formatMoney(updated.balance) };
      }, TX_OPTIONS);
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Lost a race with an identical replay; report the row that won.
        const winner = await this.transactions.findByReference(this.prisma, cmd.accountId, cmd.referenceId);
        throw new DuplicateTransactionError(cmd.accountId, cmd.referenceId, winner?.id);
      }
      throw err;
    }
  }

  async getById(id: string): Promise<TransactionDto> {
    const row = await this.transactions.findById(this.prisma, id);
    if (!row) throw new NotFoundError(`Transaction ${id}`);
    return toTransactionDto(row);
  }

  async listForAccount(
    accountId: string,
    type: TransactionType | undefined,
    p: Pagination,
  ): Promise<Page<TransactionDto>> {
    const account = await this.accounts.findById(this.prisma, accountId);
    if (!account) throw new AccountNotFoundError(accountId);

    const filter = { accountId, type };
    const [rows, total] = await Promise.all([
      this.transactions.list(this.prisma, filter, p.skip, p.take),
      this.transactions.count(this.prisma, filter),
    ]);
    return { data: rows.map(toTransactionDto), pagination: paginationMeta(p, total) };
  }
}
