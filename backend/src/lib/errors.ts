/**
 * Domain errors. Services throw *meaning* (what went wrong); the error-handler
 * middleware turns that meaning into an HTTP status and the shared envelope.
 * Keeping the mapping in one place is what makes error responses consistent.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_PAGINATION'
  | 'INVALID_JSON'
  | 'ACCOUNT_NOT_FOUND'
  | 'NOT_FOUND'
  | 'DUPLICATE_TRANSACTION'
  | 'INSUFFICIENT_BALANCE'
  | 'SAME_ACCOUNT_TRANSFER'
  | 'INTERNAL_ERROR';

export interface ValidationIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(issues: ValidationIssue[]) {
    super(400, 'VALIDATION_ERROR', 'Request validation failed', issues);
  }
}

export class InvalidPaginationError extends AppError {
  constructor(issues: ValidationIssue[]) {
    super(400, 'INVALID_PAGINATION', 'Invalid pagination parameters', issues);
  }
}

export class InvalidJsonError extends AppError {
  constructor() {
    super(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
}

export class AccountNotFoundError extends AppError {
  constructor(accountId: string) {
    super(404, 'ACCOUNT_NOT_FOUND', `Account ${accountId} was not found`, { account_id: accountId });
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super(404, 'NOT_FOUND', `${what} was not found`);
  }
}

export class DuplicateTransactionError extends AppError {
  constructor(accountId: string, referenceId: string, existingTransactionId?: string) {
    super(
      409,
      'DUPLICATE_TRANSACTION',
      `A transaction with reference_id "${referenceId}" already exists for account ${accountId}`,
      {
        account_id: accountId,
        reference_id: referenceId,
        ...(existingTransactionId ? { existing_transaction_id: existingTransactionId } : {}),
      },
    );
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(accountId: string, balance: string, requested: string) {
    super(
      422,
      'INSUFFICIENT_BALANCE',
      `Account balance ${balance} is less than debit amount ${requested}`,
      { account_id: accountId, balance, requested },
    );
  }
}

export class SameAccountTransferError extends AppError {
  constructor(accountId: string) {
    super(422, 'SAME_ACCOUNT_TRANSFER', 'Source and destination accounts must differ', {
      account_id: accountId,
    });
  }
}
