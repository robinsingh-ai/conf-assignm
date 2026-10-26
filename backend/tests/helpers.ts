import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app: Express = createApp();
export { prisma };

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export async function createAccount(name = 'Alice'): Promise<{ id: string; name: string; balance: string }> {
  const res = await request(app).post('/accounts').send({ name });
  expect(res.status).toBe(201);
  return res.body;
}

export function postTransaction(accountId: string, body: Record<string, unknown>) {
  return request(app).post(`/accounts/${accountId}/transactions`).send(body);
}

export async function credit(accountId: string, amount: string, referenceId: string) {
  const res = await postTransaction(accountId, { type: 'credit', amount, reference_id: referenceId });
  expect(res.status).toBe(201);
  return res.body;
}

export async function debit(accountId: string, amount: string, referenceId: string) {
  const res = await postTransaction(accountId, { type: 'debit', amount, reference_id: referenceId });
  expect(res.status).toBe(201);
  return res.body;
}

export async function balanceOf(accountId: string): Promise<string> {
  const res = await request(app).get(`/accounts/${accountId}/balance`);
  expect(res.status).toBe(200);
  return res.body.balance;
}

/** SUM(credits) - SUM(debits) straight from the ledger table, as a 2dp string. */
export async function ledgerSum(accountId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ total: unknown }>>`
    SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS total
    FROM transactions WHERE account_id = ${accountId}::uuid
  `;
  return Number(String(rows[0]?.total ?? 0)).toFixed(2);
}

export function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.body).toMatchObject({ error: { code } });
  expect(typeof res.body.error.message).toBe('string');
}
