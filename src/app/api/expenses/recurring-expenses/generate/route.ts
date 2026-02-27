import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';

// POST - generate due recurring expenses
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // Get all active recurring expenses that are due
    const { data: dueExpenses, error: fetchError } = await supabaseAdmin
      .from('recurring_expenses')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .lte('next_due_date', today);

    if (fetchError) throw fetchError;

    const dueExpensesList = (dueExpenses || []) as any[];
    if (dueExpensesList.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        message: 'No recurring expenses due'
      });
    }

    const generatedExpenses = [];

    for (const recurring of dueExpensesList) {
      // Create the expense
      const { data: newExpense, error: insertError } = await supabaseAdmin
        .from('expenses')
        .insert({
          user_id: recurring.user_id,
          amount: recurring.amount,
          description: recurring.description,
          category_id: recurring.category_id,
          vendor: recurring.vendor,
          payment_method: recurring.payment_method,
          is_business: recurring.is_business,
          notes: recurring.notes ? `${recurring.notes} (Auto-generated from recurring)` : '(Auto-generated from recurring)',
          date: recurring.next_due_date,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating expense:', insertError);
        continue;
      }

      generatedExpenses.push(newExpense);

      // Calculate next due date
      const nextDueDate = calculateNextDueDate(
        new Date(recurring.next_due_date),
        recurring.frequency
      );

      // Update the recurring expense with new next_due_date and last_generated_date
      await supabaseAdmin
        .from('recurring_expenses')
        .update({
          next_due_date: nextDueDate.toISOString().split('T')[0],
          last_generated_date: today,
        })
        .eq('id', recurring.id);
    }

    return NextResponse.json({
      success: true,
      generated: generatedExpenses.length,
      expenses: generatedExpenses,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function calculateNextDueDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1); // Default to monthly
  }

  return next;
}
