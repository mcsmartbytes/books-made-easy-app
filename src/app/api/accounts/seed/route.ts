import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

const DEFAULT_ACCOUNTS = [
  // Assets
  { code: '1000', name: 'Cash', type: 'asset', subtype: 'current' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'current' },
  { code: '1200', name: 'Inventory', type: 'asset', subtype: 'current' },
  { code: '1500', name: 'Equipment', type: 'asset', subtype: 'fixed' },
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'current' },
  { code: '2100', name: 'Credit Card', type: 'liability', subtype: 'current' },
  { code: '2500', name: 'Loans Payable', type: 'liability', subtype: 'long-term' },
  // Equity
  { code: '3000', name: 'Owner\'s Equity', type: 'equity', subtype: 'capital' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', subtype: 'retained' },
  // Income
  { code: '4000', name: 'Sales Revenue', type: 'income', subtype: 'operating' },
  { code: '4100', name: 'Service Revenue', type: 'income', subtype: 'operating' },
  { code: '4500', name: 'Other Income', type: 'income', subtype: 'other' },
  // Expenses
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', subtype: 'cost' },
  { code: '6000', name: 'Advertising & Marketing', type: 'expense', subtype: 'operating' },
  { code: '6100', name: 'Bank Fees', type: 'expense', subtype: 'operating' },
  { code: '6200', name: 'Insurance', type: 'expense', subtype: 'operating' },
  { code: '6300', name: 'Office Supplies', type: 'expense', subtype: 'operating' },
  { code: '6400', name: 'Professional Services', type: 'expense', subtype: 'operating' },
  { code: '6500', name: 'Rent', type: 'expense', subtype: 'operating' },
  { code: '6600', name: 'Utilities', type: 'expense', subtype: 'operating' },
  { code: '6700', name: 'Travel & Entertainment', type: 'expense', subtype: 'operating' },
  { code: '6800', name: 'Vehicle Expense', type: 'expense', subtype: 'operating' },
  { code: '6900', name: 'Wages & Salaries', type: 'expense', subtype: 'payroll' },
];

// POST /api/accounts/seed - Seed default chart of accounts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Check if accounts already exist
    const { data: existing } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('user_id', user_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Accounts already exist for this user'
      }, { status: 400 });
    }

    const accountsWithUserId = DEFAULT_ACCOUNTS.map(acc => ({ ...acc, user_id }));

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .insert(accountsWithUserId)
      .select();

    if (error) throw error;
    if (!data) throw new Error('No data returned from insert');

    return NextResponse.json({
      success: true,
      message: `Created ${data.length} default accounts`,
      data
    }, { status: 201 });
  } catch (error) {
    console.error('Error seeding accounts:', error);
    return NextResponse.json({ error: 'Failed to seed accounts' }, { status: 500 });
  }
}
