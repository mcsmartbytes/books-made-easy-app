import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/reports?type=profit-loss&start_date=xxx&end_date=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const reportType = searchParams.get('type') || 'profit-loss';
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    switch (reportType) {
      case 'profit-loss':
        return await generateProfitLossReport(userId, startDate, endDate);
      case 'balance-sheet':
        return await generateBalanceSheetReport(userId);
      case 'cash-flow':
        return await generateCashFlowReport(userId, startDate, endDate);
      case 'accounts-receivable':
        return await generateARReport(userId);
      case 'accounts-payable':
        return await generateAPReport(userId);
      case 'customer-summary':
        return await generateCustomerSummary(userId, startDate, endDate);
      case 'vendor-summary':
        return await generateVendorSummary(userId, startDate, endDate);
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

async function generateProfitLossReport(userId: string, startDate?: string | null, endDate?: string | null) {
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const end = endDate || now.toISOString().split('T')[0];

  // Get paid invoices (income)
  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('total, issue_date')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('issue_date', start)
    .lte('issue_date', end);

  // Get paid bills (expenses)
  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('total, category, bill_date')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('bill_date', start)
    .lte('bill_date', end);

  const totalIncome = (invoices || []).reduce((sum, i) => sum + Number(i.total || 0), 0);
  const totalExpenses = (bills || []).reduce((sum, b) => sum + Number(b.total || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  // Group expenses by category
  const expensesByCategory: Record<string, number> = {};
  (bills || []).forEach(b => {
    const cat = b.category || 'Uncategorized';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(b.total || 0);
  });

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Profit & Loss Statement',
      period: { start, end },
      income: {
        total: totalIncome,
        invoiceCount: (invoices || []).length,
      },
      expenses: {
        total: totalExpenses,
        billCount: (bills || []).length,
        byCategory: expensesByCategory,
      },
      netProfit,
      profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
    },
  });
}

async function generateBalanceSheetReport(userId: string) {
  // Get totals
  const [_customersResult, _vendorsResult, invoicesResult, billsResult] = await Promise.all([
    supabaseAdmin.from('customers').select('balance').eq('user_id', userId),
    supabaseAdmin.from('vendors').select('balance').eq('user_id', userId),
    supabaseAdmin.from('invoices').select('total, amount_paid, status').eq('user_id', userId),
    supabaseAdmin.from('bills').select('total, amount_paid, status').eq('user_id', userId),
  ]);

  const accountsReceivable = (invoicesResult.data || [])
    .filter(i => ['sent', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + (Number(i.total || 0) - Number(i.amount_paid || 0)), 0);

  const accountsPayable = (billsResult.data || [])
    .filter(b => ['unpaid', 'overdue'].includes(b.status))
    .reduce((sum, b) => sum + (Number(b.total || 0) - Number(b.amount_paid || 0)), 0);

  const totalRevenue = (invoicesResult.data || [])
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total || 0), 0);

  const totalExpenses = (billsResult.data || [])
    .filter(b => b.status === 'paid')
    .reduce((sum, b) => sum + Number(b.total || 0), 0);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Balance Sheet',
      asOf: new Date().toISOString().split('T')[0],
      assets: {
        accountsReceivable,
        totalAssets: accountsReceivable,
      },
      liabilities: {
        accountsPayable,
        totalLiabilities: accountsPayable,
      },
      equity: {
        retainedEarnings: totalRevenue - totalExpenses,
        totalEquity: totalRevenue - totalExpenses,
      },
      totalLiabilitiesAndEquity: accountsPayable + (totalRevenue - totalExpenses),
    },
  });
}

async function generateCashFlowReport(userId: string, startDate?: string | null, endDate?: string | null) {
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const end = endDate || now.toISOString().split('T')[0];

  const [paymentsReceived, paymentsMade] = await Promise.all([
    supabaseAdmin
      .from('payments_received')
      .select('amount, payment_date')
      .eq('user_id', userId)
      .gte('payment_date', start)
      .lte('payment_date', end),
    supabaseAdmin
      .from('payments_made')
      .select('amount, payment_date')
      .eq('user_id', userId)
      .gte('payment_date', start)
      .lte('payment_date', end),
  ]);

  const cashIn = (paymentsReceived.data || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const cashOut = (paymentsMade.data || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Cash Flow Statement',
      period: { start, end },
      operating: {
        cashIn,
        cashOut,
        netCashFlow: cashIn - cashOut,
      },
      netChange: cashIn - cashOut,
    },
  });
}

async function generateARReport(userId: string) {
  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('*, customers(name, email)')
    .eq('user_id', userId)
    .in('status', ['sent', 'overdue'])
    .order('due_date');

  const today = new Date();
  const aging = {
    current: [] as any[],
    days1to30: [] as any[],
    days31to60: [] as any[],
    days61to90: [] as any[],
    over90: [] as any[],
  };

  (invoices || []).forEach(inv => {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const outstanding = Number(inv.total || 0) - Number(inv.amount_paid || 0);

    const item = {
      invoiceNumber: inv.invoice_number,
      customer: inv.customers?.name || 'Unknown',
      dueDate: inv.due_date,
      total: inv.total,
      outstanding,
      daysOverdue: Math.max(0, daysOverdue),
    };

    if (daysOverdue <= 0) aging.current.push(item);
    else if (daysOverdue <= 30) aging.days1to30.push(item);
    else if (daysOverdue <= 60) aging.days31to60.push(item);
    else if (daysOverdue <= 90) aging.days61to90.push(item);
    else aging.over90.push(item);
  });

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Accounts Receivable Aging',
      asOf: today.toISOString().split('T')[0],
      aging,
      totals: {
        current: aging.current.reduce((s, i) => s + i.outstanding, 0),
        days1to30: aging.days1to30.reduce((s, i) => s + i.outstanding, 0),
        days31to60: aging.days31to60.reduce((s, i) => s + i.outstanding, 0),
        days61to90: aging.days61to90.reduce((s, i) => s + i.outstanding, 0),
        over90: aging.over90.reduce((s, i) => s + i.outstanding, 0),
      },
    },
  });
}

async function generateAPReport(userId: string) {
  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('*, vendors(name, email)')
    .eq('user_id', userId)
    .in('status', ['unpaid', 'overdue'])
    .order('due_date');

  const today = new Date();
  const aging = {
    current: [] as any[],
    days1to30: [] as any[],
    days31to60: [] as any[],
    days61to90: [] as any[],
    over90: [] as any[],
  };

  (bills || []).forEach(bill => {
    const dueDate = new Date(bill.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const outstanding = Number(bill.total || 0) - Number(bill.amount_paid || 0);

    const item = {
      billNumber: bill.bill_number,
      vendor: bill.vendors?.name || 'Unknown',
      dueDate: bill.due_date,
      total: bill.total,
      outstanding,
      daysOverdue: Math.max(0, daysOverdue),
    };

    if (daysOverdue <= 0) aging.current.push(item);
    else if (daysOverdue <= 30) aging.days1to30.push(item);
    else if (daysOverdue <= 60) aging.days31to60.push(item);
    else if (daysOverdue <= 90) aging.days61to90.push(item);
    else aging.over90.push(item);
  });

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Accounts Payable Aging',
      asOf: today.toISOString().split('T')[0],
      aging,
      totals: {
        current: aging.current.reduce((s, i) => s + i.outstanding, 0),
        days1to30: aging.days1to30.reduce((s, i) => s + i.outstanding, 0),
        days31to60: aging.days31to60.reduce((s, i) => s + i.outstanding, 0),
        days61to90: aging.days61to90.reduce((s, i) => s + i.outstanding, 0),
        over90: aging.over90.reduce((s, i) => s + i.outstanding, 0),
      },
    },
  });
}

async function generateCustomerSummary(userId: string, startDate?: string | null, endDate?: string | null) {
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const end = endDate || now.toISOString().split('T')[0];

  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('customer_id, total, status, customers(name)')
    .eq('user_id', userId)
    .gte('issue_date', start)
    .lte('issue_date', end);

  const customerStats: Record<string, { name: string; totalBilled: number; totalPaid: number; invoiceCount: number }> = {};

  (invoices || []).forEach(inv => {
    const custId = inv.customer_id || 'unknown';
    const custName = (inv.customers as any)?.name || 'Unknown';

    if (!customerStats[custId]) {
      customerStats[custId] = { name: custName, totalBilled: 0, totalPaid: 0, invoiceCount: 0 };
    }

    customerStats[custId].totalBilled += Number(inv.total || 0);
    customerStats[custId].invoiceCount += 1;
    if (inv.status === 'paid') {
      customerStats[custId].totalPaid += Number(inv.total || 0);
    }
  });

  const customers = Object.entries(customerStats)
    .map(([id, stats]) => ({ id, ...stats, outstanding: stats.totalBilled - stats.totalPaid }))
    .sort((a, b) => b.totalBilled - a.totalBilled);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Customer Summary',
      period: { start, end },
      customers,
      totals: {
        totalBilled: customers.reduce((s, c) => s + c.totalBilled, 0),
        totalPaid: customers.reduce((s, c) => s + c.totalPaid, 0),
        totalOutstanding: customers.reduce((s, c) => s + c.outstanding, 0),
      },
    },
  });
}

async function generateVendorSummary(userId: string, startDate?: string | null, endDate?: string | null) {
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const end = endDate || now.toISOString().split('T')[0];

  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('vendor_id, total, status, vendors(name)')
    .eq('user_id', userId)
    .gte('bill_date', start)
    .lte('bill_date', end);

  const vendorStats: Record<string, { name: string; totalBilled: number; totalPaid: number; billCount: number }> = {};

  (bills || []).forEach(bill => {
    const vendId = bill.vendor_id || 'unknown';
    const vendName = (bill.vendors as any)?.name || 'Unknown';

    if (!vendorStats[vendId]) {
      vendorStats[vendId] = { name: vendName, totalBilled: 0, totalPaid: 0, billCount: 0 };
    }

    vendorStats[vendId].totalBilled += Number(bill.total || 0);
    vendorStats[vendId].billCount += 1;
    if (bill.status === 'paid') {
      vendorStats[vendId].totalPaid += Number(bill.total || 0);
    }
  });

  const vendors = Object.entries(vendorStats)
    .map(([id, stats]) => ({ id, ...stats, outstanding: stats.totalBilled - stats.totalPaid }))
    .sort((a, b) => b.totalBilled - a.totalBilled);

  return NextResponse.json({
    success: true,
    data: {
      reportType: 'Vendor Summary',
      period: { start, end },
      vendors,
      totals: {
        totalBilled: vendors.reduce((s, v) => s + v.totalBilled, 0),
        totalPaid: vendors.reduce((s, v) => s + v.totalPaid, 0),
        totalOutstanding: vendors.reduce((s, v) => s + v.outstanding, 0),
      },
    },
  });
}
