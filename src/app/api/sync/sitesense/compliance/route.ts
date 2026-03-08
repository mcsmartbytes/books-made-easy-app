import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import {
  checkContractorCompliance,
  getComplianceAlerts,
  get1099Candidates,
} from '@/lib/syncEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/sitesense/compliance?user_id=xxx&entity_id=xxx&vendor_id=xxx&action=xxx
 *
 * Actions:
 * - check: Check single vendor compliance (requires vendor_id)
 * - alerts: Get all compliance alerts for user/entity
 * - 1099: Get 1099 candidates for a year (optional year param, defaults to current)
 * - summary: Overall compliance summary
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const entityId = searchParams.get('entity_id') || undefined;
  const vendorId = searchParams.get('vendor_id');
  const action = searchParams.get('action') || 'summary';
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'check': {
        if (!vendorId) {
          return NextResponse.json({ error: 'vendor_id is required for check action' }, { status: 400 });
        }
        const result = await checkContractorCompliance(vendorId);
        if (!result) {
          return NextResponse.json({
            success: true,
            data: { vendorId, complianceStatus: 'none', message: 'No compliance record found', canPay: true },
          });
        }
        return NextResponse.json({ success: true, data: result });
      }

      case 'alerts': {
        const alerts = await getComplianceAlerts(userId, entityId);
        return NextResponse.json({
          success: true,
          data: {
            alerts,
            summary: {
              total: alerts.length,
              blocked: alerts.filter(a => !a.canPay).length,
              expiring: alerts.filter(a => a.complianceStatus === 'expiring').length,
              expired: alerts.filter(a => a.complianceStatus === 'expired').length,
              missing: alerts.filter(a => a.complianceStatus === 'missing').length,
            },
          },
        });
      }

      case '1099': {
        const candidates = await get1099Candidates(userId, year, entityId);
        return NextResponse.json({
          success: true,
          data: {
            year,
            candidates,
            summary: {
              total_contractors: candidates.length,
              over_threshold: candidates.filter(c => c.over600).length,
              total_paid: candidates.reduce((sum, c) => sum + c.totalPaid, 0),
            },
          },
        });
      }

      case 'summary': {
        // Get all compliance records for this user
        let query = supabaseAdmin
          .from('contractor_compliance')
          .select('compliance_status')
          .eq('user_id', userId);

        if (entityId) query = query.eq('entity_id', entityId);

        const { data: records, error } = await query;
        if (error) throw error;

        const statusCounts: Record<string, number> = {
          compliant: 0,
          expiring: 0,
          expired: 0,
          missing: 0,
        };

        for (const row of (records || []) as any[]) {
          const s = row.compliance_status || 'missing';
          statusCounts[s] = (statusCounts[s] || 0) + 1;
        }

        // Get 1099 summary for current year
        const candidates = await get1099Candidates(userId, year, entityId);

        return NextResponse.json({
          success: true,
          data: {
            compliance: statusCounts,
            total_contractors: (records || []).length,
            payment_blocked: statusCounts.expired + statusCounts.missing,
            tax_reporting: {
              year,
              contractors_over_600: candidates.filter(c => c.over600).length,
              total_1099_amount: candidates.filter(c => c.over600).reduce((sum, c) => sum + c.totalPaid, 0),
            },
          },
        });
      }

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Compliance error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch compliance data' }, { status: 500 });
  }
}
