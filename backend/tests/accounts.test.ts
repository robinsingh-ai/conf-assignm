import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, createAccount, expectError, NIL_UUID } from './helpers';

describe('POST /accounts', () => {
  it('creates an account with a zero balance and server-generated id/timestamp', async () => {
    const res = await request(app).post('/accounts').send({ name: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Alice', balance: '0.00' });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(res.body.created_at).toString()).not.toBe('Invalid Date');
  });

  it('trims the name', async () => {
    const res = await request(app).post('/accounts').send({ name: '  Bob  ' });
    expect(res.body.name).toBe('Bob');
  });

  it('rejects a missing or empty name', async () => {
    expectError(await request(app).post('/accounts').send({}), 400, 'VALIDATION_ERROR');
    expectError(await request(app).post('/accounts').send({ name: '   ' }), 400, 'VALIDATION_ERROR');
    expectError(await request(app).post('/accounts').send({ name: 42 }), 400, 'VALIDATION_ERROR');
  });

  it('does not let the client set the initial balance', async () => {
    const res = await request(app).post('/accounts').send({ name: 'Rich', balance: '1000' });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(JSON.stringify(res.body.error.details)).toContain('balance');
  });

  it('rejects malformed JSON with a dedicated code', async () => {
    const res = await request(app).post('/accounts').set('content-type', 'application/json').send('{"name":');
    expectError(res, 400, 'INVALID_JSON');
  });
});

describe('GET /accounts/:id and /balance', () => {
  it('returns the account and its balance', async () => {
    const a = await createAccount('Alice');
    const acc = await request(app).get(`/accounts/${a.id}`);
    expect(acc.status).toBe(200);
    expect(acc.body).toMatchObject({ id: a.id, name: 'Alice', balance: '0.00' });

    const bal = await request(app).get(`/accounts/${a.id}/balance`);
    expect(bal.status).toBe(200);
    expect(bal.body).toMatchObject({ account_id: a.id, balance: '0.00' });
  });

  it('404s for an unknown account', async () => {
    expectError(await request(app).get(`/accounts/${NIL_UUID}`), 404, 'ACCOUNT_NOT_FOUND');
    expectError(await request(app).get(`/accounts/${NIL_UUID}/balance`), 404, 'ACCOUNT_NOT_FOUND');
  });

  it('400s for a non-UUID id', async () => {
    expectError(await request(app).get('/accounts/not-a-uuid/balance'), 400, 'VALIDATION_ERROR');
  });
});

describe('GET /accounts', () => {
  it('lists newest first with pagination metadata', async () => {
    await createAccount('First');
    await createAccount('Second');
    await createAccount('Third');
    const res = await request(app).get('/accounts?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.map((a: { name: string }) => a.name)).toEqual(['Third', 'Second']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 2, total_records: 3, total_pages: 2 });
  });
});

describe('unknown routes', () => {
  it('returns a consistent 404 envelope', async () => {
    expectError(await request(app).get('/nope'), 404, 'NOT_FOUND');
  });
});
