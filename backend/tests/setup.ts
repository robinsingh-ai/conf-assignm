import 'dotenv/config';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach } from 'vitest';

// Point the app at the test database *before* anything imports src/config/env.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

let prisma: PrismaClient | undefined;

beforeEach(async () => {
  prisma ??= (await import('../src/lib/prisma')).prisma;
  // TRUNCATE does not fire row-level triggers, so the immutability trigger lets us reset.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "transactions", "transfers", "accounts" CASCADE');
});

afterAll(async () => {
  await prisma?.$disconnect();
});
