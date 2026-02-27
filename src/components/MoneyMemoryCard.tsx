'use client';

import { useState } from 'react';
import { formatPrice, formatDate, ItemMemory, MemorySuggestion } from '@/lib/moneyMemory';

interface MoneyMemoryCardProps {
  memories: Record<string, ItemMemory>;
  suggestions: MemorySuggestion[];
  totalPotentialSavings?: number;
  onDismiss?: () => void;
  variant?: 'inline' | 'card' | 'summary';
}

export default function MoneyMemoryCard({
  memories,
  suggestions,
  totalPotentialSavings = 0,
  onDismiss,
  variant = 'card',
}: MoneyMemoryCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) return null;

  const memoryList = Object.values(memories);
  const hasMemories = memoryList.length > 0;
  const hasSuggestions = suggestions.length > 0;

  if (!hasMemories && !hasSuggestions) return null;

  if (variant === 'inline') {
    // Compact inline display for line items
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {suggestions.slice(0, 2).map((suggestion, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
              suggestion.priority === 'high'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : suggestion.priority === 'medium'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}
          >
            {suggestion.type === 'savings_tip' && '💡'}
            {suggestion.type === 'price_alert' && '⚠️'}
            {suggestion.type === 'vendor_suggestion' && '🏪'}
            {suggestion.message}
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'summary') {
    // Summary card for expense form
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <span className="text-lg">💡</span>
              Money Memory
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              Based on your purchase history
            </p>
          </div>
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {totalPotentialSavings > 0 && (
          <div className="mt-3 p-2 rounded bg-green-100 border border-green-200">
            <p className="text-sm font-medium text-green-800">
              Potential savings: {formatPrice(totalPotentialSavings)}
            </p>
            <p className="text-xs text-green-700">
              by shopping at your cheapest known vendors
            </p>
          </div>
        )}

        {hasSuggestions && (
          <div className="mt-3 space-y-2">
            {suggestions.slice(0, 3).map((suggestion, idx) => (
              <div
                key={idx}
                className={`p-2 rounded text-sm ${
                  suggestion.priority === 'high'
                    ? 'bg-red-100 text-red-800'
                    : suggestion.priority === 'medium'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-white text-gray-700'
                }`}
              >
                <span className="mr-1">
                  {suggestion.type === 'savings_tip' && '💵'}
                  {suggestion.type === 'price_alert' && '📈'}
                  {suggestion.type === 'vendor_suggestion' && '🏪'}
                  {suggestion.type === 'spending_pattern' && '📊'}
                </span>
                {suggestion.message}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full card display
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="text-lg">🧠</span>
          Money Memory
        </h3>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/50 rounded-full transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Potential Savings Banner */}
        {totalPotentialSavings > 0 && (
          <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <p className="text-lg font-bold text-green-800">
                  Save {formatPrice(totalPotentialSavings)}
                </p>
                <p className="text-xs text-green-600">
                  by using your cheapest known vendors
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {hasSuggestions && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Suggestions
            </p>
            {suggestions.map((suggestion, idx) => (
              <SuggestionItem key={idx} suggestion={suggestion} />
            ))}
          </div>
        )}

        {/* Item Memories */}
        {hasMemories && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Your History
            </p>
            <div className="grid gap-2">
              {memoryList.slice(0, 5).map((memory) => (
                <ItemMemoryRow key={memory.itemNameNormalized} memory={memory} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: MemorySuggestion }) {
  const bgColor = {
    high: 'bg-red-50 border-red-200',
    medium: 'bg-amber-50 border-amber-200',
    low: 'bg-slate-50 border-slate-200',
  }[suggestion.priority];

  const textColor = {
    high: 'text-red-800',
    medium: 'text-amber-800',
    low: 'text-slate-700',
  }[suggestion.priority];

  const icon = {
    price_alert: '📈',
    vendor_suggestion: '🏪',
    savings_tip: '💵',
    spending_pattern: '📊',
  }[suggestion.type];

  return (
    <div className={`p-3 rounded-lg border ${bgColor}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${textColor}`}>
            {suggestion.message}
          </p>
          {suggestion.details.savings && suggestion.details.savings > 0 && (
            <p className="text-xs text-green-600 mt-0.5">
              Save {formatPrice(suggestion.details.savings)} per item
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemMemoryRow({ memory }: { memory: ItemMemory }) {
  if (!memory.lastPurchase) return null;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {memory.itemName}
        </p>
        <p className="text-xs text-slate-500">
          Last: {formatPrice(memory.lastPurchase.price)} at {memory.lastPurchase.vendor}
          {' · '}{formatDate(memory.lastPurchase.date)}
        </p>
      </div>
      <div className="text-right">
        {memory.totalPurchases > 1 && (
          <>
            <p className="text-xs text-slate-600">
              Avg: {formatPrice(memory.averagePrice)}
            </p>
            {memory.cheapest && memory.potentialSavings > 0.01 && (
              <p className="text-xs text-green-600">
                Best: {formatPrice(memory.cheapest.price)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Hook to fetch memory suggestions
export function useMoneyMemory(userId: string | null, items: string[], vendor?: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    memories: Record<string, ItemMemory>;
    suggestions: MemorySuggestion[];
    totalPotentialSavings: number;
  } | null>(null);

  const fetchMemories = async () => {
    if (!userId || items.length === 0) {
      setData(null);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        user_id: userId,
        items: items.join(','),
      });
      if (vendor) params.set('vendor', vendor);

      const response = await fetch(`/api/memory-suggestions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch memories');

      const result = await response.json();
      setData({
        memories: result.memories || {},
        suggestions: result.suggestions || [],
        totalPotentialSavings: 0,
      });
    } catch (error) {
      console.error('Error fetching money memories:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return { loading, data, fetchMemories };
}
