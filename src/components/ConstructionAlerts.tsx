'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface ConstructionAlert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  job_id: string;
  job_number: string;
  job_name: string;
  metric_value?: number;
  threshold_value?: number;
}

interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  jobs_with_alerts: number;
  jobs_total: number;
}

export default function ConstructionAlerts() {
  const [alerts, setAlerts] = useState<ConstructionAlert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch(`/api/alerts/construction?user_id=${user.id}`);
      const result = await res.json();
      if (result.success) {
        setAlerts(result.data);
        setSummary(result.summary);
      }
    } catch (err) {
      console.error('Failed to load construction alerts:', err);
    }
    setLoading(false);
  };

  const dismiss = (id: string) => {
    setDismissed(prev => new Set([...Array.from(prev), id]));
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <div className="card bg-green-50 border border-green-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-green-800">All Clear</h3>
            <p className="text-sm text-green-700">No construction risk alerts across your active jobs.</p>
          </div>
        </div>
      </div>
    );
  }

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
  const displayAlerts = showAll ? visibleAlerts : visibleAlerts.slice(0, 5);

  const severityConfig = {
    critical: { border: 'border-l-red-500', bg: 'bg-red-50', icon: 'text-red-500', iconBg: 'bg-red-100' },
    warning: { border: 'border-l-yellow-500', bg: 'bg-yellow-50', icon: 'text-yellow-500', iconBg: 'bg-yellow-100' },
    info: { border: 'border-l-blue-500', bg: 'bg-blue-50', icon: 'text-blue-500', iconBg: 'bg-blue-100' },
  };

  const typeIcons: Record<string, string> = {
    cost_overrun: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    margin_erosion: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
    schedule_risk: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    underbilling: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z',
    default: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-corporate-dark">Construction Alerts</h3>
          <div className="flex gap-1.5">
            {summary.critical > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {summary.critical} critical
              </span>
            )}
            {summary.warning > 0 && (
              <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {summary.warning} warning
              </span>
            )}
            {summary.info > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {summary.info} info
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-corporate-gray">
          {summary.jobs_with_alerts}/{summary.jobs_total} jobs
        </span>
      </div>

      {/* Alert Cards */}
      {displayAlerts.map(alert => {
        const config = severityConfig[alert.severity];
        const iconPath = typeIcons[alert.type] || typeIcons.default;

        return (
          <div key={alert.id} className={`border-l-4 ${config.border} ${config.bg} rounded-r-lg p-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 ${config.iconBg} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <svg className={`w-4 h-4 ${config.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-corporate-dark">{alert.title}</span>
                    <Link
                      href={`/dashboard/jobs/${alert.job_id}`}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {alert.job_number}
                    </Link>
                  </div>
                  <p className="text-sm text-corporate-slate mt-0.5">{alert.message}</p>
                </div>
              </div>
              <button
                onClick={() => dismiss(alert.id)}
                className="text-xs text-corporate-gray hover:text-corporate-dark flex-shrink-0"
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })}

      {/* Show more / less */}
      {visibleAlerts.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium w-full text-center py-1"
        >
          {showAll ? 'Show less' : `Show all ${visibleAlerts.length} alerts`}
        </button>
      )}
    </div>
  );
}
