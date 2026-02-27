'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Report {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}

const reports: Report[] = [
  // Financial Statements
  { id: 'profit-loss', name: 'Profit & Loss', description: 'Income and expenses summary', category: 'Financial Statements', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'balance-sheet', name: 'Balance Sheet', description: 'Assets, liabilities, and equity', category: 'Financial Statements', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { id: 'cash-flow', name: 'Cash Flow Statement', description: 'Cash inflows and outflows', category: 'Financial Statements', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  // Receivables
  { id: 'ar-aging', name: 'A/R Aging Summary', description: 'Outstanding customer balances by age', category: 'Receivables', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'customer-balance', name: 'Customer Balance Detail', description: 'Detailed customer transactions', category: 'Receivables', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'invoice-list', name: 'Invoice List', description: 'All invoices with status', category: 'Receivables', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  // Payables
  { id: 'ap-aging', name: 'A/P Aging Summary', description: 'Outstanding vendor balances by age', category: 'Payables', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { id: 'vendor-balance', name: 'Vendor Balance Detail', description: 'Detailed vendor transactions', category: 'Payables', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'bill-list', name: 'Bill List', description: 'All bills with status', category: 'Payables', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  // Sales & Expenses
  { id: 'sales-by-customer', name: 'Sales by Customer', description: 'Revenue breakdown by customer', category: 'Sales & Expenses', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'expenses-by-vendor', name: 'Expenses by Vendor', description: 'Spending breakdown by vendor', category: 'Sales & Expenses', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z' },
  { id: 'expenses-by-category', name: 'Expenses by Category', description: 'Spending breakdown by category', category: 'Sales & Expenses', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
];

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateRange, setDateRange] = useState('this-month');

  const categories = ['all', ...Array.from(new Set(reports.map(r => r.category)))];

  const filteredReports = selectedCategory === 'all'
    ? reports
    : reports.filter(r => r.category === selectedCategory);

  const groupedReports = filteredReports.reduce((groups, report) => {
    if (!groups[report.category]) groups[report.category] = [];
    groups[report.category].push(report);
    return groups;
  }, {} as Record<string, Report[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Reports</h1>
          <p className="text-corporate-gray mt-1">Generate financial reports and insights</p>
        </div>
        <Link href="/dashboard/reports/custom" className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Custom Reports
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
            >
              <option value="all">All Reports</option>
              {categories.filter(c => c !== 'all').map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input-field"
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
              <option value="last-year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <>
              <div className="flex-1">
                <label className="label">Start Date</label>
                <input type="date" className="input-field" />
              </div>
              <div className="flex-1">
                <label className="label">End Date</label>
                <input type="date" className="input-field" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Net Income</p>
          <p className="text-xl font-bold text-green-600">$26,500.00</p>
          <p className="text-xs text-corporate-gray">This month</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Revenue</p>
          <p className="text-xl font-bold text-corporate-dark">$45,250.00</p>
          <p className="text-xs text-green-600">+12% vs last month</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Expenses</p>
          <p className="text-xl font-bold text-corporate-dark">$18,750.00</p>
          <p className="text-xs text-red-600">+5% vs last month</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Gross Margin</p>
          <p className="text-xl font-bold text-corporate-dark">58.6%</p>
          <p className="text-xs text-corporate-gray">Target: 60%</p>
        </div>
      </div>

      {/* Reports grid */}
      {Object.entries(groupedReports).map(([category, categoryReports]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-corporate-dark">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryReports.map(report => (
              <Link
                key={report.id}
                href={`/dashboard/reports/${report.id}`}
                className="card-hover flex items-start gap-4 group"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary-200 transition-colors">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={report.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-corporate-dark group-hover:text-primary-600 transition-colors">
                    {report.name}
                  </h3>
                  <p className="text-sm text-corporate-gray mt-1">{report.description}</p>
                </div>
                <svg className="w-5 h-5 text-corporate-gray group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Export Options */}
      <div className="card bg-corporate-light">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-corporate-dark">Export Data</h3>
            <p className="text-sm text-corporate-gray">Download your financial data in various formats</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm py-2">
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button className="btn-secondary text-sm py-2">
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
