import {
  uuidSchema,
  dateSchema,
  emailSchema,
  createCustomerSchema,
  createVendorSchema,
  createInvoiceSchema,
  createBillSchema,
  createAccountSchema,
  accountTypeEnum,
  validate,
  validateQueryParamPure,
} from '../../lib/validations';

describe('Common Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUID', () => {
      const result = uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000');
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = uuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });
  });

  describe('dateSchema', () => {
    it('should accept valid date', () => {
      const result = dateSchema.safeParse('2024-01-15');
      expect(result.success).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = dateSchema.safeParse('01/15/2024');
      expect(result.success).toBe(false);
    });
  });

  describe('emailSchema', () => {
    it('should accept valid email', () => {
      const result = emailSchema.safeParse('test@example.com');
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });
  });
});

describe('Customer Schemas', () => {
  describe('createCustomerSchema', () => {
    it('should accept valid customer', () => {
      const result = createCustomerSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        company: 'ACME Corp',
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createCustomerSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Vendor Schemas', () => {
  describe('createVendorSchema', () => {
    it('should accept valid vendor', () => {
      const result = createVendorSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Office Supplies Inc',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Invoice Schemas', () => {
  describe('createInvoiceSchema', () => {
    it('should accept valid invoice', () => {
      const result = createInvoiceSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        invoice_number: 'INV-001',
        due_date: '2024-02-15',
        items: [
          { description: 'Consulting', quantity: 10, rate: 100 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should require invoice_number', () => {
      const result = createInvoiceSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        due_date: '2024-02-15',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Bill Schemas', () => {
  describe('createBillSchema', () => {
    it('should accept valid bill', () => {
      const result = createBillSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        bill_date: '2024-01-15',
        due_date: '2024-02-15',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Account Schemas', () => {
  describe('accountTypeEnum', () => {
    it('should accept valid account types', () => {
      const types = ['asset', 'liability', 'equity', 'income', 'expense'];
      types.forEach((type) => {
        const result = accountTypeEnum.safeParse(type);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('createAccountSchema', () => {
    it('should accept valid account', () => {
      const result = createAccountSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Cash',
        type: 'asset',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Validation Helpers', () => {
  describe('validate', () => {
    it('should return success with valid data', () => {
      const result = validate(emailSchema, 'test@example.com');
      expect(result.success).toBe(true);
    });

    it('should return errors with invalid data', () => {
      const result = validate(emailSchema, 'invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateQueryParamPure', () => {
    it('should validate present param', () => {
      const params = new URLSearchParams('id=123e4567-e89b-12d3-a456-426614174000');
      const result = validateQueryParamPure(params, 'id', uuidSchema);
      expect(result.success).toBe(true);
    });

    it('should error on missing param', () => {
      const params = new URLSearchParams('');
      const result = validateQueryParamPure(params, 'id', uuidSchema);
      expect(result.success).toBe(false);
    });
  });
});
