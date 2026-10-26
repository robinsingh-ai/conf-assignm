import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './lib/prisma';
import { AccountController } from './modules/accounts/account.controller';
import { AccountRepository } from './modules/accounts/account.repository';
import { AccountService } from './modules/accounts/account.service';
import { TransactionController } from './modules/transactions/transaction.controller';
import { TransactionRepository } from './modules/transactions/transaction.repository';
import { TransactionService } from './modules/transactions/transaction.service';
import { TransferController } from './modules/transfers/transfer.controller';
import { TransferRepository } from './modules/transfers/transfer.repository';
import { TransferService } from './modules/transfers/transfer.service';

/**
 * Composition root: the one place objects are wired together. Plain constructor
 * injection, no container library. Tests can pass a different PrismaClient.
 */
export interface Container {
  prisma: PrismaClient;
  controllers: {
    accounts: AccountController;
    transactions: TransactionController;
    transfers: TransferController;
  };
}

export function buildContainer(prisma: PrismaClient = defaultPrisma): Container {
  const accountRepo = new AccountRepository();
  const transactionRepo = new TransactionRepository();
  const transferRepo = new TransferRepository();

  const accountService = new AccountService(prisma, accountRepo);
  const transactionService = new TransactionService(prisma, accountRepo, transactionRepo);
  const transferService = new TransferService(prisma, accountRepo, transactionRepo, transferRepo);

  return {
    prisma,
    controllers: {
      accounts: new AccountController(accountService),
      transactions: new TransactionController(transactionService),
      transfers: new TransferController(transferService),
    },
  };
}
