'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  taxId: string;
  fiscalYearStart: string;
  currency: string;
  dateFormat: string;
}

interface ReminderSettings {
  enabled: boolean;
  grace_period_days: number;
  frequency_days: number;
  max_reminders: number;
  default_message: string;
}

interface LateFeeSettings {
  enabled: boolean;
  fee_type: 'percentage' | 'flat';
  fee_amount: number;
  grace_period_days: number;
  auto_apply: boolean;
  max_fees_per_invoice: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    taxId: '',
    fiscalYearStart: 'january',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
  });
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: false,
    grace_period_days: 3,
    frequency_days: 7,
    max_reminders: 3,
    default_message: 'This is a friendly reminder that your invoice is past due. Please arrange payment at your earliest convenience.',
  });
  const [lateFeeSettings, setLateFeeSettings] = useState<LateFeeSettings>({
    enabled: false,
    fee_type: 'percentage',
    fee_amount: 1.5,
    grace_period_days: 5,
    auto_apply: false,
    max_fees_per_invoice: 3,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // In production, load from Supabase
      // For now, use placeholder data
      setCompanySettings({
        name: 'Your Company Name',
        email: session.user.email || '',
        phone: '(555) 123-4567',
        address: '123 Business Street',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'United States',
        taxId: '',
        fiscalYearStart: 'january',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
      });

      // Load invoicing settings
      const userId = session.user.id;
      const [reminderRes, lateFeeRes] = await Promise.all([
        fetch(`/api/reminder-settings?user_id=${userId}`).then(r => r.json()),
        fetch(`/api/late-fee-settings?user_id=${userId}`).then(r => r.json()),
      ]);

      if (reminderRes.data) {
        setReminderSettings({
          enabled: !!reminderRes.data.enabled,
          grace_period_days: reminderRes.data.grace_period_days ?? 3,
          frequency_days: reminderRes.data.frequency_days ?? 7,
          max_reminders: reminderRes.data.max_reminders ?? 3,
          default_message: reminderRes.data.default_message || '',
        });
      }
      if (lateFeeRes.data) {
        setLateFeeSettings({
          enabled: !!lateFeeRes.data.enabled,
          fee_type: lateFeeRes.data.fee_type || 'percentage',
          fee_amount: lateFeeRes.data.fee_amount ?? 1.5,
          grace_period_days: lateFeeRes.data.grace_period_days ?? 5,
          auto_apply: !!lateFeeRes.data.auto_apply,
          max_fees_per_invoice: lateFeeRes.data.max_fees_per_invoice ?? 3,
        });
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (activeTab === 'invoicing') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const userId = session.user.id;
          await Promise.all([
            fetch('/api/reminder-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId, ...reminderSettings }),
            }),
            fetch('/api/late-fee-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId, ...lateFeeSettings }),
            }),
          ]);
        }
      } else {
        // In production, save to Supabase
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'preferences', label: 'Preferences', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { id: 'users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'invoicing', label: 'Invoicing', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'billing', label: 'Billing', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-corporate-dark">Settings</h1>
        <p className="text-corporate-gray mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar tabs */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="card p-2">
            <nav className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-corporate-slate hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1">
          {activeTab === 'company' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-6">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Company Name</label>
                  <input
                    type="text"
                    value={companySettings.name}
                    onChange={(e) => setCompanySettings({ ...companySettings, name: e.target.value })}
                    className="input-field"
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={companySettings.email}
                    onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })}
                    className="input-field"
                    placeholder="contact@company.com"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    value={companySettings.phone}
                    onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                    className="input-field"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Address</label>
                  <input
                    type="text"
                    value={companySettings.address}
                    onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                    className="input-field"
                    placeholder="123 Business Street"
                  />
                </div>
                <div>
                  <label className="label">City</label>
                  <input
                    type="text"
                    value={companySettings.city}
                    onChange={(e) => setCompanySettings({ ...companySettings, city: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">State</label>
                    <input
                      type="text"
                      value={companySettings.state}
                      onChange={(e) => setCompanySettings({ ...companySettings, state: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">ZIP Code</label>
                    <input
                      type="text"
                      value={companySettings.zip}
                      onChange={(e) => setCompanySettings({ ...companySettings, zip: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Tax ID / EIN</label>
                  <input
                    type="text"
                    value={companySettings.taxId}
                    onChange={(e) => setCompanySettings({ ...companySettings, taxId: e.target.value })}
                    className="input-field"
                    placeholder="XX-XXXXXXX"
                  />
                </div>
                <div>
                  <label className="label">Country</label>
                  <select
                    value={companySettings.country}
                    onChange={(e) => setCompanySettings({ ...companySettings, country: e.target.value })}
                    className="input-field"
                  >
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-6">Preferences</h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Currency</label>
                    <select
                      value={companySettings.currency}
                      onChange={(e) => setCompanySettings({ ...companySettings, currency: e.target.value })}
                      className="input-field"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Date Format</label>
                    <select
                      value={companySettings.dateFormat}
                      onChange={(e) => setCompanySettings({ ...companySettings, dateFormat: e.target.value })}
                      className="input-field"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Fiscal Year Start</label>
                    <select
                      value={companySettings.fiscalYearStart}
                      onChange={(e) => setCompanySettings({ ...companySettings, fiscalYearStart: e.target.value })}
                      className="input-field"
                    >
                      <option value="january">January</option>
                      <option value="april">April</option>
                      <option value="july">July</option>
                      <option value="october">October</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-medium text-corporate-dark mb-4">Notifications</h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" defaultChecked />
                      <span className="text-corporate-slate">Email me when invoices are paid</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" defaultChecked />
                      <span className="text-corporate-slate">Email me when bills are due</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" />
                      <span className="text-corporate-slate">Weekly financial summary</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-corporate-dark">Team Members</h2>
                <button className="btn-primary text-sm py-2">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Invite User
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold">Y</span>
                    </div>
                    <div>
                      <p className="font-medium text-corporate-dark">You</p>
                      <p className="text-sm text-corporate-gray">Owner</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm font-medium">Admin</span>
                </div>
              </div>
              <p className="text-sm text-corporate-gray mt-4">
                Invite team members to collaborate on your accounting. Each user can have different permission levels.
              </p>
            </div>
          )}

          {activeTab === 'invoicing' && (
            <div className="space-y-6">
              {/* Reminders Section */}
              <div className="card">
                <h2 className="text-lg font-semibold text-corporate-dark mb-6">Past Due Reminders</h2>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={reminderSettings.enabled}
                      onChange={(e) => setReminderSettings({ ...reminderSettings, enabled: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-corporate-slate font-medium">Enable automatic reminders for overdue invoices</span>
                  </label>

                  <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${!reminderSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                      <label className="label">Grace Period (days)</label>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={reminderSettings.grace_period_days}
                        onChange={(e) => setReminderSettings({ ...reminderSettings, grace_period_days: parseInt(e.target.value) || 0 })}
                        className="input-field"
                      />
                      <p className="text-xs text-corporate-gray mt-1">Days after due date before first reminder</p>
                    </div>
                    <div>
                      <label className="label">Frequency (days)</label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={reminderSettings.frequency_days}
                        onChange={(e) => setReminderSettings({ ...reminderSettings, frequency_days: parseInt(e.target.value) || 7 })}
                        className="input-field"
                      />
                      <p className="text-xs text-corporate-gray mt-1">Days between reminders</p>
                    </div>
                    <div>
                      <label className="label">Max Reminders</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={reminderSettings.max_reminders}
                        onChange={(e) => setReminderSettings({ ...reminderSettings, max_reminders: parseInt(e.target.value) || 3 })}
                        className="input-field"
                      />
                      <p className="text-xs text-corporate-gray mt-1">Maximum reminders per invoice</p>
                    </div>
                  </div>

                  <div className={!reminderSettings.enabled ? 'opacity-50 pointer-events-none' : ''}>
                    <label className="label">Default Reminder Message</label>
                    <textarea
                      value={reminderSettings.default_message}
                      onChange={(e) => setReminderSettings({ ...reminderSettings, default_message: e.target.value })}
                      className="input-field min-h-[80px]"
                      rows={3}
                      placeholder="Enter your default reminder message..."
                    />
                  </div>
                </div>
              </div>

              {/* Late Fees Section */}
              <div className="card">
                <h2 className="text-lg font-semibold text-corporate-dark mb-6">Late Fees</h2>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={lateFeeSettings.enabled}
                      onChange={(e) => setLateFeeSettings({ ...lateFeeSettings, enabled: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-corporate-slate font-medium">Enable late fees on overdue invoices</span>
                  </label>

                  <div className={`space-y-4 ${!lateFeeSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Fee Type</label>
                        <select
                          value={lateFeeSettings.fee_type}
                          onChange={(e) => setLateFeeSettings({ ...lateFeeSettings, fee_type: e.target.value as 'percentage' | 'flat' })}
                          className="input-field"
                        >
                          <option value="percentage">Percentage of Invoice Total</option>
                          <option value="flat">Flat Amount</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">
                          Fee Amount {lateFeeSettings.fee_type === 'percentage' ? '(%)' : '($)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step={lateFeeSettings.fee_type === 'percentage' ? '0.1' : '1'}
                          value={lateFeeSettings.fee_amount}
                          onChange={(e) => setLateFeeSettings({ ...lateFeeSettings, fee_amount: parseFloat(e.target.value) || 0 })}
                          className="input-field"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Grace Period (days)</label>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={lateFeeSettings.grace_period_days}
                          onChange={(e) => setLateFeeSettings({ ...lateFeeSettings, grace_period_days: parseInt(e.target.value) || 0 })}
                          className="input-field"
                        />
                        <p className="text-xs text-corporate-gray mt-1">Days after due date before first fee</p>
                      </div>
                      <div>
                        <label className="label">Max Fees Per Invoice</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={lateFeeSettings.max_fees_per_invoice}
                          onChange={(e) => setLateFeeSettings({ ...lateFeeSettings, max_fees_per_invoice: parseInt(e.target.value) || 3 })}
                          className="input-field"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={lateFeeSettings.auto_apply}
                        onChange={(e) => setLateFeeSettings({ ...lateFeeSettings, auto_apply: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-corporate-slate">Auto-apply late fees (via daily cron job)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-corporate-dark mb-6">Current Plan</h2>
                <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <div>
                    <p className="font-semibold text-primary-700">Professional Plan</p>
                    <p className="text-sm text-primary-600">$29/month - Unlimited invoices & bills</p>
                  </div>
                  <button className="btn-outline text-sm py-2">Upgrade Plan</button>
                </div>
              </div>

              <div className="card">
                <h2 className="text-lg font-semibold text-corporate-dark mb-6">Payment Method</h2>
                <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                    <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
                      <rect width="32" height="20" rx="2" fill="#1A1F71"/>
                      <path d="M12 14.5L13.5 6H16L14.5 14.5H12Z" fill="white"/>
                      <path d="M21 6C20.3 6 19.7 6.3 19.3 6.8L15.5 14.5H18L18.5 13H21.5L21.8 14.5H24L22 6H21ZM19.2 11L20.3 7.5L20.9 11H19.2Z" fill="white"/>
                      <path d="M11 6L8 14.5H10.5L11 13H8.5L11 6Z" fill="white"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-corporate-dark">Visa ending in 4242</p>
                    <p className="text-sm text-corporate-gray">Expires 12/25</p>
                  </div>
                  <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Edit</button>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center justify-end gap-4 mt-6">
            {saved && (
              <span className="text-green-600 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Settings saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
