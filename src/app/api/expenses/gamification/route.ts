import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';
import {
  getDefaultGamificationState,
  processAction,
  getStatsSummary,
  getAchievementProgress,
  GamificationState,
  XP_AWARDS,
} from '@/lib/gamification';

export const dynamic = 'force-dynamic';

// GET /api/gamification?user_id=xxx
// Returns current gamification state, stats, and achievements
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Get user profile with gamification data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .single();

    let gamificationState: GamificationState;

    if (profileError || !profile) {
      // No profile yet, return defaults
      gamificationState = getDefaultGamificationState();
    } else {
      // Extract gamification state from preferences
      const profileData = profile as any;
      const preferences = profileData.preferences || {};
      gamificationState = preferences.gamification || getDefaultGamificationState();
    }

    // Calculate real-time stats from database to sync state
    const syncedState = await syncStatsFromDatabase(userId, gamificationState);

    const summary = getStatsSummary(syncedState);
    const achievements = getAchievementProgress(syncedState);

    return NextResponse.json({
      state: syncedState,
      summary,
      achievements,
    });
  } catch (error) {
    console.error('Error fetching gamification state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gamification state' },
      { status: 500 }
    );
  }
}

// POST /api/gamification
// Award XP for an action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, action, additionalData } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    if (!action || !Object.keys(XP_AWARDS).includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get current gamification state
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', user_id)
      .single();

    let currentState: GamificationState;
    let existingPreferences: Record<string, unknown> = {};

    const profileData = profile as any;
    if (profileData?.preferences) {
      existingPreferences = profileData.preferences;
      currentState = existingPreferences.gamification as GamificationState || getDefaultGamificationState();
    } else {
      currentState = getDefaultGamificationState();
    }

    // Process the action
    const result = processAction(currentState, action as keyof typeof XP_AWARDS, additionalData);

    // Update the profile with new gamification state
    const updatedPreferences = {
      ...existingPreferences,
      gamification: result.updatedState,
    };

    // Upsert the profile
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id,
        preferences: updatedPreferences,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (updateError) {
      console.error('Error updating gamification state:', updateError);
      return NextResponse.json(
        { error: 'Failed to update gamification state' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      xpAwarded: result.xpAwarded,
      totalXP: result.totalXP,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      newAchievements: result.newAchievements,
      currentStreak: result.currentStreak,
      streakUpdated: result.streakUpdated,
    });
  } catch (error) {
    console.error('Error processing gamification action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}

// Helper to sync stats from database
async function syncStatsFromDatabase(userId: string, currentState: GamificationState): Promise<GamificationState> {
  const state = { ...currentState };
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Get expense count
    const { data: expenseData } = await supabaseAdmin
      .from('expenses')
      .select('id')
      .eq('user_id', userId);
    const expenseCount = expenseData?.length || 0;

    // Get budget count
    const { data: budgetData } = await supabaseAdmin
      .from('budgets')
      .select('id')
      .eq('user_id', userId);
    const budgetCount = budgetData?.length || 0;

    // Get category count
    const { data: categoryData } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('user_id', userId);
    const categoryCount = categoryData?.length || 0;

    // Get recurring expense count
    const { data: recurringData } = await supabaseAdmin
      .from('recurring_expenses')
      .select('id')
      .eq('user_id', userId);
    const recurringCount = recurringData?.length || 0;

    // Get total mileage
    const { data: mileageData } = await supabaseAdmin
      .from('mileage')
      .select('distance')
      .eq('user_id', userId)
      .eq('is_business', true);

    const mileageList = (mileageData || []) as any[];
    const totalMileage = mileageList.reduce((sum, m) => sum + (m.distance || 0), 0);

    // Get receipt count (expenses with receipt_url)
    const { data: receiptData } = await supabaseAdmin
      .from('expenses')
      .select('id, receipt_url')
      .eq('user_id', userId);
    const receiptCount = (receiptData || []).filter((e: any) => e.receipt_url != null).length;

    // Get total deductions
    const { data: deductionData } = await supabaseAdmin
      .from('expenses')
      .select('amount, categories!inner(deduction_percentage)')
      .eq('user_id', userId)
      .eq('is_business', true);

    const deductionList = (deductionData || []) as any[];
    const totalDeductions = deductionList.reduce((sum, e) => {
      const percentage = (e.categories as { deduction_percentage?: number })?.deduction_percentage || 0;
      return sum + (e.amount * percentage / 100);
    }, 0);

    // Update stats with real values (use max of stored vs calculated to not lose progress)
    state.stats = {
      ...state.stats,
      total_expenses_logged: Math.max(state.stats.total_expenses_logged, expenseCount || 0),
      total_budgets_created: Math.max(state.stats.total_budgets_created, budgetCount || 0),
      total_categories_created: Math.max(state.stats.total_categories_created, categoryCount || 0),
      total_recurring_expenses: Math.max(state.stats.total_recurring_expenses, recurringCount || 0),
      total_mileage_logged: Math.max(state.stats.total_mileage_logged, totalMileage),
      total_receipts_scanned: Math.max(state.stats.total_receipts_scanned, receiptCount || 0),
      total_deductions_tracked: Math.max(state.stats.total_deductions_tracked, totalDeductions),
    };

  } catch (error) {
    console.error('Error syncing stats:', error);
  }

  return state;
}
