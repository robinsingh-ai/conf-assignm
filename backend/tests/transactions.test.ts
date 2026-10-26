import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  app, balanceOf, createAccount, credit, debit, expectError, ledgerSum, NIL_UUID, postTransaction, prisma,
} from './helpers';

describe('POST /accounts/:id/transactions', () => {
  it('credit increases the balance', async () => {
    const a = await createAccount();
    const res = await postTransaction(a.id, { type: 'credit', amount: '50.00', reference_id: 'c1', description: 'Top up' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      account_id: a.id, type: 'credit', amount: '50.00', description: 'Top up', reference_id: 'c1',
      transfer_id: null, balance_after: '50.00',
    });
    expect(await balanceOf(a.id)).toBe('50.00');
  });

  it('debit decreases the balance', async () => {
    const a = await createAccount();
    await credit(a.id, '100.00', 'c1');
    const res = await postTransaction(a.id, { type: 'debit', amount: '30.00', reference_id: 'd1' });
    expect(res.status).toBe(201);
    expect(res.body.balance_after).toBe('70.00');
    expect(await balanceOf(a.id)).toBe('70.00');
  });

  it('reproduces the brief: 0 +100 +50 -30 -20 = 100, and balance equals the ledger sum', async () => {
    const a = await createAccount();
    await credit(a.id, '100', 'r1');
    await credit(a.id, '50', 'r2');
    await debit(a.id, '30', 'r3');
    await debit(a.id, '20', 'r4');
    expect(await balanceOf(a.id)).toBe('100.00');
    expect(await ledgerSum(a.id)).toBe('100.00');
  });

  it('handles decimals exactly (no floating point drift)', async () => {
    const a = await createAccount();
    await credit(a.id, '0.10', 'a');
    await credit(a.id, '0.20', 'b');
    await debit(a.id, '0.30', 'c');
    expect(await balanceOf(a.id)).toBe('0.00');
  });

  it('accepts a numeric amount and normalises it', async () => {
    const a = await createAccount();
    const res = await postTransaction(a.id, { type: 'credit', amount: 12.5, reference_id: 'n' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe('12.50');
  });

  describe('insufficient balance', () => {
    it('rejects an overdraft with 422 and leaves balance and ledger untouched', async () => {
      const a = await createAccount();
      await credit(a.id, '100', 'c1');
      const res = await postTransaction(a.id, { type: 'debit', amount: '150', reference_id: 'd1' });
      expectError(res, 422, 'INSUFFICIENT_BALANCE');
      expect(res.body.error.details).toMatchObject({ balance: '100.00', requested: '150.00' });
      expect(await balanceOf(a.id)).toBe('100.00');
      // Atomicity: the rejected row was rolled back, not persisted.
      expect(await prisma.transaction.count({ where: { accountId: a.id } })).toBe(1);
      expect(await prisma.transaction.findFirst({ where: { referenceId: 'd1' } })).toBeNull();
    });

    it('rejects a debit on an empty account', async () => {
      const a = await createAccount();
      expectError(await postTransaction(a.id, { type: 'debit', amount: '0.01', reference_id: 'd' }), 422, 'INSUFFICIENT_BALANCE');
    });

    it('allows a debit of exactly the balance', async () => {
      const a = await createAccount();
      await credit(a.id, '25', 'c');
      const res = await postTransaction(a.id, { type: 'debit', amount: '25', reference_id: 'd' });
      expect(res.status).toBe(201);
      expect(res.body.balance_after).toBe('0.00');
    });
  });

  describe('duplicate reference_id', () => {
    it('rejects a replay with 409, does not create a row, does not move the balance', async () => {
      const a = await createAccount();
      const first = await credit(a.id, '100', 'ref-1');
      const res = await postTransaction(a.id, { type: 'credit', amount: '100', reference_id: 'ref-1' });
      expectError(res, 409, 'DUPLICATE_TRANSACTION');
      expect(res.body.error.details).toMatchObject({ reference_id: 'ref-1', existing_transaction_id: first.id });
      expect(await balanceOf(a.id)).toBe('100.00');
      expect(await prisma.transaction.count({ where: { accountId: a.id } })).toBe(1);
    });

    it('rejects a replay even when the payload differs', async () => {
      const a = await createAccount();
      await credit(a.id, '100', 'ref-1');
      const res = await postTransaction(a.id, { type: 'debit', amount: '5', reference_id: 'ref-1' });
      expectError(res, 409, 'DUPLICATE_TRANSACTION');
      expect(await balanceOf(a.id)).toBe('100.00');
    });

    it('allows the same reference_id on a different account', async () => {
      const a = await createAccount('A');
      const b = await createAccount('B');
      await credit(a.id, '10', 'shared');
      await credit(b.id, '20', 'shared');
      expect(await balanceOf(a.id)).toBe('10.00');
      expect(await balanceOf(b.id)).toBe('20.00');
    });

    it('is case-sensitive', async () => {
      const a = await createAccount();
      await credit(a.id, '1', 'REF');
      expect((await postTransaction(a.id, { type: 'credit', amount: '1', reference_id: 'ref' })).status).toBe(201);
    });
  });

  describe('validation', () => {
    it('rejects an unknown account with 404', async () => {
      expectError(await postTransaction(NIL_UUID, { type: 'credit', amount: '1', reference_id: 'x' }), 404, 'ACCOUNT_NOT_FOUND');
    });

    it('rejects a non-UUID account id with 400', async () => {
      expectError(await postTransaction('abc', { type: 'credit', amount: '1', reference_id: 'x' }), 400, 'VALIDATION_ERROR');
    });

    it.each([
      ['missing type', { amount: '1', reference_id: 'x' }, 'body.type'],
      ['invalid type', { type: 'refund', amount: '1', reference_id: 'x' }, 'body.type'],
      ['zero amount', { type: 'credit', amount: '0', reference_id: 'x' }, 'body.amount'],
      ['negative amount', { type: 'credit', amount: '-5', reference_id: 'x' }, 'body.amount'],
      ['three decimals', { type: 'credit', amount: '1.005', reference_id: 'x' }, 'body.amount'],
      ['non-numeric amount', { type: 'credit', amount: 'ten', reference_id: 'x' }, 'body.amount'],
      ['exponent amount', { type: 'credit', amount: '1e5', reference_id: 'x' }, 'body.amount'],
      ['missing amount', { type: 'credit', reference_id: 'x' }, 'body.amount'],
      ['missing reference_id', { type: 'credit', amount: '1' }, 'body.reference_id'],
      ['blank reference_id', { type: 'credit', amount: '1', reference_id: '  ' }, 'body.reference_id'],
      ['unknown field', { type: 'credit', amount: '1', reference_id: 'x', created_at: '2020-01-01' }, 'body'],
    ])('rejects %s', async (_label, body, path) => {
      const a = await createAccount();
      const res = await postTransaction(a.id, body);
      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.error.details.some((d: { path: string }) => d.path === path)).toBe(true);
      expect(await prisma.transaction.count()).toBe(0);
    });

    it('reports every problem at once', async () => {
      const a = await createAccount();
      const res = await postTransaction(a.id, { type: 'x', amount: '-1' });
      expect(res.body.error.details).toHaveLength(3);
    });
  });
});

describe('GET /accounts/:id/transactions', () => {
  async function seed() {
    const a = await createAccount();
    await credit(a.id, '100', 'c1');
    await credit(a.id, '50', 'c2');
    await debit(a.id, '30', 'd1');
    await debit(a.id, '20', 'd2');
    await credit(a.id, '5', 'c3');
    return a;
  }

  it('returns all transactions latest-first with pagination metadata', async () => {
    const a = await seed();
    const res = await request(app).get(`/accounts/${a.id}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((t: { reference_id: string }) => t.reference_id)).toEqual(['c3', 'd2', 'd1', 'c2', 'c1']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total_records: 5, total_pages: 1 });
    const times = res.body.data.map((t: { created_at: string }) => Date.parse(t.created_at));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it('filters by type', async () => {
    const a = await seed();
    const debits = await request(app).get(`/accounts/${a.id}/transactions?type=debit`);
    expect(debits.body.data.map((t: { reference_id: string }) => t.reference_id)).toEqual(['d2', 'd1']);
    expect(debits.body.pagination.total_records).toBe(2);
    const credits = await request(app).get(`/accounts/${a.id}/transactions?type=credit`);
    expect(credits.body.pagination.total_records).toBe(3);
  });

  it('paginates without duplicating or skipping rows', async () => {
    const a = await seed();
    const p1 = await request(app).get(`/accounts/${a.id}/transactions?page=1&limit=2`);
    const p2 = await request(app).get(`/accounts/${a.id}/transactions?page=2&limit=2`);
    const p3 = await request(app).get(`/accounts/${a.id}/transactions?page=3&limit=2`);
    expect(p1.body.pagination).toEqual({ page: 1, limit: 2, total_records: 5, total_pages: 3 });
    const all = [...p1.body.data, ...p2.body.data, ...p3.body.data].map((t: { reference_id: string }) => t.reference_id);
    expect(all).toEqual(['c3', 'd2', 'd1', 'c2', 'c1']);
    expect(p3.body.data).toHaveLength(1);
  });

  it('returns an empty page beyond the end', async () => {
    const a = await seed();
    const res = await request(app).get(`/accounts/${a.id}/transactions?page=9`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total_records).toBe(5);
  });

  it('returns an empty list for an account with no transactions', async () => {
    const a = await createAccount();
    const res = await request(app).get(`/accounts/${a.id}/transactions`);
    expect(res.body).toEqual({ data: [], pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 } });
  });

  it.each(['page=0', 'page=-1', 'page=abc', 'page=1.5', 'limit=0', 'limit=101', 'limit=abc'])(
    'rejects invalid pagination %s',
    async (qs) => {
      const a = await createAccount();
      expectError(await request(app).get(`/accounts/${a.id}/transactions?${qs}`), 400, 'INVALID_PAGINATION');
    },
  );

  it('rejects an invalid type filter', async () => {
    const a = await createAccount();
    expectError(await request(app).get(`/accounts/${a.id}/transactions?type=refund`), 400, 'VALIDATION_ERROR');
  });

  it('404s for an unknown account', async () => {
    expectError(await request(app).get(`/accounts/${NIL_UUID}/transactions`), 404, 'ACCOUNT_NOT_FOUND');
  });
});

describe('GET /transactions/:id', () => {
  it('fetches a single transaction', async () => {
    const a = await createAccount();
    const t = await credit(a.id, '1', 'x');
    const res = await request(app).get(`/transactions/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, amount: '1.00' });
  });

  it('404s for an unknown id', async () => {
    expectError(await request(app).get(`/transactions/${NIL_UUID}`), 404, 'NOT_FOUND');
  });
});

describe('immutability', () => {
  it('exposes no update or delete routes', async () => {
    const a = await createAccount();
    const t = await credit(a.id, '1', 'x');
    for (const method of ['put', 'patch', 'delete'] as const) {
      expectError(await request(app)[method](`/transactions/${t.id}`).send({ amount: '999' }), 404, 'NOT_FOUND');
      expectError(await request(app)[method](`/accounts/${a.id}/transactions/${t.id}`).send({}), 404, 'NOT_FOUND');
    }
    const after = await request(app).get(`/transactions/${t.id}`);
    expect(after.body.amount).toBe('1.00');
  });

  it('is enforced by the database trigger even for direct SQL', async () => {
    const a = await createAccount();
    const t = await credit(a.id, '1', 'x');
    await expect(prisma.$executeRaw`UPDATE transactions SET amount = 999 WHERE id = ${t.id}::uuid`).rejects.toThrow(/immutable/);
    await expect(prisma.$executeRaw`DELETE FROM transactions WHERE id = ${t.id}::uuid`).rejects.toThrow(/immutable/);
    expect(await prisma.transaction.count()).toBe(1);
  });

  it('is enforced by the database for negative balances too', async () => {
    const a = await createAccount();
    await expect(prisma.$executeRaw`UPDATE accounts SET balance = -1 WHERE id = ${a.id}::uuid`).rejects.toThrow(/accounts_balance_non_negative/);
  });
});
