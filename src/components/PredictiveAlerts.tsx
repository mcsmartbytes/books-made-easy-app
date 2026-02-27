'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

interface PredictiveAlert {
  id: string;
  type: 'tight_month' | 'on_track' | 'budget_warning' | 'upcoming_bill' | 'spending_spike';
  severity: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  data?: Record<string, any>;
}

interface Forecast {
  projected_total: number;
  current_spent: number;
  days_remaining: number;
  avg_daily_spend: number;
  recurring_remaining: number;
  upcoming_recurring: Array<{
    id: string;
    description: string;
    amount: number;
    next_due_date: string;
  }>;
}

interface ForecastData {
  forecast: Forecast;
  alerts: PredictiveAlert[];
  comparison: {
    previous_month_total: number;
    projected_vs_previous: number;
  };
}

export default function PredictiveAlerts() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadForecast();
  }, []);

  async function loadForecast() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch(`/api/analytics/forecast?user_id=${user.id}`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error loading forecast:', error);
    } finally {
      setLoading(false);
    }
  }

  function dismissAlert(alertId: string) {
    setDismissedAlerts((prev) => new Set([...Array.from(prev), alertId]));
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const visibleAlerts = data.alerts.filter((a) => !dismissedAlerts.has(a.id));
  const { forecast, comparison } = data;

  const severityStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };

  const severityIcons = {
    info: '💡',
    warning: '⚠️',
    success: '✅',
  };

  return (
    <div className="space-y-4">
      {/* Forecast Summary Card */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <h3 className="text-lg font-semibold text-gray-900">Future Me</h3>
          <p className="text-sm text-gray-600">Your spending forecast for this month</p>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Spent So Far</p>
              <p className="text-xl font-bold text-gray-900">
                ${forecast.current_spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Projected Total</p>
              <p className={`text-xl font-bold ${
                comparison.projected_vs_previous > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                ${forecast.projected_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Days Left</p>
              <p className="text-xl font-bold text-gray-900">{forecast.days_remaining}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Avg Daily</p>
              <p className="text-xl font-bold text-gray-900">
                ${forecast.avg_daily_spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Comparison to last month */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              {comparison.projected_vs_previous >= 0 ? (
                <>
                  Projected to spend{' '}
                  <span className="font-medium text-red-600">
                    ${Math.abs(comparison.projected_vs_previous).toLocaleString(undefined, { maximumFractionDigits: 0 })} more
                  </span>{' '}
                  than last month
                </>
              ) : (
                <>
                  On track to save{' '}
                  <span className="font-medium text-green-600">
                    ${Math.abs(comparison.projected_vs_previous).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>{' '}
                  compared to last month
                </>
              )}
            </p>
          </div>

          {/* Upcoming recurring bills */}
          {forecast.upcoming_recurring.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2">Upcoming Bills</p>
              <div className="space-y-2">
                {forecast.upcoming_recurring.slice(0, 3).map((bill) => (
                  <div key={bill.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{bill.description}</span>
                    <div className="text-right">
                      <span className="font-medium">${bill.amount.toFixed(0)}</span>
                      <span className="text-gray-400 ml-2 text-xs">
                        {new Date(bill.next_due_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-4 ${severityStyles[alert.severity]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{severityIcons[alert.severity]}</span>
                  <div>
                    <h4 className="font-semibold">{alert.title}</h4>
                    <p className="text-sm mt-1 opacity-90">{alert.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="text-sm opacity-60 hover:opacity-100"
                >
                  Got it
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No alerts message */}
      {visibleAlerts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <span className="text-2xl">✨</span>
          <p className="text-green-800 font-medium mt-2">All Clear!</p>
          <p className="text-sm text-green-700">No spending alerts right now. Keep up the good work!</p>
        </div>
      )}
    </div>
  );
}
