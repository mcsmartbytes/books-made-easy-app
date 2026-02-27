// Gamification System - XP, Levels, Achievements, Streaks

// Level definitions
export const LEVELS = [
  { level: 1, name: 'Starter', xpRequired: 0, icon: '🌱' },
  { level: 2, name: 'Tracker', xpRequired: 100, icon: '📝' },
  { level: 3, name: 'Organizer', xpRequired: 300, icon: '📊' },
  { level: 4, name: 'Strategist', xpRequired: 600, icon: '🎯' },
  { level: 5, name: 'Expert', xpRequired: 1000, icon: '⭐' },
  { level: 6, name: 'Master', xpRequired: 2000, icon: '👑' },
] as const;

// XP awards for different actions
export const XP_AWARDS = {
  log_expense: 10,
  categorize_expense: 5,
  scan_receipt: 15,
  create_budget: 25,
  log_mileage: 10,
  recurring_generated: 5,
  daily_streak: 5,
  stay_under_budget: 20,
  use_money_memory: 10,
} as const;

// Achievement definitions
export const ACHIEVEMENTS = {
  first_expense: {
    id: 'first_expense',
    name: 'First Steps',
    description: 'Log your first expense',
    icon: '🎉',
    xpReward: 50,
    requirement: { type: 'expense_count', value: 1 },
  },
  expense_10: {
    id: 'expense_10',
    name: 'Getting Started',
    description: 'Log 10 expenses',
    icon: '📝',
    xpReward: 75,
    requirement: { type: 'expense_count', value: 10 },
  },
  expense_50: {
    id: 'expense_50',
    name: 'Dedicated Tracker',
    description: 'Log 50 expenses',
    icon: '📚',
    xpReward: 100,
    requirement: { type: 'expense_count', value: 50 },
  },
  expense_100: {
    id: 'expense_100',
    name: 'Expense Pro',
    description: 'Log 100 expenses',
    icon: '🏅',
    xpReward: 150,
    requirement: { type: 'expense_count', value: 100 },
  },
  expense_500: {
    id: 'expense_500',
    name: 'Expense Master',
    description: 'Log 500 expenses',
    icon: '🏆',
    xpReward: 300,
    requirement: { type: 'expense_count', value: 500 },
  },
  first_budget: {
    id: 'first_budget',
    name: 'Budget Beginner',
    description: 'Create your first budget',
    icon: '💰',
    xpReward: 50,
    requirement: { type: 'budget_count', value: 1 },
  },
  budget_5: {
    id: 'budget_5',
    name: 'Budget Planner',
    description: 'Create 5 budgets',
    icon: '📈',
    xpReward: 100,
    requirement: { type: 'budget_count', value: 5 },
  },
  streak_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Log expenses 7 days in a row',
    icon: '🔥',
    xpReward: 100,
    requirement: { type: 'streak', value: 7 },
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Champion',
    description: '30-day logging streak',
    icon: '💪',
    xpReward: 250,
    requirement: { type: 'streak', value: 30 },
  },
  streak_100: {
    id: 'streak_100',
    name: 'Streak Legend',
    description: '100-day logging streak',
    icon: '🌟',
    xpReward: 500,
    requirement: { type: 'streak', value: 100 },
  },
  budget_master: {
    id: 'budget_master',
    name: 'Budget Master',
    description: 'Stay under budget for a full month',
    icon: '🎯',
    xpReward: 200,
    requirement: { type: 'budget_compliance_month', value: 1 },
  },
  category_pro: {
    id: 'category_pro',
    name: 'Category Pro',
    description: 'Create 10+ custom categories',
    icon: '🏷️',
    xpReward: 100,
    requirement: { type: 'category_count', value: 10 },
  },
  receipt_scanner: {
    id: 'receipt_scanner',
    name: 'Receipt Scanner',
    description: 'Scan 25 receipts with OCR',
    icon: '📷',
    xpReward: 150,
    requirement: { type: 'receipt_scan_count', value: 25 },
  },
  mileage_100: {
    id: 'mileage_100',
    name: 'Road Warrior',
    description: 'Log 100+ business miles',
    icon: '🚗',
    xpReward: 100,
    requirement: { type: 'mileage_total', value: 100 },
  },
  mileage_1000: {
    id: 'mileage_1000',
    name: 'Highway Hero',
    description: 'Log 1,000+ business miles',
    icon: '🛣️',
    xpReward: 200,
    requirement: { type: 'mileage_total', value: 1000 },
  },
  savings_hunter_50: {
    id: 'savings_hunter_50',
    name: 'Savings Hunter',
    description: 'Save $50+ using Money Memory suggestions',
    icon: '💵',
    xpReward: 150,
    requirement: { type: 'memory_savings', value: 50 },
  },
  savings_hunter_200: {
    id: 'savings_hunter_200',
    name: 'Savings Expert',
    description: 'Save $200+ using Money Memory suggestions',
    icon: '💎',
    xpReward: 300,
    requirement: { type: 'memory_savings', value: 200 },
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Log 10 expenses within 1 hour of purchase',
    icon: '⏰',
    xpReward: 100,
    requirement: { type: 'quick_log_count', value: 10 },
  },
  recurring_master: {
    id: 'recurring_master',
    name: 'Automation Expert',
    description: 'Set up 5+ recurring expenses',
    icon: '🔄',
    xpReward: 100,
    requirement: { type: 'recurring_count', value: 5 },
  },
  tax_optimizer: {
    id: 'tax_optimizer',
    name: 'Tax Optimizer',
    description: 'Track $1,000+ in tax deductions',
    icon: '📋',
    xpReward: 150,
    requirement: { type: 'deduction_total', value: 1000 },
  },
} as const;

export type AchievementId = keyof typeof ACHIEVEMENTS;

// Types
export interface GamificationState {
  level: number;
  xp: number;
  streaks: {
    daily_logs: number;
    daily_logs_last_date: string | null;
    longest_streak: number;
    budget_compliant_days: number;
  };
  achievements: Record<string, {
    earned: boolean;
    earned_at: string | null;
  }>;
  stats: {
    total_expenses_logged: number;
    total_receipts_scanned: number;
    total_budgets_created: number;
    total_categories_created: number;
    total_mileage_logged: number;
    total_recurring_expenses: number;
    total_deductions_tracked: number;
    total_quick_logs: number;
    total_memory_savings: number;
    months_under_budget: number;
  };
}

// Default state for new users
export function getDefaultGamificationState(): GamificationState {
  const defaultAchievements: Record<string, { earned: boolean; earned_at: string | null }> = {};
  Object.keys(ACHIEVEMENTS).forEach(id => {
    defaultAchievements[id] = { earned: false, earned_at: null };
  });

  return {
    level: 1,
    xp: 0,
    streaks: {
      daily_logs: 0,
      daily_logs_last_date: null,
      longest_streak: 0,
      budget_compliant_days: 0,
    },
    achievements: defaultAchievements,
    stats: {
      total_expenses_logged: 0,
      total_receipts_scanned: 0,
      total_budgets_created: 0,
      total_categories_created: 0,
      total_mileage_logged: 0,
      total_recurring_expenses: 0,
      total_deductions_tracked: 0,
      total_quick_logs: 0,
      total_memory_savings: 0,
      months_under_budget: 0,
    },
  };
}

// Calculate level from XP
type LevelInfo = { level: number; name: string; xpRequired: number; icon: string };

export function calculateLevel(xp: number): { level: number; name: string; icon: string; xpForNext: number; progress: number } {
  let currentLevel: LevelInfo = LEVELS[0];
  let nextLevel: LevelInfo = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }

  const xpInCurrentLevel = xp - currentLevel.xpRequired;
  const xpNeededForNext = nextLevel.xpRequired - currentLevel.xpRequired;
  const progress = currentLevel.level === 6 ? 100 : Math.floor((xpInCurrentLevel / xpNeededForNext) * 100);

  return {
    level: currentLevel.level,
    name: currentLevel.name,
    icon: currentLevel.icon,
    xpForNext: nextLevel.xpRequired,
    progress,
  };
}

// Update streak based on today's activity
export function updateStreak(state: GamificationState, today: string): {
  newStreak: number;
  streakBonus: number;
  isNewStreak: boolean;
} {
  const lastDate = state.streaks.daily_logs_last_date;

  if (!lastDate) {
    // First ever expense
    return { newStreak: 1, streakBonus: XP_AWARDS.daily_streak, isNewStreak: true };
  }

  const last = new Date(lastDate);
  const current = new Date(today);
  const diffDays = Math.floor((current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day, no streak update
    return { newStreak: state.streaks.daily_logs, streakBonus: 0, isNewStreak: false };
  } else if (diffDays === 1) {
    // Consecutive day
    const newStreak = state.streaks.daily_logs + 1;
    return { newStreak, streakBonus: XP_AWARDS.daily_streak, isNewStreak: true };
  } else {
    // Streak broken
    return { newStreak: 1, streakBonus: XP_AWARDS.daily_streak, isNewStreak: true };
  }
}

// Check which achievements should be unlocked
export function checkAchievements(state: GamificationState): AchievementId[] {
  const newAchievements: AchievementId[] = [];

  Object.entries(ACHIEVEMENTS).forEach(([id, achievement]) => {
    const achievementId = id as AchievementId;

    // Skip if already earned
    if (state.achievements[achievementId]?.earned) return;

    const { type, value } = achievement.requirement;
    let currentValue = 0;

    switch (type) {
      case 'expense_count':
        currentValue = state.stats.total_expenses_logged;
        break;
      case 'budget_count':
        currentValue = state.stats.total_budgets_created;
        break;
      case 'streak':
        currentValue = state.streaks.daily_logs;
        break;
      case 'category_count':
        currentValue = state.stats.total_categories_created;
        break;
      case 'receipt_scan_count':
        currentValue = state.stats.total_receipts_scanned;
        break;
      case 'mileage_total':
        currentValue = state.stats.total_mileage_logged;
        break;
      case 'memory_savings':
        currentValue = state.stats.total_memory_savings;
        break;
      case 'quick_log_count':
        currentValue = state.stats.total_quick_logs;
        break;
      case 'recurring_count':
        currentValue = state.stats.total_recurring_expenses;
        break;
      case 'deduction_total':
        currentValue = state.stats.total_deductions_tracked;
        break;
      case 'budget_compliance_month':
        currentValue = state.stats.months_under_budget;
        break;
    }

    if (currentValue >= value) {
      newAchievements.push(achievementId);
    }
  });

  return newAchievements;
}

// Award XP and check for level up
export function awardXP(
  state: GamificationState,
  amount: number,
  _reason: keyof typeof XP_AWARDS
): {
  newXP: number;
  leveledUp: boolean;
  newLevel: number | null;
  xpAwarded: number;
} {
  const oldLevel = calculateLevel(state.xp);
  const newXP = state.xp + amount;
  const newLevelInfo = calculateLevel(newXP);
  const leveledUp = newLevelInfo.level > oldLevel.level;

  return {
    newXP,
    leveledUp,
    newLevel: leveledUp ? newLevelInfo.level : null,
    xpAwarded: amount,
  };
}

// Process an action and return all updates
export interface GamificationUpdate {
  xpAwarded: number;
  totalXP: number;
  leveledUp: boolean;
  newLevel: { level: number; name: string; icon: string } | null;
  newAchievements: Array<{ id: AchievementId; name: string; icon: string; xpReward: number }>;
  streakUpdated: boolean;
  currentStreak: number;
  updatedState: GamificationState;
}

export function processAction(
  currentState: GamificationState,
  action: keyof typeof XP_AWARDS,
  additionalData?: {
    mileage?: number;
    deductionAmount?: number;
    memorySavings?: number;
    isQuickLog?: boolean;
  }
): GamificationUpdate {
  const today = new Date().toISOString().split('T')[0];
  const state = JSON.parse(JSON.stringify(currentState)) as GamificationState;

  let totalXPAwarded = 0;
  const newAchievementsList: Array<{ id: AchievementId; name: string; icon: string; xpReward: number }> = [];

  // Update stats based on action
  switch (action) {
    case 'log_expense':
      state.stats.total_expenses_logged += 1;
      break;
    case 'scan_receipt':
      state.stats.total_receipts_scanned += 1;
      break;
    case 'create_budget':
      state.stats.total_budgets_created += 1;
      break;
    case 'log_mileage':
      state.stats.total_mileage_logged += additionalData?.mileage || 0;
      break;
    case 'recurring_generated':
      state.stats.total_recurring_expenses += 1;
      break;
    case 'use_money_memory':
      state.stats.total_memory_savings += additionalData?.memorySavings || 0;
      break;
  }

  // Track quick logs
  if (additionalData?.isQuickLog) {
    state.stats.total_quick_logs += 1;
  }

  // Track deductions
  if (additionalData?.deductionAmount) {
    state.stats.total_deductions_tracked += additionalData.deductionAmount;
  }

  // Award base XP
  const baseXP = XP_AWARDS[action];
  totalXPAwarded += baseXP;

  // Update streak for logging actions
  let streakUpdated = false;
  if (action === 'log_expense' || action === 'log_mileage' || action === 'scan_receipt') {
    const streakResult = updateStreak(state, today);
    state.streaks.daily_logs = streakResult.newStreak;
    state.streaks.daily_logs_last_date = today;

    if (streakResult.newStreak > state.streaks.longest_streak) {
      state.streaks.longest_streak = streakResult.newStreak;
    }

    totalXPAwarded += streakResult.streakBonus;
    streakUpdated = streakResult.isNewStreak;
  }

  // Check for new achievements
  const earnedAchievements = checkAchievements(state);
  earnedAchievements.forEach(achievementId => {
    const achievement = ACHIEVEMENTS[achievementId];
    state.achievements[achievementId] = {
      earned: true,
      earned_at: new Date().toISOString(),
    };
    totalXPAwarded += achievement.xpReward;
    newAchievementsList.push({
      id: achievementId,
      name: achievement.name,
      icon: achievement.icon,
      xpReward: achievement.xpReward,
    });
  });

  // Update XP and check for level up
  const oldLevel = calculateLevel(state.xp);
  state.xp += totalXPAwarded;
  const newLevelInfo = calculateLevel(state.xp);
  const leveledUp = newLevelInfo.level > oldLevel.level;

  state.level = newLevelInfo.level;

  return {
    xpAwarded: totalXPAwarded,
    totalXP: state.xp,
    leveledUp,
    newLevel: leveledUp ? { level: newLevelInfo.level, name: newLevelInfo.name, icon: newLevelInfo.icon } : null,
    newAchievements: newAchievementsList,
    streakUpdated,
    currentStreak: state.streaks.daily_logs,
    updatedState: state,
  };
}

// Get progress towards each unearned achievement
export function getAchievementProgress(state: GamificationState): Array<{
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  progress: number;
  current: number;
  required: number;
}> {
  return Object.entries(ACHIEVEMENTS).map(([id, achievement]) => {
    const achievementId = id as AchievementId;
    const earned = state.achievements[achievementId]?.earned || false;
    const earnedAt = state.achievements[achievementId]?.earned_at || null;
    const { type, value } = achievement.requirement;

    let current = 0;
    switch (type) {
      case 'expense_count':
        current = state.stats.total_expenses_logged;
        break;
      case 'budget_count':
        current = state.stats.total_budgets_created;
        break;
      case 'streak':
        current = state.streaks.longest_streak;
        break;
      case 'category_count':
        current = state.stats.total_categories_created;
        break;
      case 'receipt_scan_count':
        current = state.stats.total_receipts_scanned;
        break;
      case 'mileage_total':
        current = state.stats.total_mileage_logged;
        break;
      case 'memory_savings':
        current = state.stats.total_memory_savings;
        break;
      case 'quick_log_count':
        current = state.stats.total_quick_logs;
        break;
      case 'recurring_count':
        current = state.stats.total_recurring_expenses;
        break;
      case 'deduction_total':
        current = state.stats.total_deductions_tracked;
        break;
      case 'budget_compliance_month':
        current = state.stats.months_under_budget;
        break;
    }

    const progress = earned ? 100 : Math.min(100, Math.floor((current / value) * 100));

    return {
      id: achievementId,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      earned,
      earnedAt,
      progress,
      current,
      required: value,
    };
  });
}

// Get stats summary for display
export function getStatsSummary(state: GamificationState) {
  const levelInfo = calculateLevel(state.xp);
  const earnedCount = Object.values(state.achievements).filter(a => a.earned).length;
  const totalAchievements = Object.keys(ACHIEVEMENTS).length;

  return {
    level: levelInfo.level,
    levelName: levelInfo.name,
    levelIcon: levelInfo.icon,
    xp: state.xp,
    xpForNext: levelInfo.xpForNext,
    progress: levelInfo.progress,
    currentStreak: state.streaks.daily_logs,
    longestStreak: state.streaks.longest_streak,
    achievementsEarned: earnedCount,
    totalAchievements,
    totalExpenses: state.stats.total_expenses_logged,
  };
}
