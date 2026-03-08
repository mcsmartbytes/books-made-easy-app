import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/reports/consolidated - Cross-entity consolidated P&L summary
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const organizationId = searchParams.get('organization_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  if (!userId || !organizationId) {
    return NextResponse.json({ error: 'user_id and organization_id are required' }, { status: 400 });
  }

  try {
    // Verify user has access to this organization
    const { data: roles } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (!roles || roles.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all entities in this organization that user has access to
    const entityIds = (roles as any[])
      .filter((r: any) => r.entity_id)
      .map((r: any) => r.entity_id);

    const { data: entities } = await supabaseAdmin
      .from('entities')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', 1);

    if (!entities || entities.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total_revenue: 0,
          total_expenses: 0,
          net_income: 0,
          entity_count: 0,
        },
      });
    }

    // Build entity financials
    const entityFinancials = [];

    for (const entity of entities as any[]) {
      // Check if user has access to this entity (org-level role or specific entity role)
      const hasAccess = entityIds.length === 0 || entityIds.includes(entity.id) ||
        (roles as any[]).some((r: any) => !r.entity_id); // org-level role = access to all
      if (!hasAccess) continue;

      // Get invoices for this entity
      let invoiceQuery = supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('entity_id', entity.id);
      if (startDate) invoiceQuery = invoiceQuery.gte('issue_date', startDate);
      if (endDate) invoiceQuery = invoiceQuery.lte('issue_date', endDate);
      const { data: invoices } = await invoiceQuery;

      // Get bills for this entity
      let billQuery = supabaseAdmin
        .from('bills')
        .select('*')
        .eq('entity_id', entity.id);
      if (startDate) billQuery = billQuery.gte('bill_date', startDate);
      if (endDate) billQuery = billQuery.lte('bill_date', endDate);
      const { data: bills } = await billQuery;

      // Get expenses for this entity
      let expenseQuery = supabaseAdmin
        .from('expenses')
        .select('*')
        .eq('entity_id', entity.id);
      if (startDate) expenseQuery = expenseQuery.gte('date', startDate);
      if (endDate) expenseQuery = expenseQuery.lte('date', endDate);
      const { data: expenses } = await expenseQuery;

      // Get jobs for this entity
      const { data: jobs } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('entity_id', entity.id);

      const revenue = (invoices as any[] || []).reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
      const billCosts = (bills as any[] || []).reduce((sum: number, b: any) => sum + (b.total || 0), 0);
      const expenseCosts = (expenses as any[] || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      const totalExpenses = billCosts + expenseCosts;
      const netIncome = revenue - totalExpenses;

      const activeJobs = (jobs as any[] || []).filter((j: any) => j.status === 'in_progress').length;
      const totalContractValue = (jobs as any[] || []).reduce((sum: number, j: any) => sum + (j.estimated_revenue || 0), 0);

      entityFinancials.push({
        entity_id: entity.id,
        entity_name: entity.name,
        entity_type: entity.entity_type,
        revenue,
        expenses: totalExpenses,
        net_income: netIncome,
        margin_pct: revenue > 0 ? ((netIncome / revenue) * 100) : 0,
        invoice_count: (invoices || []).length,
        bill_count: (bills || []).length,
        expense_count: (expenses || []).length,
        active_jobs: activeJobs,
        total_jobs: (jobs || []).length,
        total_contract_value: totalContractValue,
      });
    }

    // Calculate consolidated totals
    const totalRevenue = entityFinancials.reduce((s, e) => s + e.revenue, 0);
    const totalExpenses = entityFinancials.reduce((s, e) => s + e.expenses, 0);
    const netIncome = totalRevenue - totalExpenses;

    // Get intercompany transactions that need elimination
    let icQuery = supabaseAdmin
      .from('intercompany_transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'posted');
    const { data: icTransactions } = await icQuery;

    const intercompanyElimination = (icTransactions as any[] || [])
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

    return NextResponse.json({
      success: true,
      data: entityFinancials.sort((a, b) => b.revenue - a.revenue),
      summary: {
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_income: netIncome,
        margin_pct: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100) : 0,
        entity_count: entityFinancials.length,
        intercompany_elimination: intercompanyElimination,
        consolidated_net: netIncome - intercompanyElimination,
        total_active_jobs: entityFinancials.reduce((s, e) => s + e.active_jobs, 0),
        total_contract_value: entityFinancials.reduce((s, e) => s + e.total_contract_value, 0),
      },
    });
  } catch (error) {
    console.error('Error generating consolidated report:', error);
    return NextResponse.json({ error: 'Failed to generate consolidated report' }, { status: 500 });
  }
}
