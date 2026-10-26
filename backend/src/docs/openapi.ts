/**
 * OpenAPI 3.0 description served at /openapi.json and rendered at /docs.
 * Kept as a typed object (not YAML) so it ships inside the compiled bundle.
 */

const money = { type: 'string', pattern: '^\\d+\\.\\d{2}$', example: '100.00', description: 'Decimal string, 2 dp' };
const uuid = { type: 'string', format: 'uuid' };
const timestamp = { type: 'string', format: 'date-time' };

const errorEnvelope = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          enum: [
            'VALIDATION_ERROR', 'INVALID_PAGINATION', 'INVALID_JSON', 'ACCOUNT_NOT_FOUND', 'NOT_FOUND',
            'DUPLICATE_TRANSACTION', 'INSUFFICIENT_BALANCE', 'SAME_ACCOUNT_TRANSFER', 'INTERNAL_ERROR',
          ],
        },
        message: { type: 'string' },
        details: { description: 'Endpoint-specific; an array of {path,message} for VALIDATION_ERROR' },
      },
    },
  },
};

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const pagination = {
  type: 'object',
  required: ['page', 'limit', 'total_records', 'total_pages'],
  properties: {
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
    total_records: { type: 'integer', example: 57 },
    total_pages: { type: 'integer', example: 3 },
  },
};

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Transaction Ledger API',
    version: '1.0.0',
    description:
      'Accounts, immutable credit/debit transactions, balances, paginated history and atomic transfers. ' +
      'All money values are decimal strings with two decimal places.',
  },
  servers: [{ url: 'http://localhost:4000' }],
  tags: [{ name: 'Accounts' }, { name: 'Transactions' }, { name: 'Transfers' }, { name: 'System' }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness and database connectivity',
        responses: {
          200: { description: 'Healthy' },
          503: { description: 'Database unreachable' },
        },
      },
    },
    '/accounts': {
      post: {
        tags: ['Accounts'],
        summary: 'Create an account',
        description: 'Balance always starts at 0.00. Sending a balance field is a validation error.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 100, example: 'Alice' } } },
            },
          },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } } },
          400: errorResponse('VALIDATION_ERROR'),
        },
      },
      get: {
        tags: ['Accounts'],
        summary: 'List accounts (newest first)',
        parameters: paginationParams,
        responses: {
          200: {
            description: 'Page of accounts',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Account' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } },
          },
          400: errorResponse('INVALID_PAGINATION'),
        },
      },
    },
    '/accounts/{id}': {
      get: {
        tags: ['Accounts'],
        summary: 'Get an account',
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: {
          200: { description: 'Account', content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } } },
          400: errorResponse('VALIDATION_ERROR (id is not a UUID)'),
          404: errorResponse('ACCOUNT_NOT_FOUND'),
        },
      },
    },
    '/accounts/{id}/balance': {
      get: {
        tags: ['Accounts'],
        summary: 'Get current balance',
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: {
          200: {
            description: 'Balance',
            content: { 'application/json': { schema: { type: 'object', properties: { account_id: uuid, balance: money, as_of: timestamp } } } },
          },
          404: errorResponse('ACCOUNT_NOT_FOUND'),
        },
      },
    },
    '/accounts/{id}/transactions': {
      post: {
        tags: ['Transactions'],
        summary: 'Post a credit or debit',
        description:
          'Inserting the transaction and updating the balance is one database transaction. ' +
          'A debit exceeding the balance is rejected (422) and nothing is persisted. ' +
          'A repeated reference_id for the same account is rejected (409) and the balance is unchanged.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NewTransaction' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatedTransaction' } } } },
          400: errorResponse('VALIDATION_ERROR'),
          404: errorResponse('ACCOUNT_NOT_FOUND'),
          409: errorResponse('DUPLICATE_TRANSACTION'),
          422: errorResponse('INSUFFICIENT_BALANCE'),
        },
      },
      get: {
        tags: ['Transactions'],
        summary: 'Transaction history (latest first)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: uuid },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['credit', 'debit'] } },
          ...paginationParams,
        ],
        responses: {
          200: {
            description: 'Page of transactions',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } },
          },
          400: errorResponse('INVALID_PAGINATION or VALIDATION_ERROR'),
          404: errorResponse('ACCOUNT_NOT_FOUND'),
        },
      },
    },
    '/transactions/{id}': {
      get: {
        tags: ['Transactions'],
        summary: 'Get a transaction',
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: {
          200: { description: 'Transaction', content: { 'application/json': { schema: { $ref: '#/components/schemas/Transaction' } } } },
          404: errorResponse('NOT_FOUND'),
        },
      },
    },
    '/transfers': {
      post: {
        tags: ['Transfers'],
        summary: 'Transfer money between two accounts atomically',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NewTransfer' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatedTransfer' } } } },
          400: errorResponse('VALIDATION_ERROR'),
          404: errorResponse('ACCOUNT_NOT_FOUND (details.account_id says which)'),
          409: errorResponse('DUPLICATE_TRANSACTION'),
          422: errorResponse('INSUFFICIENT_BALANCE or SAME_ACCOUNT_TRANSFER'),
        },
      },
    },
    '/transfers/{id}': {
      get: {
        tags: ['Transfers'],
        summary: 'Get a transfer with both legs',
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: {
          200: { description: 'Transfer', content: { 'application/json': { schema: { $ref: '#/components/schemas/Transfer' } } } },
          404: errorResponse('NOT_FOUND'),
        },
      },
    },
  },
  components: {
    schemas: {
      Error: errorEnvelope,
      Pagination: pagination,
      Account: {
        type: 'object',
        properties: { id: uuid, name: { type: 'string' }, balance: money, created_at: timestamp },
      },
      NewTransaction: {
        type: 'object',
        required: ['type', 'amount', 'reference_id'],
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['credit', 'debit'] },
          amount: { oneOf: [money, { type: 'number' }], example: '30.00' },
          reference_id: { type: 'string', minLength: 1, maxLength: 100, example: 'coffee-1' },
          description: { type: 'string', maxLength: 255, example: 'Coffee' },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: uuid,
          account_id: uuid,
          type: { type: 'string', enum: ['credit', 'debit'] },
          amount: money,
          description: { type: 'string', nullable: true },
          reference_id: { type: 'string' },
          transfer_id: { ...uuid, nullable: true },
          created_at: timestamp,
        },
      },
      CreatedTransaction: {
        allOf: [
          { $ref: '#/components/schemas/Transaction' },
          { type: 'object', properties: { balance_after: money } },
        ],
      },
      NewTransfer: {
        type: 'object',
        required: ['from_account_id', 'to_account_id', 'amount', 'reference_id'],
        additionalProperties: false,
        properties: {
          from_account_id: uuid,
          to_account_id: uuid,
          amount: { oneOf: [money, { type: 'number' }], example: '30.00' },
          reference_id: { type: 'string', example: 'tx-1' },
          description: { type: 'string' },
        },
      },
      Transfer: {
        type: 'object',
        properties: {
          id: uuid,
          from_account_id: uuid,
          to_account_id: uuid,
          amount: money,
          reference_id: { type: 'string' },
          description: { type: 'string', nullable: true },
          created_at: timestamp,
          debit_transaction: { $ref: '#/components/schemas/Transaction' },
          credit_transaction: { $ref: '#/components/schemas/Transaction' },
        },
      },
      CreatedTransfer: {
        allOf: [
          { $ref: '#/components/schemas/Transfer' },
          { type: 'object', properties: { from_balance_after: money, to_balance_after: money } },
        ],
      },
    },
  },
} as const;
