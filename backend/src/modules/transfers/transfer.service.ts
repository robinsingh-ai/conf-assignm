import type { PrismaClient } from '@prisma/client';
import {
  AccountNotFoundError,
  DuplicateTransactionError,
  InsufficientBalanceError,
  NotFoundError,
  SameAccountTransferError,
} from '../../lib/errors';
import { formatMoney, type Money } from '../../lib/money';
import { isUniqueViolation, TX_OPTIONS } from '../../lib/prisma';
import type { AccountRepository } from '../accounts/account.repository';
import type { TransactionRepository } from '../transactions/transaction.repository';
import { toTransferDto, type TransferDto } from './transfer.mapper';
import type { TransferRepository } from './transfer.repository';

export interface CreateTransferCommand {
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
  referenceId: string;
  description?: string | undefined;
}

export interface CreatedTransferDto extends TransferDto {
  from_balance_after: string;
  to_balance_after: string;
}

/**
 * A transfer is a debit leg and a credit leg committed together. Both account
 * rows are locked for the duration, always in ascending id order so two opposite
 * transfers can never deadlock. Any failure rolls back both legs.
 */
export class TransferService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly accounts: AccountRepository,
    private readonly transactions: TransactionRepository,
    private readonly transfers: TransferRepository,
  ) {}

  async create(cmd: CreateTransferCommand): Promise<CreatedTransferDto> {
    if (cmd.fromAccountId === cmd.toAccountId) throw new SameAccountTransferError(cmd.fromAccountId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Deterministic lock order (ARCHITECTURE §5.4).
        const [firstId, secondId] = [cmd.fromAccountId, cmd.toAccountId].sort();
        const first = await this.accounts.lockForUpdate(tx, firstId!);
        const second = await this.accounts.lockForUpdate(tx, secondId!);

        const source = firstId === cmd.fromAccountId ? first : second;
        const destination = firstId === cmd.toAccountId ? first : second;
        if (!source) throw new AccountNotFoundError(cmd.fromAccountId);
        if (!destination) throw new AccountNotFoundError(cmd.toAccountId);

        if (source.balance.lt(cmd.amount)) {
          throw new InsufficientBalanceError(
            cmd.fromAccountId,
            formatMoney(source.balance),
            formatMoney(cmd.amount),
          );
        }

        const transfer = await this.transfers.create(tx, {
          fromAccountId: cmd.fromAccountId,
          toAccountId: cmd.toAccountId,
          amount: cmd.amount,
          referenceId: cmd.referenceId,
          description: cmd.description,
        });

        const debit = await this.transactions.create(tx, {
          accountId: cmd.fromAccountId,
          type: 'debit',
          amount: cmd.amount,
          referenceId: cmd.referenceId,
          description: cmd.description,
          transferId: transfer.id,
        });
        const credit = await this.transactions.create(tx, {
          accountId: cmd.toAccountId,
          type: 'credit',
          amount: cmd.amount,
          referenceId: cmd.referenceId,
          description: cmd.description,
          transferId: transfer.id,
        });

        const fromAfter = await this.accounts.adjustBalance(tx, cmd.fromAccountId, cmd.amount.neg());
        const toAfter = await this.accounts.adjustBalance(tx, cmd.toAccountId, cmd.amount);

        return {
          ...toTransferDto(transfer, [debit, credit]),
          from_balance_after: formatMoney(fromAfter.balance),
          to_balance_after: formatMoney(toAfter.balance),
        };
      }, TX_OPTIONS);
    } catch (err) {
      if (isUniqueViolation(err)) {
        // reference_id already used on one of the two accounts; say which.
        const onSource = await this.transactions.findByReference(this.prisma, cmd.fromAccountId, cmd.referenceId);
        const accountId = onSource ? cmd.fromAccountId : cmd.toAccountId;
        const existing =
          onSource ?? (await this.transactions.findByReference(this.prisma, cmd.toAccountId, cmd.referenceId));
        throw new DuplicateTransactionError(accountId, cmd.referenceId, existing?.id);
      }
      throw err;
    }
  }

  async getById(id: string): Promise<TransferDto> {
    const row = await this.transfers.findById(this.prisma, id);
    if (!row) throw new NotFoundError(`Transfer ${id}`);
    return toTransferDto(row, row.transactions);
  }
}
