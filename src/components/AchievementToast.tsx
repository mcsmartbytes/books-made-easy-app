'use client';

import { useState, useEffect } from 'react';

interface Achievement {
  id: string;
  name: string;
  icon: string;
  xpReward: number;
}

interface LevelUp {
  level: number;
  name: string;
  icon: string;
}

interface AchievementToastProps {
  achievements?: Achievement[];
  levelUp?: LevelUp | null;
  xpAwarded?: number;
  onDismiss: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export default function AchievementToast({
  achievements = [],
  levelUp = null,
  xpAwarded = 0,
  onDismiss,
  autoHide = true,
  autoHideDelay = 5000,
}: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const enterTimeout = setTimeout(() => setIsVisible(true), 50);

    // Auto-hide after delay
    let hideTimeout: NodeJS.Timeout;
    if (autoHide) {
      hideTimeout = setTimeout(() => {
        handleDismiss();
      }, autoHideDelay);
    }

    return () => {
      clearTimeout(enterTimeout);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [autoHide, autoHideDelay]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const hasAchievements = achievements.length > 0;
  const hasLevelUp = levelUp !== null;
  const showXP = xpAwarded > 0;

  if (!hasAchievements && !hasLevelUp && !showXP) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {/* Level Up Toast */}
      {hasLevelUp && (
        <div
          className={`transform transition-all duration-300 ease-out ${
            isVisible && !isLeaving
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-2xl shadow-purple-500/20 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-2xl">{levelUp.icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-purple-200 uppercase tracking-wide">
                  Level Up!
                </p>
                <p className="text-lg font-bold text-white">
                  Level {levelUp.level}: {levelUp.name}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-1 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 animate-pulse" />
          </div>
        </div>
      )}

      {/* Achievements Toast */}
      {hasAchievements && (
        <div
          className={`transform transition-all duration-300 ease-out ${
            isVisible && !isLeaving
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0'
          }`}
          style={{ transitionDelay: hasLevelUp ? '150ms' : '0ms' }}
        >
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-2xl shadow-amber-500/20 overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-amber-100 uppercase tracking-wide">
                  🏆 Achievement{achievements.length > 1 ? 's' : ''} Unlocked!
                </p>
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                {achievements.map((achievement, index) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 bg-white/10 rounded-lg px-3 py-2"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <span className="text-2xl">{achievement.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{achievement.name}</p>
                      <p className="text-xs text-amber-100">+{achievement.xpReward} XP</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* XP Award Toast (when no achievements/level up) */}
      {showXP && !hasAchievements && !hasLevelUp && (
        <div
          className={`transform transition-all duration-300 ease-out ${
            isVisible && !isLeaving
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-xl">⭐</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">+{xpAwarded} XP</p>
              <p className="text-xs text-slate-400">Keep it up!</p>
            </div>
            <button
              onClick={handleDismiss}
              className="ml-auto p-1 hover:bg-slate-700 rounded-full transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to manage achievement toasts
export function useAchievementToast() {
  const [toastData, setToastData] = useState<{
    achievements: Achievement[];
    levelUp: LevelUp | null;
    xpAwarded: number;
  } | null>(null);

  const showToast = (data: {
    achievements?: Achievement[];
    levelUp?: LevelUp | null;
    xpAwarded?: number;
  }) => {
    setToastData({
      achievements: data.achievements || [],
      levelUp: data.levelUp || null,
      xpAwarded: data.xpAwarded || 0,
    });
  };

  const hideToast = () => {
    setToastData(null);
  };

  return {
    toastData,
    showToast,
    hideToast,
  };
}
