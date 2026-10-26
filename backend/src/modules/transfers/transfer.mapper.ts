import type { Transaction, Transfer } from '@prisma/client';
import { formatMoney } from '../../lib/money';
import { toTransactionDto, type TransactionDto } from '../transactions/transaction.mapper';

export interface TransferDto {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: string;
  reference_id: string;
  description: string | null;
  created_at: string;
  debit_transaction: TransactionDto | null;
  credit_transaction: TransactionDto | null;
}

export function toTransferDto(t: Transfer, legs: Transaction[]): TransferDto {
  const debit = legs.find((l) => l.type === 'debit');
  const credit = legs.find((l) => l.type === 'credit');
  return {
    id: t.id,
    from_account_id: t.fromAccountId,
    to_account_id: t.toAccountId,
    amount: formatMoney(t.amount),
    reference_id: t.referenceId,
    description: t.description,
    created_at: t.createdAt.toISOString(),
    debit_transaction: debit ? toTransactionDto(debit) : null,
    credit_transaction: credit ? toTransactionDto(credit) : null,
  };
}
