import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Sync API for Expenses Made Easy
 *
 * Imports:
 * - Expenses → Bills (business expenses become payables)
 * - Mileage → Bills (mileage deductions as expense entries)
 * - Categories → Accounts (expense categories map to chart of accounts)
 */

// POST /api/sync/expenses - Sync expenses from Expenses Made Easy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, action, data } = body;

    if (!user_id || !action) {
      return NextResponse.json({ error: 'user_id and action are required' }, { status: 400 });
    }

    switch (action) {
      case 'sync_expense':
        return await syncExpense(user_id, data);
      case 'sync_mileage':
        return await syncMileage(user_id, data);
      case 'sync_categories':
        return await syncCategories(user_id, data);
      case 'bulk_sync':
        return await bulkSync(user_id, data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

// Sync a single expense as a bill
async function syncExpense(userId: string, expense: any) {
  if (!expense) {
    return NextResponse.json({ error: 'expense data required' }, { status: 400 });
  }

  // Check if already synced (using external_id)
  const { data: existing } = await supabaseAdmin
    .from('bills')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', `expenses:${expense.id}`)
    .single();

  if (existing) {
    // Update existing
    const { data, error } = await supabaseAdmin
      .from('bills')
      .update({
        total: expense.amount,
        description: expense.description,
        category: expense.category_name || 'Uncategorized',
        bill_date: expense.date,
        status: 'paid', // Expenses are already paid
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, action: 'updated', data });
  }

  // Create new bill from expense
  const { data, error } = await supabaseAdmin
    .from('bills')
    .insert({
      user_id: userId,
      external_id: `expenses:${expense.id}`,
      external_source: 'expenses_made_easy',
      bill_number: `EXP-${expense.id.slice(0, 8)}`,
      bill_date: expense.date,
      due_date: expense.date,
      category: expense.category_name || 'Uncategorized',
      description: expense.description,
      subtotal: expense.amount,
      tax_amount: expense.tax_amount || 0,
      total: expense.amount,
      amount_paid: expense.amount, // Already paid
      status: 'paid',
      notes: `Synced from Expenses Made Easy. Vendor: ${expense.vendor || 'N/A'}`,
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ success: true, action: 'created', data });
}

// Sync mileage as expense/bill
async function syncMileage(userId: string, mileage: any) {
  if (!mileage) {
    return NextResponse.json({ error: 'mileage data required' }, { status: 400 });
  }

  const IRS_RATE = 0.67; // 2024 IRS rate
  const deductionAmount = mileage.distance * IRS_RATE;

  // Check if already synced
  const { data: existing } = await supabaseAdmin
    .from('bills')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', `mileage:${mileage.id}`)
    .single();

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('bills')
      .update({
        total: deductionAmount,
        description: `Mileage: ${mileage.distance.toFixed(1)} miles - ${mileage.purpose || 'Business trip'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, action: 'updated', data });
  }

  const { data, error } = await supabaseAdmin
    .from('bills')
    .insert({
      user_id: userId,
      external_id: `mileage:${mileage.id}`,
      external_source: 'expenses_made_easy',
      bill_number: `MIL-${mileage.id.slice(0, 8)}`,
      bill_date: mileage.date,
      due_date: mileage.date,
      category: 'Vehicle Expense',
      description: `Mileage: ${mileage.distance.toFixed(1)} miles @ $${IRS_RATE}/mile - ${mileage.purpose || 'Business trip'}`,
      subtotal: deductionAmount,
      total: deductionAmount,
      amount_paid: deductionAmount,
      status: 'paid',
      notes: `Tax deduction from mileage tracking. Route: ${mileage.start_location || 'N/A'} to ${mileage.end_location || 'N/A'}`,
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ success: true, action: 'created', data });
}

// Sync expense categories to chart of accounts
async function syncCategories(userId: string, categories: any[]) {
  if (!categories || !Array.isArray(categories)) {
    return NextResponse.json({ error: 'categories array required' }, { status: 400 });
  }

  const results = { created: 0, skipped: 0 };

  for (const cat of categories) {
    // Check if account already exists
    const { data: existing } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('name', cat.name)
      .single();

    if (existing) {
      results.skipped++;
      continue;
    }

    // Create expense account
    const code = `6${String(results.created + 100).padStart(3, '0')}`;

    await supabaseAdmin
      .from('accounts')
      .insert({
        user_id: userId,
        code,
        name: cat.name,
        type: 'expense',
        subtype: 'operating',
        description: `Synced from Expenses Made Easy. Deduction: ${cat.deduction_percentage || 0}%`,
      });

    results.created++;
  }

  return NextResponse.json({ success: true, results });
}

// Bulk sync multiple items
async function bulkSync(userId: string, data: any) {
  const { expenses = [], mileage = [], categories = [] } = data;
  const results = {
    expenses: { synced: 0, errors: 0 },
    mileage: { synced: 0, errors: 0 },
    categories: { synced: 0, errors: 0 },
  };

  // Sync expenses
  for (const exp of expenses) {
    try {
      await syncExpense(userId, exp);
      results.expenses.synced++;
    } catch {
      results.expenses.errors++;
    }
  }

  // Sync mileage
  for (const mil of mileage) {
    try {
      await syncMileage(userId, mil);
      results.mileage.synced++;
    } catch {
      results.mileage.errors++;
    }
  }

  // Sync categories
  if (categories.length > 0) {
    const catResult = await syncCategories(userId, categories);
    const catData = await catResult.json();
    results.categories.synced = catData.results?.created || 0;
  }

  return NextResponse.json({ success: true, results });
}

// GET /api/sync/expenses - Get sync status
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Count synced items
    const { data: expenseData } = await supabaseAdmin
      .from('bills')
      .select('id')
      .eq('user_id', userId)
      .eq('external_source', 'expenses_made_easy')
      .like('external_id', 'expenses:%');

    const { data: mileageData } = await supabaseAdmin
      .from('bills')
      .select('id')
      .eq('user_id', userId)
      .eq('external_source', 'expenses_made_easy')
      .like('external_id', 'mileage:%');

    // Get last sync time
    const { data: lastSynced } = await supabaseAdmin
      .from('bills')
      .select('updated_at')
      .eq('user_id', userId)
      .eq('external_source', 'expenses_made_easy')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      status: {
        connected: true,
        source: 'expenses_made_easy',
        syncedExpenses: expenseData?.length || 0,
        syncedMileage: mileageData?.length || 0,
        lastSyncedAt: (lastSynced as any)?.updated_at || null,
      },
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}
