import { NextResponse } from 'next/server';
import { z } from 'zod';

// ============= Next.js API Route Validation Helpers =============

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: NextResponse };

export async function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Zod v4 uses 'issues'
    const issues = result.error.issues || [];
    const errors = issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return {
      success: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errors,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

export function validateQueryParam(
  searchParams: URLSearchParams,
  param: string,
  schema: z.ZodSchema
): ValidationResult<unknown> {
  const value = searchParams.get(param);

  if (value === null) {
    return {
      success: false,
      error: NextResponse.json(
        { success: false, error: `${param} is required` },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(value);

  if (!result.success) {
    // Zod v4 uses 'issues'
    return {
      success: false,
      error: NextResponse.json(
        {
          success: false,
          error: `Invalid ${param}`,
          details: result.error.issues,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}
