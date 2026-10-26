import type { Account } from '@prisma/client';
import { formatMoney } from '../../lib/money';

export interface AccountDto {
  id: string;
  name: string;
  balance: string;
  created_at: string;
}

export function toAccountDto(a: Account): AccountDto {
  return {
    id: a.id,
    name: a.name,
    balance: formatMoney(a.balance),
    created_at: a.createdAt.toISOString(),
  };
}
