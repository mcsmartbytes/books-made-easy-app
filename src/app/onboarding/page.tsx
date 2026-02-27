'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { industries } from '@/data/industries';
import { normalBalanceByType, getAccountHelpText } from '@/data/accountHelp';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Check if user already completed onboarding
      const { data: settings } = await supabase
        .from('company_settings')
        .select('industry_id')
        .eq('user_id', session.user.id)
        .single();

      if (settings?.industry_id) {
        router.push('/dashboard');
        return;
      }

      setCheckingAuth(false);
    };
    checkUser();
  }, [router]);

  const handleComplete = async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const industry = industries.find(i => i.id === selectedIndustry);
    if (!industry) return;

    try {
      // Create or update company settings
      const { error: settingsError } = await supabase
        .from('company_settings')
        .upsert({
          user_id: session.user.id,
          company_name: companyName,
          industry_id: selectedIndustry,
        }, {
          onConflict: 'user_id',
        });

      if (settingsError) throw settingsError;

      // Create categories for the selected industry
      const categories = industry.categories.map(cat => ({
        user_id: session.user.id,
        name: cat.name,
        type: cat.type,
        tax_deductible: cat.taxDeductible || false,
        irs_category: cat.irsCategory || null,
        is_active: true,
      }));

      const { error: categoriesError } = await supabase
        .from('categories')
        .insert(categories);

      if (categoriesError) throw categoriesError;

      // Create default chart of accounts based on industry
      const defaultAccounts = getDefaultAccounts(session.user.id as string);
      const { error: accountsError } = await supabase
        .from('accounts')
        .insert(defaultAccounts);

      if (accountsError && !accountsError.message.includes('duplicate')) {
        throw accountsError;
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      alert('There was an error setting up your account. Please try again.');
      setLoading(false);
    }
  };

  const getDefaultAccounts = (userId: string) => {
    // Standard chart of accounts with normal balance and help text
    const rawAccounts = [
      // Assets
      { user_id: userId, code: '1000', name: 'Cash on Hand', type: 'asset', subtype: 'Cash' },
      { user_id: userId, code: '1010', name: 'Business Checking', type: 'asset', subtype: 'Bank' },
      { user_id: userId, code: '1020', name: 'Business Savings', type: 'asset', subtype: 'Bank' },
      { user_id: userId, code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'Accounts Receivable' },
      { user_id: userId, code: '1200', name: 'Inventory', type: 'asset', subtype: 'Inventory' },
      { user_id: userId, code: '1500', name: 'Equipment', type: 'asset', subtype: 'Fixed Assets' },
      { user_id: userId, code: '1510', name: 'Accumulated Depreciation', type: 'asset', subtype: 'Fixed Assets' },
      // Liabilities
      { user_id: userId, code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'Accounts Payable' },
      { user_id: userId, code: '2100', name: 'Credit Card', type: 'liability', subtype: 'Credit Card' },
      { user_id: userId, code: '2200', name: 'Sales Tax Payable', type: 'liability', subtype: 'Other Current Liabilities' },
      { user_id: userId, code: '2500', name: 'Loans Payable', type: 'liability', subtype: 'Loans' },
      // Equity
      { user_id: userId, code: '3000', name: 'Owner\'s Equity', type: 'equity', subtype: 'Owner Equity' },
      { user_id: userId, code: '3100', name: 'Retained Earnings', type: 'equity', subtype: 'Retained Earnings' },
      { user_id: userId, code: '3200', name: 'Owner\'s Draw', type: 'equity', subtype: 'Owner Equity' },
      // Income
      { user_id: userId, code: '4000', name: 'Service Revenue', type: 'income', subtype: 'Service Revenue' },
      { user_id: userId, code: '4100', name: 'Product Sales', type: 'income', subtype: 'Sales' },
      { user_id: userId, code: '4900', name: 'Other Income', type: 'income', subtype: 'Other Income' },
      // Expenses
      { user_id: userId, code: '5000', name: 'Cost of Goods Sold', type: 'expense', subtype: 'Cost of Goods Sold' },
      { user_id: userId, code: '6000', name: 'Advertising & Marketing', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6100', name: 'Bank Charges & Fees', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6200', name: 'Contract Labor', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6300', name: 'Depreciation Expense', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6400', name: 'Insurance', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6500', name: 'Interest Expense', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6600', name: 'Office Expenses', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6700', name: 'Professional Services', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6800', name: 'Rent Expense', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '6900', name: 'Repairs & Maintenance', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '7000', name: 'Supplies', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '7100', name: 'Travel & Meals', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '7200', name: 'Utilities', type: 'expense', subtype: 'Utilities' },
      { user_id: userId, code: '7300', name: 'Vehicle Expenses', type: 'expense', subtype: 'Operating Expenses' },
      { user_id: userId, code: '7400', name: 'Wages & Payroll', type: 'expense', subtype: 'Payroll' },
      { user_id: userId, code: '7500', name: 'Payroll Taxes', type: 'expense', subtype: 'Payroll' },
      { user_id: userId, code: '7900', name: 'Other Expenses', type: 'expense', subtype: 'Other Expenses' },
    ];

    // Add normal_balance and help_text to each account
    return rawAccounts.map(acct => ({
      ...acct,
      normal_balance: normalBalanceByType[acct.type] || 'debit',
      help_text: getAccountHelpText(acct.subtype, acct.type),
    }));
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-corporate-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-corporate-light py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`w-24 h-1 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <div className={`w-24 h-1 ${step >= 3 ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 3 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
          </div>
        </div>

        {/* Step 1: Company Name */}
        {step === 1 && (
          <div className="card text-center">
            <h1 className="text-2xl font-bold text-corporate-dark mb-2">Welcome to Books Your Way</h1>
            <p className="text-corporate-gray mb-8">Let&apos;s set up your account in just a few steps</p>

            <div className="max-w-md mx-auto">
              <label className="label text-left">What&apos;s your company name?</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input-field text-lg"
                placeholder="Your Company Name"
                autoFocus
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!companyName.trim()}
              className="btn-primary mt-8 px-12 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Industry Selection */}
        {step === 2 && (
          <div className="card">
            <h1 className="text-2xl font-bold text-corporate-dark mb-2 text-center">Select Your Industry</h1>
            <p className="text-corporate-gray mb-8 text-center">We&apos;ll set up categories and accounts tailored to your business</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {industries.map((industry) => (
                <button
                  key={industry.id}
                  onClick={() => setSelectedIndustry(industry.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left hover:border-primary-300 hover:bg-primary-50 ${
                    selectedIndustry === industry.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-3xl mb-2 block">{industry.icon}</span>
                  <h3 className="font-semibold text-corporate-dark text-sm">{industry.name}</h3>
                  <p className="text-xs text-corporate-gray mt-1 line-clamp-2">{industry.description}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-4 mt-8 justify-center">
              <button onClick={() => setStep(1)} className="btn-secondary px-8">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedIndustry}
                className="btn-primary px-12 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && (
          <div className="card">
            <h1 className="text-2xl font-bold text-corporate-dark mb-2 text-center">Review Your Setup</h1>
            <p className="text-corporate-gray mb-8 text-center">We&apos;ll create these categories for your business</p>

            <div className="bg-corporate-light rounded-xl p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl">{industries.find(i => i.id === selectedIndustry)?.icon}</span>
                <div>
                  <h3 className="font-bold text-corporate-dark text-lg">{companyName}</h3>
                  <p className="text-corporate-gray">{industries.find(i => i.id === selectedIndustry)?.name}</p>
                </div>
              </div>
            </div>

            {/* Category Preview */}
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-corporate-dark mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  Income Categories ({industries.find(i => i.id === selectedIndustry)?.categories.filter(c => c.type === 'service' || c.type === 'product').length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {industries.find(i => i.id === selectedIndustry)?.categories
                    .filter(c => c.type === 'service' || c.type === 'product')
                    .slice(0, 6)
                    .map((cat, idx) => (
                      <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        {cat.name}
                      </span>
                    ))}
                  {(industries.find(i => i.id === selectedIndustry)?.categories.filter(c => c.type === 'service' || c.type === 'product').length || 0) > 6 && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                      +{(industries.find(i => i.id === selectedIndustry)?.categories.filter(c => c.type === 'service' || c.type === 'product').length || 0) - 6} more
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-corporate-dark mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                  Expense Categories ({industries.find(i => i.id === selectedIndustry)?.categories.filter(c => c.type === 'expense').length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {industries.find(i => i.id === selectedIndustry)?.categories
                    .filter(c => c.type === 'expense')
                    .slice(0, 6)
                    .map((cat, idx) => (
                      <span key={idx} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                        {cat.name}
                      </span>
                    ))}
                  {(industries.find(i => i.id === selectedIndustry)?.categories.filter(c => c.type === 'expense').length || 0) > 6 && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                      +{(industries.find(i => i.id === selectedIndustry)?.categories.filter(c => c.type === 'expense').length || 0) - 6} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-corporate-gray mt-6 text-center">
              You can always add, edit, or remove categories later in Settings
            </p>

            <div className="flex gap-4 mt-8 justify-center">
              <button onClick={() => setStep(2)} className="btn-secondary px-8" disabled={loading}>
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="btn-primary px-12 disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
