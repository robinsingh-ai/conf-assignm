import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Money is exact decimal, never a JS number. We reuse Prisma's bundled Decimal
 * (decimal.js) so values round-trip to NUMERIC(19,4) without conversion.
 * On the wire amounts are strings with two decimals: "100.00".
 */
export const Decimal = Prisma.Decimal;
export type Money = Prisma.Decimal;

export const ZERO: Money = new Decimal(0);

export function money(value: Prisma.Decimal | string | number): Money {
  return new Decimal(value);
}

/** Canonical wire format. */
export function formatMoney(value: Prisma.Decimal | string | number): string {
  return new Decimal(value).toFixed(2);
}

const AMOUNT_PATTERN = /^\d{1,15}(\.\d{1,2})?$/;

/**
 * Accepts "30", "30.5", "30.50" or the number 30.5; rejects zero, negatives,
 * more than two decimals, exponent notation and anything that is not a number.
 * Produces a Decimal so the service layer never touches floats.
 */
export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((raw, ctx) => {
    const text = typeof raw === 'number' ? String(raw) : raw.trim();
    if (!AMOUNT_PATTERN.test(text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'amount must be a positive number with at most 2 decimal places',
      });
      return z.NEVER;
    }
    const value = new Decimal(text);
    if (value.lte(0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount must be greater than 0' });
      return z.NEVER;
    }
    return value;
  });
