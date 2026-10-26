import type { Transaction } from '@prisma/client';
import { formatMoney } from '../../lib/money';

export interface TransactionDto {
  id: string;
  account_id: string;
  type: 'credit' | 'debit';
  amount: string;
  description: string | null;
  reference_id: string;
  transfer_id: string | null;
  created_at: string;
}

export function toTransactionDto(t: Transaction): TransactionDto {
  return {
    id: t.id,
    account_id: t.accountId,
    type: t.type,
    amount: formatMoney(t.amount),
    description: t.description,
    reference_id: t.referenceId,
    transfer_id: t.transferId,
    created_at: t.createdAt.toISOString(),
  };
}
