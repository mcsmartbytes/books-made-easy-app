import { z } from 'zod';

// ============= Common Schemas =============

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');
export const emailSchema = z.string().email('Invalid email format').max(255);
export const positiveNumberSchema = z.number().positive('Amount must be positive');
export const nonNegativeNumberSchema = z.number().min(0, 'Amount cannot be negative');

// ============= Customer Schemas =============

export const createCustomerSchema = z.object({
  user_id: uuidSchema,
  name: z.string().min(1, 'Name is required').max(200),
  email: emailSchema.optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateCustomerSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  email: emailSchema.optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ============= Vendor Schemas =============

export const createVendorSchema = z.object({
  user_id: uuidSchema,
  name: z.string().min(1, 'Name is required').max(200),
  email: emailSchema.optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateVendorSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  email: emailSchema.optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ============= Invoice Schemas =============

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive().default(1),
  rate: nonNegativeNumberSchema.default(0),
  account_id: uuidSchema.optional().nullable(),
});

export const createInvoiceSchema = z.object({
  user_id: uuidSchema,
  customer_id: uuidSchema.optional().nullable(),
  invoice_number: z.string().min(1, 'Invoice number is required').max(50),
  due_date: dateSchema,
  items: z.array(invoiceItemSchema).optional().default([]),
  tax_rate: nonNegativeNumberSchema.optional().default(0),
  notes: z.string().max(2000).optional().nullable(),
  terms: z.string().max(2000).optional().nullable(),
});

export const updateInvoiceSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  customer_id: uuidSchema.optional().nullable(),
  invoice_number: z.string().min(1).max(50).optional(),
  due_date: dateSchema.optional(),
  items: z.array(invoiceItemSchema).optional(),
  tax_rate: nonNegativeNumberSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  terms: z.string().max(2000).optional().nullable(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
});

// ============= Bill Schemas =============

export const billItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive().default(1),
  rate: nonNegativeNumberSchema.default(0),
  account_id: uuidSchema.optional().nullable(),
});

export const createBillSchema = z.object({
  user_id: uuidSchema,
  vendor_id: uuidSchema.optional().nullable(),
  bill_number: z.string().max(50).optional().nullable(),
  bill_date: dateSchema,
  due_date: dateSchema,
  items: z.array(billItemSchema).optional().default([]),
  tax_rate: nonNegativeNumberSchema.optional().default(0),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateBillSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  vendor_id: uuidSchema.optional().nullable(),
  bill_number: z.string().max(50).optional().nullable(),
  bill_date: dateSchema.optional(),
  due_date: dateSchema.optional(),
  items: z.array(billItemSchema).optional(),
  tax_rate: nonNegativeNumberSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['unpaid', 'paid', 'overdue', 'cancelled']).optional(),
});

// ============= Account Schemas =============

export const accountTypeEnum = z.enum([
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
]);

export const createAccountSchema = z.object({
  user_id: uuidSchema,
  name: z.string().min(1, 'Account name is required').max(200),
  type: accountTypeEnum,
  code: z.string().max(20).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const updateAccountSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  type: accountTypeEnum.optional(),
  code: z.string().max(20).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
});

// ============= Payment Schemas =============

export const createPaymentReceivedSchema = z.object({
  user_id: uuidSchema,
  invoice_id: uuidSchema,
  amount: positiveNumberSchema,
  payment_date: dateSchema,
  payment_method: z.string().max(50).optional().nullable(),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const createPaymentMadeSchema = z.object({
  user_id: uuidSchema,
  bill_id: uuidSchema,
  amount: positiveNumberSchema,
  payment_date: dateSchema,
  payment_method: z.string().max(50).optional().nullable(),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ============= Company Settings Schema =============

export const updateCompanySettingsSchema = z.object({
  user_id: uuidSchema,
  company_name: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: emailSchema.optional().nullable(),
  website: z.string().url().optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  default_terms: z.string().max(2000).optional().nullable(),
  default_notes: z.string().max(2000).optional().nullable(),
});

// ============= Pure Validation Helpers =============

export type ValidationError = {
  field: string;
  message: string;
};

export type PureValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): PureValidationResult<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return { success: false, errors };
  }

  return { success: true, data: result.data };
}

export function validateQueryParamPure(
  searchParams: URLSearchParams,
  param: string,
  schema: z.ZodSchema
): PureValidationResult<unknown> {
  const value = searchParams.get(param);

  if (value === null) {
    return {
      success: false,
      errors: [{ field: param, message: `${param} is required` }],
    };
  }

  const result = schema.safeParse(value);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((e) => ({
        field: param,
        message: e.message,
      })),
    };
  }

  return { success: true, data: result.data };
}
