import type { Account } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { AccountNotFoundError } from '../../lib/errors';
import { formatMoney } from '../../lib/money';
import { paginationMeta, type Page, type Pagination } from '../../lib/pagination';
import { toAccountDto, type AccountDto } from './account.mapper';
import type { AccountRepository } from './account.repository';

export interface BalanceDto {
  account_id: string;
  balance: string;
  as_of: string;
}

export class AccountService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly accounts: AccountRepository,
  ) {}

  async create(name: string): Promise<AccountDto> {
    const account = await this.accounts.create(this.prisma, name);
    return toAccountDto(account);
  }

  async getById(id: string): Promise<AccountDto> {
    return toAccountDto(await this.requireAccount(id));
  }

  async getBalance(id: string): Promise<BalanceDto> {
    const account = await this.requireAccount(id);
    return {
      account_id: account.id,
      balance: formatMoney(account.balance),
      as_of: account.updatedAt.toISOString(),
    };
  }

  async list(p: Pagination): Promise<Page<AccountDto>> {
    const [rows, total] = await Promise.all([
      this.accounts.list(this.prisma, p.skip, p.take),
      this.accounts.count(this.prisma),
    ]);
    return { data: rows.map(toAccountDto), pagination: paginationMeta(p, total) };
  }

  private async requireAccount(id: string): Promise<Account> {
    const account = await this.accounts.findById(this.prisma, id);
    if (!account) throw new AccountNotFoundError(id);
    return account;
  }
}
