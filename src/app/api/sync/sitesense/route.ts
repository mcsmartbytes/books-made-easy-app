import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Sync API for SiteSense
 *
 * Imports:
 * - Jobs → Customers (job clients become customers)
 * - Estimates → Invoices (approved estimates become invoices)
 * - Time Entries → Invoice line items (billable time)
 * - Expenses → Bills (job expenses)
 */

// POST /api/sync/sitesense - Sync data from SiteSense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, action, data } = body;

    if (!user_id || !action) {
      return NextResponse.json({ error: 'user_id and action are required' }, { status: 400 });
    }

    switch (action) {
      case 'sync_client':
        return await syncClient(user_id, data);
      case 'sync_estimate':
        return await syncEstimate(user_id, data);
      case 'sync_time_entry':
        return await syncTimeEntry(user_id, data);
      case 'sync_job_expense':
        return await syncJobExpense(user_id, data);
      case 'sync_job':
        return await syncJob(user_id, data);
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

// Sync a client as a customer
async function syncClient(userId: string, client: any) {
  if (!client) {
    return NextResponse.json({ error: 'client data required' }, { status: 400 });
  }

  // Check if already synced
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', `sitesense:client:${client.id}`)
    .single();

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .update({
        name: client.name || client.company_name,
        email: client.email,
        phone: client.phone,
        company: client.company_name,
        address: client.address,
        city: client.city,
        state: client.state,
        zip: client.zip,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, action: 'updated', data });
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({
      user_id: userId,
      external_id: `sitesense:client:${client.id}`,
      external_source: 'sitesense',
      name: client.name || client.company_name || 'Unknown Client',
      email: client.email,
      phone: client.phone,
      company: client.company_name,
      address: client.address,
      city: client.city,
      state: client.state,
      zip: client.zip,
      notes: `Synced from SiteSense`,
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ success: true, action: 'created', data });
}

// Sync a job (creates customer if needed, tracks for invoicing)
async function syncJob(userId: string, job: any) {
  if (!job) {
    return NextResponse.json({ error: 'job data required' }, { status: 400 });
  }

  // First sync the client if present
  let customerId = null;
  if (job.client) {
    const clientResult = await syncClient(userId, job.client);
    const clientData = await clientResult.json();
    customerId = clientData.data?.id;
  }

  // Store job reference for future invoicing
  // We don't have a jobs table in Books, but we can track via notes on invoices
  return NextResponse.json({
    success: true,
    data: {
      job_id: job.id,
      job_name: job.name,
      customer_id: customerId,
      message: 'Job synced. Ready for invoice creation.',
    },
  });
}

// Sync an estimate as an invoice
async function syncEstimate(userId: string, estimate: any) {
  if (!estimate) {
    return NextResponse.json({ error: 'estimate data required' }, { status: 400 });
  }

  // Only sync approved/accepted estimates
  if (estimate.status !== 'approved' && estimate.status !== 'accepted') {
    return NextResponse.json({
      success: false,
      message: 'Only approved/accepted estimates can be synced as invoices',
    });
  }

  // Check if already synced
  const { data: existing } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', `sitesense:estimate:${estimate.id}`)
    .single();

  if (existing) {
    return NextResponse.json({
      success: true,
      action: 'exists',
      data: existing,
      message: 'Invoice already exists for this estimate',
    });
  }

  // Find or create customer
  let customerId = null;
  if (estimate.client_id) {
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .eq('external_id', `sitesense:client:${estimate.client_id}`)
      .single();

    customerId = customer?.id;
  }

  // Generate invoice number
  const { data: invoiceCountData } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('user_id', userId);

  const invoiceNumber = `INV-${String((invoiceCountData?.length || 0) + 1001).padStart(4, '0')}`;

  // Calculate totals from estimate items
  const subtotal = (estimate.items || []).reduce(
    (sum: number, item: any) => sum + (item.quantity || 1) * (item.rate || item.unit_price || 0),
    0
  );
  const taxRate = estimate.tax_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .insert({
      user_id: userId,
      customer_id: customerId,
      external_id: `sitesense:estimate:${estimate.id}`,
      external_source: 'sitesense',
      invoice_number: invoiceNumber,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: estimate.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      status: 'draft',
      notes: `Created from SiteSense Estimate #${estimate.estimate_number || estimate.id}`,
      terms: estimate.terms || 'Net 30',
    })
    .select()
    .single();

  if (invoiceError) throw invoiceError;
  if (!invoice) throw new Error('Failed to create invoice');
  const invoiceData = invoice as any;

  // Create invoice items
  if (estimate.items && estimate.items.length > 0) {
    const invoiceItems = estimate.items.map((item: any, index: number) => ({
      invoice_id: invoiceData.id,
      description: item.description || item.name,
      quantity: item.quantity || 1,
      rate: item.rate || item.unit_price || 0,
      amount: (item.quantity || 1) * (item.rate || item.unit_price || 0),
      sort_order: index,
    }));

    await supabaseAdmin.from('invoice_items').insert(invoiceItems);
  }

  return NextResponse.json({ success: true, action: 'created', data: invoiceData });
}

// Sync time entries as billable items (adds to pending invoice items)
async function syncTimeEntry(userId: string, timeEntry: any) {
  if (!timeEntry) {
    return NextResponse.json({ error: 'time entry data required' }, { status: 400 });
  }

  // Calculate billable amount
  const hours = timeEntry.hours || (timeEntry.duration_minutes || 0) / 60;
  const rate = timeEntry.hourly_rate || timeEntry.rate || 50; // Default rate
  const amount = hours * rate;

  // Store as a pending billable item
  // For now, we'll create it as a draft bill (expense to track)
  // In a full integration, this would add to a "pending billables" queue

  const { data, error } = await supabaseAdmin
    .from('bills')
    .insert({
      user_id: userId,
      external_id: `sitesense:time:${timeEntry.id}`,
      external_source: 'sitesense',
      bill_number: `TIME-${timeEntry.id.slice(0, 8)}`,
      bill_date: timeEntry.date || timeEntry.entry_date,
      due_date: timeEntry.date || timeEntry.entry_date,
      category: 'Labor',
      description: `Time: ${hours.toFixed(2)} hrs - ${timeEntry.description || timeEntry.notes || 'Billable work'}`,
      subtotal: amount,
      total: amount,
      status: 'draft', // Draft until invoiced
      notes: `Job: ${timeEntry.job_name || 'N/A'}, Worker: ${timeEntry.crew_member_name || 'N/A'}`,
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ success: true, action: 'created', data });
}

// Sync job expenses as bills
async function syncJobExpense(userId: string, expense: any) {
  if (!expense) {
    return NextResponse.json({ error: 'expense data required' }, { status: 400 });
  }

  // Check if already synced
  const { data: existing } = await supabaseAdmin
    .from('bills')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', `sitesense:expense:${expense.id}`)
    .single();

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('bills')
      .update({
        total: expense.amount,
        description: expense.description,
        category: expense.category || 'Job Expense',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, action: 'updated', data });
  }

  // Find or create vendor if present
  let vendorId = null;
  if (expense.vendor) {
    const { data: existingVendor } = await supabaseAdmin
      .from('vendors')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', expense.vendor)
      .single();

    if (existingVendor) {
      vendorId = existingVendor.id;
    } else {
      const { data: newVendor } = await supabaseAdmin
        .from('vendors')
        .insert({
          user_id: userId,
          name: expense.vendor,
          notes: 'Auto-created from SiteSense sync',
        })
        .select()
        .single();
      vendorId = newVendor?.id;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('bills')
    .insert({
      user_id: userId,
      vendor_id: vendorId,
      external_id: `sitesense:expense:${expense.id}`,
      external_source: 'sitesense',
      bill_number: `JOB-${expense.id.slice(0, 8)}`,
      bill_date: expense.date || expense.expense_date,
      due_date: expense.date || expense.expense_date,
      category: expense.category || 'Job Expense',
      description: expense.description,
      subtotal: expense.amount,
      total: expense.amount,
      amount_paid: expense.is_paid ? expense.amount : 0,
      status: expense.is_paid ? 'paid' : 'unpaid',
      notes: `Job: ${expense.job_name || 'N/A'}. Synced from SiteSense.`,
    })
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ success: true, action: 'created', data });
}

// Bulk sync multiple items
async function bulkSync(userId: string, data: any) {
  const {
    clients = [],
    jobs = [],
    estimates = [],
    time_entries = [],
    expenses = [],
  } = data;

  const results = {
    clients: { synced: 0, errors: 0 },
    jobs: { synced: 0, errors: 0 },
    estimates: { synced: 0, errors: 0 },
    time_entries: { synced: 0, errors: 0 },
    expenses: { synced: 0, errors: 0 },
  };

  for (const client of clients) {
    try {
      await syncClient(userId, client);
      results.clients.synced++;
    } catch {
      results.clients.errors++;
    }
  }

  for (const job of jobs) {
    try {
      await syncJob(userId, job);
      results.jobs.synced++;
    } catch {
      results.jobs.errors++;
    }
  }

  for (const estimate of estimates) {
    try {
      await syncEstimate(userId, estimate);
      results.estimates.synced++;
    } catch {
      results.estimates.errors++;
    }
  }

  for (const entry of time_entries) {
    try {
      await syncTimeEntry(userId, entry);
      results.time_entries.synced++;
    } catch {
      results.time_entries.errors++;
    }
  }

  for (const expense of expenses) {
    try {
      await syncJobExpense(userId, expense);
      results.expenses.synced++;
    } catch {
      results.expenses.errors++;
    }
  }

  return NextResponse.json({ success: true, results });
}

// GET /api/sync/sitesense - Get sync status
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const { data: customerData } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .eq('external_source', 'sitesense');

    const { data: invoiceData } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('user_id', userId)
      .eq('external_source', 'sitesense');

    const { data: billData } = await supabaseAdmin
      .from('bills')
      .select('id')
      .eq('user_id', userId)
      .eq('external_source', 'sitesense');

    const { data: lastSynced } = await supabaseAdmin
      .from('invoices')
      .select('updated_at')
      .eq('user_id', userId)
      .eq('external_source', 'sitesense')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      status: {
        connected: true,
        source: 'sitesense',
        syncedCustomers: customerData?.length || 0,
        syncedInvoices: invoiceData?.length || 0,
        syncedBills: billData?.length || 0,
        lastSyncedAt: (lastSynced as any)?.updated_at || null,
      },
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}
