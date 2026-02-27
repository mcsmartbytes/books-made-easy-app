'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface GamificationSummary {
  level: number;
  levelName: string;
  levelIcon: string;
  xp: number;
  xpForNext: number;
  progress: number;
  currentStreak: number;
  longestStreak: number;
  achievementsEarned: number;
  totalAchievements: number;
  totalExpenses: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  progress: number;
  current: number;
  required: number;
}

interface GamificationWidgetProps {
  userId: string;
  variant?: 'full' | 'compact';
}

export default function GamificationWidget({ userId, variant = 'full' }: GamificationWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [recentAchievements, setRecentAchievements] = useState<Achievement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGamificationData();
  }, [userId]);

  const fetchGamificationData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/gamification?user_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch gamification data');

      const data = await response.json();
      setSummary(data.summary);

      // Get recently earned achievements (last 7 days)
      const recent = (data.achievements as Achievement[])
        .filter(a => a.earned && a.earnedAt)
        .filter(a => {
          const earnedDate = new Date(a.earnedAt!);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return earnedDate > weekAgo;
        })
        .slice(0, 3);

      setRecentAchievements(recent);
    } catch (err) {
      console.error('Error fetching gamification data:', err);
      setError('Failed to load gamification data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-slate-700 rounded w-1/2 mb-2"></div>
        <div className="h-2 bg-slate-700 rounded w-full"></div>
      </div>
    );
  }

  if (error || !summary) {
    return null; // Silently fail - gamification is non-critical
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
        <span className="text-xl">{summary.levelIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Lvl {summary.level}</span>
            <span className="text-xs text-slate-400">{summary.levelName}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${summary.progress}%` }}
            />
          </div>
        </div>
        {summary.currentStreak > 0 && (
          <div className="flex items-center gap-1 text-orange-400">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-medium">{summary.currentStreak}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
          <span className="text-xl">{summary.levelIcon}</span>
          Level {summary.level}: {summary.levelName}
        </h3>
        <Link
          href="/profile#achievements"
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          All Achievements →
        </Link>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* XP Progress */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-medium text-slate-300">Experience</span>
            <span className="text-xs text-slate-400">
              {summary.xp.toLocaleString()} / {summary.xpForNext.toLocaleString()} XP
            </span>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${summary.progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {summary.xpForNext - summary.xp} XP to Level {summary.level + 1}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Streak */}
          <div className="text-center p-2 rounded-lg bg-slate-700/50">
            <div className="text-2xl mb-0.5">
              {summary.currentStreak > 0 ? '🔥' : '❄️'}
            </div>
            <div className="text-lg font-bold text-white">{summary.currentStreak}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Day Streak</div>
          </div>

          {/* Achievements */}
          <div className="text-center p-2 rounded-lg bg-slate-700/50">
            <div className="text-2xl mb-0.5">🏆</div>
            <div className="text-lg font-bold text-white">
              {summary.achievementsEarned}/{summary.totalAchievements}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Badges</div>
          </div>

          {/* Expenses */}
          <div className="text-center p-2 rounded-lg bg-slate-700/50">
            <div className="text-2xl mb-0.5">📝</div>
            <div className="text-lg font-bold text-white">{summary.totalExpenses}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Logged</div>
          </div>
        </div>

        {/* Recent Achievements */}
        {recentAchievements.length > 0 && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs font-medium text-slate-300 mb-2">Recent Achievements</p>
            <div className="flex flex-wrap gap-2">
              {recentAchievements.map(achievement => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30"
                  title={achievement.description}
                >
                  <span className="text-sm">{achievement.icon}</span>
                  <span className="text-xs font-medium text-amber-200">{achievement.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Motivational Message */}
        {summary.currentStreak > 0 && summary.currentStreak % 7 === 0 && (
          <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
            <p className="text-xs text-orange-200 text-center">
              🎉 {summary.currentStreak}-day streak! You&apos;re on fire!
            </p>
          </div>
        )}

        {summary.currentStreak === 0 && summary.longestStreak > 0 && (
          <div className="p-2 rounded-lg bg-slate-700/30">
            <p className="text-xs text-slate-400 text-center">
              Your best streak: {summary.longestStreak} days. Log an expense to start a new one!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
