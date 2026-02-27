'use client';

import { useState, useEffect } from 'react';
import { LEVELS } from '@/lib/gamification';

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

interface AchievementsGalleryProps {
  userId: string;
}

export default function AchievementsGallery({ userId }: AchievementsGalleryProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');

  useEffect(() => {
    fetchGamificationData();
  }, [userId]);

  const fetchGamificationData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/gamification?user_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setSummary(data.summary);
      setAchievements(data.achievements || []);
    } catch (error) {
      console.error('Error fetching gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAchievements = achievements.filter(a => {
    if (filter === 'earned') return a.earned;
    if (filter === 'locked') return !a.earned;
    return true;
  });

  const earnedCount = achievements.filter(a => a.earned).length;
  const lockedCount = achievements.filter(a => !a.earned).length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="achievements" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Achievements
            </h2>
            <p className="text-purple-200 text-sm mt-1">
              Track your progress and unlock badges
            </p>
          </div>

          {summary && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{earnedCount}</div>
                <div className="text-xs text-purple-200 uppercase">Earned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{lockedCount}</div>
                <div className="text-xs text-purple-200 uppercase">Locked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold flex items-center gap-1">
                  {summary.levelIcon} {summary.level}
                </div>
                <div className="text-xs text-purple-200 uppercase">{summary.levelName}</div>
              </div>
            </div>
          )}
        </div>

        {/* XP Progress Bar */}
        {summary && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-purple-200 mb-1">
              <span>Level {summary.level}</span>
              <span>{summary.xp.toLocaleString()} / {summary.xpForNext.toLocaleString()} XP</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-500"
                style={{ width: `${summary.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 px-6 py-3 flex gap-4">
        {[
          { key: 'all', label: 'All', count: achievements.length },
          { key: 'earned', label: 'Earned', count: earnedCount },
          { key: 'locked', label: 'Locked', count: lockedCount },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
              filter === tab.key
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAchievements.map(achievement => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>

        {filteredAchievements.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">
              {filter === 'earned' ? '😢' : filter === 'locked' ? '🎉' : '🤔'}
            </p>
            <p>
              {filter === 'earned'
                ? 'No achievements earned yet. Keep tracking!'
                : filter === 'locked'
                ? 'All achievements unlocked! Amazing!'
                : 'No achievements available'}
            </p>
          </div>
        )}
      </div>

      {/* Level Progression */}
      <div className="border-t border-gray-200 px-6 py-5 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Level Progression</h3>
        <div className="flex items-center gap-2">
          {LEVELS.map((level, idx) => {
            const isCurrentLevel = summary?.level === level.level;
            const isPastLevel = summary && summary.level > level.level;
            const _isFutureLevel = summary && summary.level < level.level;

            return (
              <div key={level.level} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                    isCurrentLevel
                      ? 'bg-purple-600 ring-4 ring-purple-200 shadow-lg'
                      : isPastLevel
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`}
                  title={`Level ${level.level}: ${level.name} (${level.xpRequired} XP)`}
                >
                  {level.icon}
                </div>
                {idx < LEVELS.length - 1 && (
                  <div
                    className={`w-6 h-1 ${
                      isPastLevel ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          {LEVELS.map(level => (
            <span key={level.level} className="w-10 text-center">
              {level.name}
            </span>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      {summary && (
        <div className="border-t border-gray-200 px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Your Stats</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon="📝" label="Expenses Logged" value={summary.totalExpenses} />
            <StatCard icon="🔥" label="Current Streak" value={`${summary.currentStreak} days`} />
            <StatCard icon="⚡" label="Longest Streak" value={`${summary.longestStreak} days`} />
            <StatCard icon="⭐" label="Total XP" value={summary.xp.toLocaleString()} />
          </div>
        </div>
      )}
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const isEarned = achievement.earned;
  const earnedDate = achievement.earnedAt
    ? new Date(achievement.earnedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className={`relative rounded-xl p-4 border transition-all ${
        isEarned
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      {/* Icon */}
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-3 ${
          isEarned
            ? 'bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg'
            : 'bg-gray-200 grayscale opacity-50'
        }`}
      >
        {achievement.icon}
      </div>

      {/* Content */}
      <h4
        className={`font-semibold text-sm ${
          isEarned ? 'text-gray-900' : 'text-gray-500'
        }`}
      >
        {achievement.name}
      </h4>
      <p
        className={`text-xs mt-1 ${
          isEarned ? 'text-gray-600' : 'text-gray-400'
        }`}
      >
        {achievement.description}
      </p>

      {/* Progress or Earned Date */}
      {isEarned ? (
        <div className="mt-3 flex items-center gap-1 text-xs text-amber-700">
          <span>✓</span>
          <span>Earned {earnedDate}</span>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>
              {achievement.current} / {achievement.required}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${achievement.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Locked Overlay Icon */}
      {!isEarned && (
        <div className="absolute top-3 right-3">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
