import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, balanceOf, createAccount, credit, ledgerSum, postTransaction, prisma } from './helpers';

/**
 * These tests exist because the integrity guarantees live in the database:
 * row locks and constraints are only meaningful under concurrent load.
 */
describe('concurrency', () => {
  it('never overdraws when many debits race for one balance', async () => {
    const a = await createAccount();
    await credit(a.id, '100', 'seed');

    const attempts = 15; // 15 x 10.00 against 100.00 -> exactly 10 can succeed
    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) =>
        postTransaction(a.id, { type: 'debit', amount: '10.00', reference_id: `race-${i}` }),
      ),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(10);
    expect(statuses.filter((s) => s === 422)).toHaveLength(5);
    expect(await balanceOf(a.id)).toBe('0.00');
    expect(await ledgerSum(a.id)).toBe('0.00');
    expect(await prisma.transaction.count({ where: { accountId: a.id, type: 'debit' } })).toBe(10);
  });

  it('creates exactly one row when the same reference_id is replayed concurrently', async () => {
    const a = await createAccount();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        postTransaction(a.id, { type: 'credit', amount: '5.00', reference_id: 'same' }),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(await balanceOf(a.id)).toBe('5.00');
    expect(await prisma.transaction.count({ where: { accountId: a.id } })).toBe(1);
  });

  it('opposite-direction transfers do not deadlock and conserve total money', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await credit(a.id, '500', 'seed-a');
    await credit(b.id, '500', 'seed-b');

    const n = 10;
    const results = await Promise.all([
      ...Array.from({ length: n }, (_, i) =>
        request(app).post('/transfers').send({ from_account_id: a.id, to_account_id: b.id, amount: '7.00', reference_id: `ab-${i}` }),
      ),
      ...Array.from({ length: n }, (_, i) =>
        request(app).post('/transfers').send({ from_account_id: b.id, to_account_id: a.id, amount: '3.00', reference_id: `ba-${i}` }),
      ),
    ]);

    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await balanceOf(a.id)).toBe('460.00'); // 500 - 70 + 30
    expect(await balanceOf(b.id)).toBe('540.00'); // 500 + 70 - 30
    expect(await ledgerSum(a.id)).toBe('460.00');
    expect(await ledgerSum(b.id)).toBe('540.00');
    expect(await prisma.transfer.count()).toBe(2 * n);
  });
});
