'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Job {
  id: string;
  job_number: string;
  name: string;
  customer_id: string;
  customer_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  estimated_revenue: number;
  estimated_cost: number;
  actual_revenue: number;
  actual_cost: number;
  description: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: jobsData, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customers (name)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!error && jobsData) {
      const mappedJobs = jobsData.map((job: any) => ({
        ...job,
        customer_name: job.customers?.name || 'No Customer'
      }));
      setJobs(mappedJobs);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      on_hold: 'bg-yellow-100 text-yellow-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      on_hold: 'On Hold',
      cancelled: 'Cancelled',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getProfitMargin = (revenue: number, cost: number) => {
    if (revenue === 0) return 0;
    return ((revenue - cost) / revenue) * 100;
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = {
    totalJobs: jobs.length,
    activeJobs: jobs.filter(j => j.status === 'in_progress').length,
    estimatedRevenue: jobs.reduce((sum, j) => sum + (j.estimated_revenue || 0), 0),
    actualRevenue: jobs.reduce((sum, j) => sum + (j.actual_revenue || 0), 0),
    estimatedCost: jobs.reduce((sum, j) => sum + (j.estimated_cost || 0), 0),
    actualCost: jobs.reduce((sum, j) => sum + (j.actual_cost || 0), 0),
  };

  const estimatedProfit = totals.estimatedRevenue - totals.estimatedCost;
  const actualProfit = totals.actualRevenue - totals.actualCost;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Jobs</h1>
          <p className="text-corporate-gray mt-1">Track projects and job profitability</p>
        </div>
        <Link href="/dashboard/jobs/new" className="btn-primary flex items-center gap-2 justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Job
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Jobs</p>
          <p className="text-xl font-bold text-corporate-dark">{totals.totalJobs}</p>
          <p className="text-xs text-blue-600">{totals.activeJobs} active</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Est. Revenue</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totals.estimatedRevenue)}</p>
          <p className="text-xs text-corporate-gray">Actual: {formatCurrency(totals.actualRevenue)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Est. Costs</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totals.estimatedCost)}</p>
          <p className="text-xs text-corporate-gray">Actual: {formatCurrency(totals.actualCost)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Est. Profit</p>
          <p className={`text-xl font-bold ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(estimatedProfit)}
          </p>
          <p className={`text-xs ${actualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Actual: {formatCurrency(actualProfit)}
          </p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Jobs table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="text-right">Est. Revenue</th>
                <th className="text-right">Est. Cost</th>
                <th className="text-right">Profit Margin</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-corporate-gray">
                    {jobs.length === 0 ? (
                      <div className="space-y-2">
                        <p>No jobs yet</p>
                        <Link href="/dashboard/jobs/new" className="text-primary-600 hover:underline">
                          Create your first job
                        </Link>
                      </div>
                    ) : (
                      'No jobs found matching your search'
                    )}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const margin = getProfitMargin(job.estimated_revenue, job.estimated_cost);
                  return (
                    <tr key={job.id}>
                      <td>
                        <Link href={`/dashboard/jobs/${job.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                          {job.job_number}
                        </Link>
                        <p className="text-sm text-corporate-gray">{job.name}</p>
                      </td>
                      <td className="text-corporate-slate">{job.customer_name}</td>
                      <td>{getStatusBadge(job.status)}</td>
                      <td className="text-right font-medium text-corporate-dark">
                        {formatCurrency(job.estimated_revenue)}
                        {job.actual_revenue > 0 && (
                          <p className="text-xs text-corporate-gray">Actual: {formatCurrency(job.actual_revenue)}</p>
                        )}
                      </td>
                      <td className="text-right font-medium text-corporate-dark">
                        {formatCurrency(job.estimated_cost)}
                        {job.actual_cost > 0 && (
                          <p className="text-xs text-corporate-gray">Actual: {formatCurrency(job.actual_cost)}</p>
                        )}
                      </td>
                      <td className="text-right">
                        <span className={`font-semibold ${margin >= 20 ? 'text-green-600' : margin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/jobs/${job.id}`}
                            className="p-2 text-corporate-gray hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/dashboard/jobs/${job.id}/edit`}
                            className="p-2 text-corporate-gray hover:text-corporate-slate hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
