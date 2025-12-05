'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface ColumnConfig {
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'status';
  enabled: boolean;
}

interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'is_empty' | 'is_not_empty';
  value: string;
  value2?: string;
}

const DATA_SOURCES = [
  { id: 'invoices', label: 'Invoices', description: 'Customer invoices and sales' },
  { id: 'bills', label: 'Bills', description: 'Vendor bills and expenses' },
  { id: 'payments', label: 'Payments', description: 'Payments received and made' },
  { id: 'customers', label: 'Customers', description: 'Customer information' },
  { id: 'vendors', label: 'Vendors', description: 'Vendor information' },
  { id: 'products', label: 'Products & Services', description: 'Products and services catalog' },
  { id: 'jobs', label: 'Jobs', description: 'Job costing and projects' },
  { id: 'journal_entries', label: 'Journal Entries', description: 'Manual accounting entries' },
];

const COLUMN_OPTIONS: Record<string, ColumnConfig[]> = {
  invoices: [
    { field: 'invoice_number', label: 'Invoice #', type: 'text', enabled: true },
    { field: 'customer_name', label: 'Customer', type: 'text', enabled: true },
    { field: 'issue_date', label: 'Issue Date', type: 'date', enabled: true },
    { field: 'due_date', label: 'Due Date', type: 'date', enabled: true },
    { field: 'total', label: 'Total', type: 'currency', enabled: true },
    { field: 'amount_paid', label: 'Amount Paid', type: 'currency', enabled: false },
    { field: 'balance', label: 'Balance', type: 'currency', enabled: true },
    { field: 'status', label: 'Status', type: 'status', enabled: true },
  ],
  bills: [
    { field: 'bill_number', label: 'Bill #', type: 'text', enabled: true },
    { field: 'vendor_name', label: 'Vendor', type: 'text', enabled: true },
    { field: 'bill_date', label: 'Bill Date', type: 'date', enabled: true },
    { field: 'due_date', label: 'Due Date', type: 'date', enabled: true },
    { field: 'category', label: 'Category', type: 'text', enabled: true },
    { field: 'total', label: 'Total', type: 'currency', enabled: true },
    { field: 'amount_paid', label: 'Amount Paid', type: 'currency', enabled: false },
    { field: 'balance', label: 'Balance', type: 'currency', enabled: true },
    { field: 'status', label: 'Status', type: 'status', enabled: true },
  ],
  payments: [
    { field: 'payment_number', label: 'Payment #', type: 'text', enabled: true },
    { field: 'type', label: 'Type', type: 'text', enabled: true },
    { field: 'entity_name', label: 'Customer/Vendor', type: 'text', enabled: true },
    { field: 'payment_date', label: 'Date', type: 'date', enabled: true },
    { field: 'payment_method', label: 'Method', type: 'text', enabled: true },
    { field: 'amount', label: 'Amount', type: 'currency', enabled: true },
    { field: 'reference', label: 'Reference', type: 'text', enabled: false },
  ],
  customers: [
    { field: 'name', label: 'Name', type: 'text', enabled: true },
    { field: 'email', label: 'Email', type: 'text', enabled: true },
    { field: 'phone', label: 'Phone', type: 'text', enabled: true },
    { field: 'company', label: 'Company', type: 'text', enabled: true },
    { field: 'city', label: 'City', type: 'text', enabled: false },
    { field: 'state', label: 'State', type: 'text', enabled: false },
    { field: 'total_invoiced', label: 'Total Invoiced', type: 'currency', enabled: true },
    { field: 'total_paid', label: 'Total Paid', type: 'currency', enabled: true },
    { field: 'balance', label: 'Balance', type: 'currency', enabled: true },
  ],
  vendors: [
    { field: 'name', label: 'Name', type: 'text', enabled: true },
    { field: 'email', label: 'Email', type: 'text', enabled: true },
    { field: 'phone', label: 'Phone', type: 'text', enabled: true },
    { field: 'company', label: 'Company', type: 'text', enabled: true },
    { field: 'city', label: 'City', type: 'text', enabled: false },
    { field: 'state', label: 'State', type: 'text', enabled: false },
    { field: 'total_billed', label: 'Total Billed', type: 'currency', enabled: true },
    { field: 'total_paid', label: 'Total Paid', type: 'currency', enabled: true },
    { field: 'balance', label: 'Balance', type: 'currency', enabled: true },
  ],
  products: [
    { field: 'name', label: 'Name', type: 'text', enabled: true },
    { field: 'sku', label: 'SKU', type: 'text', enabled: true },
    { field: 'type', label: 'Type', type: 'text', enabled: true },
    { field: 'price', label: 'Price', type: 'currency', enabled: true },
    { field: 'cost', label: 'Cost', type: 'currency', enabled: false },
    { field: 'description', label: 'Description', type: 'text', enabled: false },
    { field: 'is_active', label: 'Active', type: 'status', enabled: true },
  ],
  jobs: [
    { field: 'job_number', label: 'Job #', type: 'text', enabled: true },
    { field: 'name', label: 'Name', type: 'text', enabled: true },
    { field: 'customer_name', label: 'Customer', type: 'text', enabled: true },
    { field: 'start_date', label: 'Start Date', type: 'date', enabled: true },
    { field: 'end_date', label: 'End Date', type: 'date', enabled: false },
    { field: 'budget', label: 'Budget', type: 'currency', enabled: true },
    { field: 'actual_cost', label: 'Actual Cost', type: 'currency', enabled: true },
    { field: 'actual_revenue', label: 'Revenue', type: 'currency', enabled: true },
    { field: 'status', label: 'Status', type: 'status', enabled: true },
  ],
  journal_entries: [
    { field: 'entry_number', label: 'Entry #', type: 'text', enabled: true },
    { field: 'entry_date', label: 'Date', type: 'date', enabled: true },
    { field: 'description', label: 'Description', type: 'text', enabled: true },
    { field: 'total_debits', label: 'Total Debits', type: 'currency', enabled: true },
    { field: 'total_credits', label: 'Total Credits', type: 'currency', enabled: true },
    { field: 'status', label: 'Status', type: 'status', enabled: true },
  ],
};

const TEMPLATES: Record<string, { name: string; description: string; dataSource: string; columns: string[]; filters: FilterConfig[] }> = {
  'overdue-invoices': {
    name: 'Overdue Invoices',
    description: 'List of all invoices past their due date',
    dataSource: 'invoices',
    columns: ['invoice_number', 'customer_name', 'due_date', 'total', 'balance', 'status'],
    filters: [{ field: 'status', operator: 'equals', value: 'overdue' }],
  },
  'top-customers': {
    name: 'Top Customers by Revenue',
    description: 'Customers ranked by total invoiced amount',
    dataSource: 'customers',
    columns: ['name', 'email', 'total_invoiced', 'total_paid', 'balance'],
    filters: [],
  },
  'monthly-expenses': {
    name: 'Monthly Expenses',
    description: 'All bills for the current month',
    dataSource: 'bills',
    columns: ['bill_number', 'vendor_name', 'category', 'bill_date', 'total', 'status'],
    filters: [],
  },
};

export default function NewCustomReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template');

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dataSource: '',
  });

  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (templateId && TEMPLATES[templateId]) {
      const template = TEMPLATES[templateId];
      setFormData({
        name: template.name,
        description: template.description,
        dataSource: template.dataSource,
      });
      const templateColumns = COLUMN_OPTIONS[template.dataSource].map(col => ({
        ...col,
        enabled: template.columns.includes(col.field),
      }));
      setColumns(templateColumns);
      setFilters(template.filters);
      setStep(2);
    }
  }, [templateId]);

  const handleDataSourceChange = (source: string) => {
    setFormData({ ...formData, dataSource: source });
    setColumns(COLUMN_OPTIONS[source] || []);
    setFilters([]);
    setSortBy('');
  };

  const toggleColumn = (field: string) => {
    setColumns(columns.map(col =>
      col.field === field ? { ...col, enabled: !col.enabled } : col
    ));
  };

  const addFilter = () => {
    const availableFields = columns.filter(c => c.enabled);
    if (availableFields.length === 0) return;

    setFilters([
      ...filters,
      { field: availableFields[0].field, operator: 'equals', value: '' },
    ]);
  };

  const updateFilter = (index: number, updates: Partial<FilterConfig>) => {
    setFilters(filters.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.dataSource) {
      alert('Please enter a report name and select a data source');
      return;
    }

    const enabledColumns = columns.filter(c => c.enabled);
    if (enabledColumns.length === 0) {
      alert('Please select at least one column');
      return;
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('custom_reports')
      .insert({
        user_id: session.user.id,
        name: formData.name,
        description: formData.description,
        data_source: formData.dataSource,
        columns: enabledColumns.map(c => ({ field: c.field, label: c.label, type: c.type })),
        filters: filters.filter(f => f.value || f.operator === 'is_empty' || f.operator === 'is_not_empty'),
        sort_by: sortBy || null,
        sort_order: sortOrder,
      });

    if (error) {
      console.error('Error saving report:', error);
      alert('Error saving report: ' + error.message);
      setSaving(false);
      return;
    }

    router.push('/dashboard/reports/custom');
  };

  const getOperatorOptions = (type: string) => {
    const common = [
      { value: 'equals', label: 'Equals' },
      { value: 'is_empty', label: 'Is empty' },
      { value: 'is_not_empty', label: 'Is not empty' },
    ];

    if (type === 'text') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ];
    }

    if (type === 'number' || type === 'currency') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'Greater than' },
        { value: 'less_than', label: 'Less than' },
        { value: 'between', label: 'Between' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ];
    }

    if (type === 'date') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'After' },
        { value: 'less_than', label: 'Before' },
        { value: 'between', label: 'Between' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ];
    }

    return common;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports/custom" className="text-corporate-gray hover:text-corporate-dark">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-corporate-dark">Create Custom Report</h1>
            <p className="text-corporate-gray">Step {step} of 3</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                s === step
                  ? 'bg-primary-600 text-white'
                  : s < step
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-corporate-gray'
              }`}
            >
              {s < step ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s
              )}
            </div>
            {s < 3 && (
              <div className={`w-16 h-1 mx-2 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info & Data Source */}
      {step === 1 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-6">Basic Information</h2>

          <div className="space-y-4 mb-8">
            <div>
              <label className="label">Report Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="e.g., Monthly Sales Summary"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="What does this report show?"
              />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Select Data Source *</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DATA_SOURCES.map(source => (
              <button
                key={source.id}
                type="button"
                onClick={() => handleDataSourceChange(source.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.dataSource === source.id
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-corporate-dark">{source.label}</p>
                <p className="text-sm text-corporate-gray">{source.description}</p>
              </button>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!formData.name || !formData.dataSource}
              className="btn-primary disabled:opacity-50"
            >
              Next: Select Columns
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Columns */}
      {step === 2 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-2">Select Columns</h2>
          <p className="text-corporate-gray text-sm mb-6">
            Choose which columns to include in your report
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {columns.map(col => (
              <label
                key={col.field}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  col.enabled
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={col.enabled}
                  onChange={() => toggleColumn(col.field)}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <div>
                  <p className="font-medium text-corporate-dark">{col.label}</p>
                  <p className="text-xs text-corporate-gray capitalize">{col.type}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-corporate-gray mb-6">
            <span>{columns.filter(c => c.enabled).length} columns selected</span>
            <button
              type="button"
              onClick={() => setColumns(columns.map(c => ({ ...c, enabled: true })))}
              className="text-primary-600 hover:underline"
            >
              Select all
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => setColumns(columns.map(c => ({ ...c, enabled: false })))}
              className="text-primary-600 hover:underline"
            >
              Clear all
            </button>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={columns.filter(c => c.enabled).length === 0}
              className="btn-primary disabled:opacity-50"
            >
              Next: Filters & Sorting
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Filters & Sorting */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-corporate-dark">Filters</h2>
                <p className="text-corporate-gray text-sm">Optional: Add conditions to filter your data</p>
              </div>
              <button
                type="button"
                onClick={addFilter}
                className="btn-secondary text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Filter
              </button>
            </div>

            {filters.length === 0 ? (
              <p className="text-corporate-gray text-sm py-4 text-center">
                No filters added. Your report will include all records.
              </p>
            ) : (
              <div className="space-y-3">
                {filters.map((filter, index) => {
                  const column = columns.find(c => c.field === filter.field);
                  const operators = getOperatorOptions(column?.type || 'text');

                  return (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <select
                          value={filter.field}
                          onChange={(e) => updateFilter(index, { field: e.target.value })}
                          className="input-field"
                        >
                          {columns.filter(c => c.enabled).map(col => (
                            <option key={col.field} value={col.field}>{col.label}</option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(e) => updateFilter(index, { operator: e.target.value as FilterConfig['operator'] })}
                          className="input-field"
                        >
                          {operators.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        {filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && (
                          <div className="flex gap-2">
                            <input
                              type={column?.type === 'date' ? 'date' : column?.type === 'number' || column?.type === 'currency' ? 'number' : 'text'}
                              value={filter.value}
                              onChange={(e) => updateFilter(index, { value: e.target.value })}
                              className="input-field flex-1"
                              placeholder="Value"
                            />
                            {filter.operator === 'between' && (
                              <input
                                type={column?.type === 'date' ? 'date' : 'number'}
                                value={filter.value2 || ''}
                                onChange={(e) => updateFilter(index, { value2: e.target.value })}
                                className="input-field flex-1"
                                placeholder="To"
                              />
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFilter(index)}
                        className="p-2 text-corporate-gray hover:text-red-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sorting */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-2">Sorting</h2>
            <p className="text-corporate-gray text-sm mb-4">Optional: Choose how to sort your results</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="input-field"
                >
                  <option value="">Default order</option>
                  {columns.filter(c => c.enabled).map(col => (
                    <option key={col.field} value={col.field}>{col.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="input-field"
                  disabled={!sortBy}
                >
                  <option value="asc">Ascending (A-Z, 0-9)</option>
                  <option value="desc">Descending (Z-A, 9-0)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Summary & Save */}
          <div className="card bg-primary-50">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Report Summary</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-corporate-gray">Report Name</p>
                <p className="font-medium text-corporate-dark">{formData.name}</p>
              </div>
              <div>
                <p className="text-corporate-gray">Data Source</p>
                <p className="font-medium text-corporate-dark capitalize">{formData.dataSource.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-corporate-gray">Columns</p>
                <p className="font-medium text-corporate-dark">{columns.filter(c => c.enabled).length} selected</p>
              </div>
              <div>
                <p className="text-corporate-gray">Filters</p>
                <p className="font-medium text-corporate-dark">{filters.length} applied</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-secondary">
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
