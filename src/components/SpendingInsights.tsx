'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

interface SpendingInsight {
  type: 'increase' | 'decrease' | 'new' | 'gone';
  category_name: string;
  category_icon: string;
  amount_change: number;
  percent_change: number;
  reason?: string;
}

interface SpendingAnalysis {
  current_total: number;
  previous_total: number;
  total_change: number;
  total_change_percent: number;
  top_increases: SpendingInsight[];
  top_decreases: SpendingInsight[];
  summary: string;
  period: string;
  current_period: { start: string; end: string };
  previous_period: { start: string; end: string };
}

export default function SpendingInsights() {
  const [analysis, setAnalysis] = useState<SpendingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadAnalysis();
  }, [period]);

  async function loadAnalysis() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch(`/api/analytics/spending-change?user_id=${user.id}&period=${period}`);
      const data = await res.json();

      if (data.success) {
        setAnalysis(data.data);
      }
    } catch (error) {
      console.error('Error loading spending analysis:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const isIncrease = analysis.total_change > 0;
  const hasChanges = analysis.top_increases.length > 0 || analysis.top_decreases.length > 0;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Why Did My Spending Change?</h3>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'week' | 'month' | 'quarter')}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
        </div>

        {/* Main change display */}
        <div className="flex items-center gap-4">
          <div className={`text-3xl font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
            {isIncrease ? '+' : '-'}${Math.abs(analysis.total_change).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-sm font-medium ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
              {isIncrease ? '↑' : '↓'} {Math.abs(analysis.total_change_percent).toFixed(0)}%
            </span>
            <span className="text-sm text-gray-500">vs last {period}</span>
          </div>
        </div>

        {/* Summary text */}
        {hasChanges && (
          <p className="text-sm text-gray-600 mt-2">{analysis.summary}</p>
        )}
      </div>

      {/* Expandable details */}
      {hasChanges && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1"
          >
            {expanded ? 'Hide details' : 'Show details'}
            <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {expanded && (
            <div className="p-4 border-t space-y-4">
              {/* Top increases */}
              {analysis.top_increases.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Spending Increased In:
                  </h4>
                  <div className="space-y-2">
                    {analysis.top_increases.map((insight, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span>{insight.category_icon}</span>
                          <span className="text-sm text-gray-700">{insight.category_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-red-600">
                            +${insight.amount_change.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          {insight.reason && (
                            <p className="text-xs text-gray-500">{insight.reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top decreases */}
              {analysis.top_decreases.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Spending Decreased In:
                  </h4>
                  <div className="space-y-2">
                    {analysis.top_decreases.map((insight, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span>{insight.category_icon}</span>
                          <span className="text-sm text-gray-700">{insight.category_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-green-600">
                            -${insight.amount_change.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          {insight.reason && (
                            <p className="text-xs text-gray-500">{insight.reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Period info */}
              <div className="text-xs text-gray-400 pt-2 border-t">
                Comparing {analysis.current_period.start} to {analysis.current_period.end} vs {analysis.previous_period.start} to {analysis.previous_period.end}
              </div>
            </div>
          )}
        </>
      )}

      {/* No changes message */}
      {!hasChanges && (
        <div className="p-4 text-center text-gray-500 text-sm">
          Your spending is similar to last {period}. Keep it up!
        </div>
      )}
    </div>
  );
}
