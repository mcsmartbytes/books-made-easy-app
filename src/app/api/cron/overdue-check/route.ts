import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { execSql } from '@/lib/turso';

export const dynamic = 'force-dynamic';

// GET /api/cron/overdue-check — Daily cron: mark overdue, auto-reminders, auto-late-fees
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const results = {
    marked_overdue: 0,
    reminders_sent: 0,
    late_fees_applied: 0,
    errors: [] as string[],
  };

  try {
    // 1. Mark invoices as overdue where status='sent' and due_date < today
    const overdueInvoices = await execSql(
      `UPDATE "invoices" SET "status" = 'overdue' WHERE "status" = 'sent' AND "due_date" < ? RETURNING *`,
      [today]
    );
    results.marked_overdue = overdueInvoices.length;

    // 2. Get all overdue invoices (including ones that were already overdue)
    const allOverdue = await execSql(
      `SELECT * FROM "invoices" WHERE "status" = 'overdue'`,
      []
    );

    if (allOverdue.length === 0) {
      return NextResponse.json({ success: true, results });
    }

    // Get unique user IDs from overdue invoices
    const userIds = [...new Set(allOverdue.map(inv => inv.user_id as string))];

    // 3. Process auto-reminders per user
    for (const userId of userIds) {
      try {
        const { data: reminderSettings } = await supabaseAdmin
          .from('reminder_settings')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (reminderSettings && (reminderSettings as Record<string, unknown>).enabled) {
          const settings = reminderSettings as Record<string, unknown>;
          const graceDays = settings.grace_period_days as number;
          const frequencyDays = settings.frequency_days as number;
          const maxReminders = settings.max_reminders as number;
          const defaultMessage = settings.default_message as string;

          const userOverdue = allOverdue.filter(inv => inv.user_id === userId);

          for (const invoice of userOverdue) {
            const dueDate = new Date(invoice.due_date as string);
            const daysPastDue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

            // Check if past grace period
            if (daysPastDue < graceDays) continue;

            // Get existing reminders for this invoice
            const { data: existingReminders } = await supabaseAdmin
              .from('invoice_reminders')
              .select('*')
              .eq('invoice_id', invoice.id)
              .order('sent_at', { ascending: false });

            const reminderCount = (existingReminders || []).length;
            if (reminderCount >= maxReminders) continue;

            // Check frequency — only send if enough time has passed since last reminder
            if (reminderCount > 0) {
              const lastReminder = (existingReminders as Record<string, unknown>[])[0];
              const lastSent = new Date(lastReminder.sent_at as string);
              const daysSinceLast = Math.floor((Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceLast < frequencyDays) continue;
            }

            // Create auto reminder
            await supabaseAdmin
              .from('invoice_reminders')
              .insert({
                user_id: userId,
                invoice_id: invoice.id as string,
                reminder_type: 'automatic',
                message: defaultMessage,
                sent_at: new Date().toISOString(),
              });

            results.reminders_sent++;
          }
        }

        // 4. Process auto-late-fees per user
        const { data: feeSettings } = await supabaseAdmin
          .from('late_fee_settings')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (feeSettings) {
          const settings = feeSettings as Record<string, unknown>;
          if (settings.enabled && settings.auto_apply) {
            const graceDays = settings.grace_period_days as number;
            const feeType = settings.fee_type as string;
            const feeAmount = settings.fee_amount as number;
            const maxFees = settings.max_fees_per_invoice as number;

            const userOverdue = allOverdue.filter(inv => inv.user_id === userId);

            for (const invoice of userOverdue) {
              const dueDate = new Date(invoice.due_date as string);
              const daysPastDue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

              if (daysPastDue < graceDays) continue;

              // Check existing fees
              const { data: existingFees } = await supabaseAdmin
                .from('invoice_late_fees')
                .select('*')
                .eq('invoice_id', invoice.id)
                .eq('reversed', 0);

              const feeCount = (existingFees || []).length;
              if (feeCount >= maxFees) continue;

              // Check if a fee was already applied recently (within frequency of grace_period_days)
              if (feeCount > 0) {
                const latestFee = (existingFees as Record<string, unknown>[]).sort(
                  (a, b) => new Date(b.applied_at as string).getTime() - new Date(a.applied_at as string).getTime()
                )[0];
                const lastApplied = new Date(latestFee.applied_at as string);
                const daysSinceLast = Math.floor((Date.now() - lastApplied.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceLast < graceDays) continue;
              }

              // Calculate and apply fee
              const invoiceTotal = invoice.total as number;
              let calculatedFee: number;
              if (feeType === 'percentage') {
                calculatedFee = Math.round(invoiceTotal * (feeAmount / 100) * 100) / 100;
              } else {
                calculatedFee = feeAmount;
              }

              const newTotal = Math.round((invoiceTotal + calculatedFee) * 100) / 100;

              // Update invoice
              await supabaseAdmin
                .from('invoices')
                .update({ total: newTotal })
                .eq('id', invoice.id);

              // Create fee record
              await supabaseAdmin
                .from('invoice_late_fees')
                .insert({
                  user_id: userId,
                  invoice_id: invoice.id as string,
                  fee_type: feeType,
                  fee_amount: feeAmount,
                  calculated_fee: calculatedFee,
                  invoice_total_before: invoiceTotal,
                  invoice_total_after: newTotal,
                  applied_type: 'automatic',
                  reversed: 0,
                  applied_at: new Date().toISOString(),
                });

              results.late_fees_applied++;
            }
          }
        }
      } catch (err) {
        results.errors.push(`User ${userId}: ${(err as Error).message}`);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Cron overdue-check error:', error);
    return NextResponse.json({ error: 'Cron job failed', details: (error as Error).message }, { status: 500 });
  }
}
