import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, balanceOf, createAccount, credit, expectError, ledgerSum, NIL_UUID, prisma } from './helpers';

function transfer(body: Record<string, unknown>) {
  return request(app).post('/transfers').send(body);
}

describe('POST /transfers', () => {
  it('moves money atomically: A 100, B 50, transfer 30 => A 70, B 80', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await credit(a.id, '100', 'seed-a');
    await credit(b.id, '50', 'seed-b');

    const res = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: '30', reference_id: 'tx-1', description: 'Dinner' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      from_account_id: a.id, to_account_id: b.id, amount: '30.00', reference_id: 'tx-1',
      from_balance_after: '70.00', to_balance_after: '80.00',
    });
    expect(res.body.debit_transaction).toMatchObject({ account_id: a.id, type: 'debit', amount: '30.00', transfer_id: res.body.id });
    expect(res.body.credit_transaction).toMatchObject({ account_id: b.id, type: 'credit', amount: '30.00', transfer_id: res.body.id });

    expect(await balanceOf(a.id)).toBe('70.00');
    expect(await balanceOf(b.id)).toBe('80.00');
    expect(await ledgerSum(a.id)).toBe('70.00');
    expect(await ledgerSum(b.id)).toBe('80.00');
  });

  it('rejects when the source has insufficient balance and nothing is persisted', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await credit(a.id, '10', 'seed');
    const res = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: '10.01', reference_id: 'tx' });
    expectError(res, 422, 'INSUFFICIENT_BALANCE');
    expect(await balanceOf(a.id)).toBe('10.00');
    expect(await balanceOf(b.id)).toBe('0.00');
    expect(await prisma.transfer.count()).toBe(0);
    expect(await prisma.transaction.count({ where: { referenceId: 'tx' } })).toBe(0);
  });

  it('rolls back both legs when the destination does not exist', async () => {
    const a = await createAccount('A');
    await credit(a.id, '100', 'seed');
    const res = await transfer({ from_account_id: a.id, to_account_id: NIL_UUID, amount: '30', reference_id: 'tx' });
    expectError(res, 404, 'ACCOUNT_NOT_FOUND');
    expect(res.body.error.details.account_id).toBe(NIL_UUID);
    expect(await balanceOf(a.id)).toBe('100.00');
    expect(await prisma.transaction.count({ where: { referenceId: 'tx' } })).toBe(0);
    expect(await prisma.transfer.count()).toBe(0);
  });

  it('404s when the source does not exist', async () => {
    const b = await createAccount('B');
    const res = await transfer({ from_account_id: NIL_UUID, to_account_id: b.id, amount: '1', reference_id: 'tx' });
    expectError(res, 404, 'ACCOUNT_NOT_FOUND');
    expect(res.body.error.details.account_id).toBe(NIL_UUID);
  });

  it('rejects a transfer to the same account', async () => {
    const a = await createAccount('A');
    const res = await transfer({ from_account_id: a.id, to_account_id: a.id, amount: '1', reference_id: 'tx' });
    expectError(res, 422, 'SAME_ACCOUNT_TRANSFER');
  });

  it('rejects a duplicate reference_id on either side and rolls back', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await credit(a.id, '100', 'seed');
    expect((await transfer({ from_account_id: a.id, to_account_id: b.id, amount: '10', reference_id: 'tx' })).status).toBe(201);

    const replay = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: '10', reference_id: 'tx' });
    expectError(replay, 409, 'DUPLICATE_TRANSACTION');

    // reference already used on B only (as a plain credit) -> still rejected, A untouched
    await credit(b.id, '1', 'used-on-b');
    const clash = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: '5', reference_id: 'used-on-b' });
    expectError(clash, 409, 'DUPLICATE_TRANSACTION');
    expect(clash.body.error.details.account_id).toBe(b.id);

    expect(await balanceOf(a.id)).toBe('90.00');
    expect(await balanceOf(b.id)).toBe('11.00');
    expect(await prisma.transfer.count()).toBe(1);
  });

  it('validates the body', async () => {
    const res = await transfer({ from_account_id: 'x', amount: '0', reference_id: '' });
    expectError(res, 400, 'VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.from_account_id', 'body.to_account_id', 'body.amount', 'body.reference_id']));
  });
});

describe('GET /transfers/:id', () => {
  it('returns the transfer with both legs', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await credit(a.id, '100', 'seed');
    const created = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: '30', reference_id: 'tx' });
    const res = await request(app).get(`/transfers/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.debit_transaction.account_id).toBe(a.id);
    expect(res.body.credit_transaction.account_id).toBe(b.id);
  });

  it('404s for an unknown id', async () => {
    expectError(await request(app).get(`/transfers/${NIL_UUID}`), 404, 'NOT_FOUND');
  });
});
