'use client';

import { useState } from 'react';
import {
  scheduleCLines,
  mileageRates,
  filingDeadlines,
  deductionLimits,
  irsCategoryToLine,
} from '@/data/irsReferences';

type Tab = 'schedule-c' | 'mileage' | 'deadlines' | 'limits';

export default function IrsReferencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule-c');
  const [searchTerm, setSearchTerm] = useState('');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'schedule-c', label: 'Schedule C' },
    { id: 'mileage', label: 'Mileage Rates' },
    { id: 'deadlines', label: 'Filing Deadlines' },
    { id: 'limits', label: 'Deduction Limits' },
  ];

  const filteredLines = scheduleCLines.filter(line => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      line.label.toLowerCase().includes(term) ||
      line.description.toLowerCase().includes(term) ||
      line.irsCategories.some(c => c.toLowerCase().includes(term)) ||
      line.tips?.toLowerCase().includes(term) ||
      `line ${line.line}`.includes(term)
    );
  });

  const filteredDeadlines = filingDeadlines.filter(d => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.form.toLowerCase().includes(term) ||
      d.description.toLowerCase().includes(term) ||
      d.notes?.toLowerCase().includes(term)
    );
  });

  const filteredLimits = deductionLimits.filter(l => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.category.toLowerCase().includes(term) ||
      l.details.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-corporate-dark">IRS References</h1>
        <p className="text-corporate-gray mt-1">
          Quick reference for Schedule C, mileage rates, filing deadlines, and deduction limits
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-800">
            This is a general reference guide. Tax laws change annually. Always consult a qualified tax professional for advice specific to your situation.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-corporate-gray hover:text-corporate-dark hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={
              activeTab === 'schedule-c' ? 'Search by line number, category, or keyword...' :
              activeTab === 'deadlines' ? 'Search by form or description...' :
              'Search...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Schedule C Tab */}
      {activeTab === 'schedule-c' && (
        <div className="space-y-3">
          {filteredLines.length === 0 ? (
            <div className="card text-center py-8 text-corporate-gray">
              No matching Schedule C lines found
            </div>
          ) : (
            filteredLines.map(line => (
              <div key={line.line} className="card hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Line number badge */}
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-16 h-8 bg-primary-100 text-primary-700 rounded-lg text-sm font-bold">
                      Line {line.line}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-corporate-dark">{line.label}</h3>
                    <p className="text-sm text-corporate-slate mt-1">{line.description}</p>

                    {/* IRS Categories that map to this line */}
                    {line.irsCategories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {line.irsCategories.map(cat => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 bg-gray-100 text-corporate-slate rounded text-xs"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tips */}
                    {line.tips && (
                      <div className="mt-3 flex gap-2 p-2.5 bg-blue-50 rounded-lg">
                        <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-blue-800">{line.tips}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Mileage Rates Tab */}
      {activeTab === 'mileage' && (
        <div className="space-y-6">
          {/* Current year highlight */}
          <div className="card bg-primary-50 border-primary-200">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <h3 className="text-lg font-semibold text-primary-700">{mileageRates[0].year} Standard Mileage Rates</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-primary-600">{mileageRates[0].businessRate}&cent;</p>
                <p className="text-sm text-corporate-gray mt-1">Business</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-corporate-dark">{mileageRates[0].medicalRate}&cent;</p>
                <p className="text-sm text-corporate-gray mt-1">Medical / Moving</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-corporate-dark">{mileageRates[0].charityRate}&cent;</p>
                <p className="text-sm text-corporate-gray mt-1">Charity</p>
              </div>
            </div>
          </div>

          {/* Historical rates */}
          <div className="card overflow-hidden">
            <h3 className="text-lg font-medium text-corporate-dark mb-4">Historical Rates</h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="text-right">Business</th>
                    <th className="text-right">Medical</th>
                    <th className="text-right">Charity</th>
                  </tr>
                </thead>
                <tbody>
                  {mileageRates.map(rate => (
                    <tr key={rate.year}>
                      <td className="font-medium text-corporate-dark">{rate.year}</td>
                      <td className="text-right text-corporate-slate">{rate.businessRate}&cent;/mi</td>
                      <td className="text-right text-corporate-slate">{rate.medicalRate}&cent;/mi</td>
                      <td className="text-right text-corporate-slate">{rate.charityRate}&cent;/mi</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tips */}
          <div className="card">
            <h3 className="text-lg font-medium text-corporate-dark mb-3">Mileage Tracking Tips</h3>
            <ul className="space-y-2 text-sm text-corporate-slate">
              <li className="flex gap-2">
                <span className="text-primary-600 font-bold">1.</span>
                Log each trip with date, destination, business purpose, and miles driven.
              </li>
              <li className="flex gap-2">
                <span className="text-primary-600 font-bold">2.</span>
                Commuting miles (home to office) are NOT deductible.
              </li>
              <li className="flex gap-2">
                <span className="text-primary-600 font-bold">3.</span>
                Choose standard mileage rate OR actual expenses — you must decide in the first year you use the vehicle for business.
              </li>
              <li className="flex gap-2">
                <span className="text-primary-600 font-bold">4.</span>
                Standard mileage rate includes gas, insurance, repairs, and depreciation. Do not deduct these separately.
              </li>
              <li className="flex gap-2">
                <span className="text-primary-600 font-bold">5.</span>
                Parking and tolls for business trips are deductible in addition to the standard mileage rate.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Filing Deadlines Tab */}
      {activeTab === 'deadlines' && (
        <div className="space-y-3">
          {filteredDeadlines.length === 0 ? (
            <div className="card text-center py-8 text-corporate-gray">
              No matching deadlines found
            </div>
          ) : (
            filteredDeadlines.map((deadline, idx) => (
              <div key={idx} className="card hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold whitespace-nowrap">
                      {deadline.deadline}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-corporate-dark">{deadline.form}</h3>
                    <p className="text-sm text-corporate-slate mt-1">{deadline.description}</p>
                    {deadline.notes && (
                      <p className="text-xs text-corporate-gray mt-2 italic">{deadline.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Deduction Limits Tab */}
      {activeTab === 'limits' && (
        <div className="space-y-3">
          {filteredLimits.length === 0 ? (
            <div className="card text-center py-8 text-corporate-gray">
              No matching deduction limits found
            </div>
          ) : (
            filteredLimits.map((limit, idx) => (
              <div key={idx} className="card hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold whitespace-nowrap">
                      {limit.limit}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-corporate-dark">{limit.category}</h3>
                    <p className="text-sm text-corporate-slate mt-1">{limit.details}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
