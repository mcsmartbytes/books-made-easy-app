'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
}

interface Phase {
  id: string;
  name: string;
  description: string;
  estimated_hours: number;
  estimated_cost: number;
  sort_order: number;
}

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    job_number: `JOB-${String(Date.now()).slice(-6)}`,
    name: '',
    description: '',
    status: 'pending' as const,
    start_date: '',
    end_date: '',
    estimated_revenue: 0,
    estimated_cost: 0,
  });

  const [phases, setPhases] = useState<Phase[]>([
    { id: '1', name: '', description: '', estimated_hours: 0, estimated_cost: 0, sort_order: 0 },
  ]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCustomers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: customersData } = await supabase
      .from('customers')
      .select('id, name, email, company')
      .eq('user_id', session.user.id)
      .order('name');

    setCustomers(customersData || []);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.company?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const addPhase = () => {
    setPhases([
      ...phases,
      {
        id: String(Date.now()),
        name: '',
        description: '',
        estimated_hours: 0,
        estimated_cost: 0,
        sort_order: phases.length
      },
    ]);
  };

  const removePhase = (id: string) => {
    if (phases.length > 1) {
      setPhases(phases.filter(p => p.id !== id));
    }
  };

  const updatePhase = (id: string, field: keyof Phase, value: string | number) => {
    setPhases(phases.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const totalPhaseCost = phases.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
  const totalPhaseHours = phases.reduce((sum, p) => sum + (p.estimated_hours || 0), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Please enter a job name');
      return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Create job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        user_id: session.user.id,
        customer_id: selectedCustomer?.id || null,
        job_number: formData.job_number,
        name: formData.name,
        description: formData.description,
        status: formData.status,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        estimated_revenue: formData.estimated_revenue || 0,
        estimated_cost: formData.estimated_cost || totalPhaseCost,
        actual_revenue: 0,
        actual_cost: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating job:', error);
      alert('Error creating job: ' + error.message);
      setLoading(false);
      return;
    }

    // Create phases
    const phasesToInsert = phases
      .filter(p => p.name)
      .map((phase, index) => ({
        job_id: job.id,
        name: phase.name,
        description: phase.description,
        estimated_hours: phase.estimated_hours || 0,
        estimated_cost: phase.estimated_cost || 0,
        actual_hours: 0,
        actual_cost: 0,
        status: 'pending',
        sort_order: index,
      }));

    if (phasesToInsert.length > 0) {
      const { error: phaseError } = await supabase.from('job_phases').insert(phasesToInsert);
      if (phaseError) {
        console.error('Error creating phases:', phaseError);
      }
    }

    router.push('/dashboard/jobs');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">New Job</h1>
          <p className="text-corporate-gray mt-1">Create a new job or project to track</p>
        </div>
        <Link href="/dashboard/jobs" className="btn-secondary">Cancel</Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Job Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Job Number</label>
                    <input
                      type="text"
                      value={formData.job_number}
                      onChange={(e) => setFormData({ ...formData, job_number: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                      className="input-field"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="on_hold">On Hold</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Job Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Website Redesign for Acme Corp"
                    required
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Describe the scope of work..."
                  />
                </div>
              </div>
            </div>

            {/* Customer Selection */}
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Customer</h2>
              <div ref={customerRef} className="relative">
                <label className="label">Select Customer (optional)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) setSelectedCustomer(null);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="input-field pr-10"
                    placeholder="Search customers..."
                  />
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-corporate-gray">
                        <p>No customers found</p>
                        <Link href="/dashboard/customers" className="text-primary-600 hover:underline text-sm">+ Add a customer</Link>
                      </div>
                    ) : (
                      filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${selectedCustomer?.id === customer.id ? 'bg-primary-50' : ''}`}
                        >
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-600 font-semibold">{customer.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-corporate-dark truncate">{customer.name}</p>
                            <p className="text-sm text-corporate-gray truncate">{customer.company || customer.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="mt-3 p-3 bg-primary-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-semibold">{selectedCustomer.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-corporate-dark">{selectedCustomer.name}</p>
                        <p className="text-sm text-corporate-gray">{selectedCustomer.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                      className="text-corporate-gray hover:text-red-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Phases/Tasks */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-corporate-dark">Phases / Tasks</h2>
                <p className="text-sm text-corporate-gray">Break down the job into trackable phases</p>
              </div>

              <div className="space-y-4">
                <div className="hidden sm:grid sm:grid-cols-12 gap-4 text-xs font-semibold text-corporate-gray uppercase">
                  <div className="col-span-4">Phase Name</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-2">Est. Hours</div>
                  <div className="col-span-2">Est. Cost</div>
                  <div className="col-span-1"></div>
                </div>

                {phases.map((phase, index) => (
                  <div key={phase.id} className="grid grid-cols-12 gap-4 items-start p-4 bg-gray-50 rounded-lg">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="label sm:hidden">Phase Name</label>
                      <input
                        type="text"
                        value={phase.name}
                        onChange={(e) => updatePhase(phase.id, 'name', e.target.value)}
                        className="input-field"
                        placeholder={`Phase ${index + 1}`}
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <label className="label sm:hidden">Description</label>
                      <input
                        type="text"
                        value={phase.description}
                        onChange={(e) => updatePhase(phase.id, 'description', e.target.value)}
                        className="input-field"
                        placeholder="Brief description"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="label sm:hidden">Est. Hours</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={phase.estimated_hours || ''}
                        onChange={(e) => updatePhase(phase.id, 'estimated_hours', parseFloat(e.target.value) || 0)}
                        className="input-field"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <label className="label sm:hidden">Est. Cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={phase.estimated_cost || ''}
                        onChange={(e) => updatePhase(phase.id, 'estimated_cost', parseFloat(e.target.value) || 0)}
                        className="input-field"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      {phases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePhase(phase.id)}
                          className="p-2 text-corporate-gray hover:text-red-600 rounded-lg"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPhase}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Phase
                </button>

                {phases.some(p => p.name) && (
                  <div className="pt-4 border-t border-gray-200 flex justify-end gap-8 text-sm">
                    <div className="text-corporate-gray">
                      Total Hours: <span className="font-semibold text-corporate-dark">{totalPhaseHours}</span>
                    </div>
                    <div className="text-corporate-gray">
                      Total Cost: <span className="font-semibold text-corporate-dark">{formatCurrency(totalPhaseCost)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Schedule</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Financials</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Estimated Revenue</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.estimated_revenue || ''}
                    onChange={(e) => setFormData({ ...formData, estimated_revenue: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label">Estimated Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.estimated_cost || totalPhaseCost || ''}
                    onChange={(e) => setFormData({ ...formData, estimated_cost: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    placeholder={totalPhaseCost > 0 ? `${totalPhaseCost} (from phases)` : '0.00'}
                  />
                  {totalPhaseCost > 0 && !formData.estimated_cost && (
                    <p className="text-xs text-corporate-gray mt-1">Will use phase total: {formatCurrency(totalPhaseCost)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="card bg-corporate-light">
              <div className="space-y-3">
                <div className="flex justify-between text-corporate-slate">
                  <span>Est. Revenue</span>
                  <span>{formatCurrency(formData.estimated_revenue)}</span>
                </div>
                <div className="flex justify-between text-corporate-slate">
                  <span>Est. Cost</span>
                  <span>{formatCurrency(formData.estimated_cost || totalPhaseCost)}</span>
                </div>
                <div className="border-t border-gray-300 pt-3 flex justify-between text-lg font-bold">
                  <span>Est. Profit</span>
                  <span className={(formData.estimated_revenue - (formData.estimated_cost || totalPhaseCost)) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(formData.estimated_revenue - (formData.estimated_cost || totalPhaseCost))}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !formData.name}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
