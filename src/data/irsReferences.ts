// IRS Reference Data for Small Business Owners
// Schedule C (Form 1040) - Profit or Loss From Business

export interface ScheduleCLine {
  line: string;
  label: string;
  description: string;
  irsCategories: string[]; // maps to irsCategories from industries.ts
  tips?: string;
}

export interface MileageRate {
  year: number;
  businessRate: number; // cents per mile
  medicalRate: number;
  charityRate: number;
}

export interface FilingDeadline {
  form: string;
  description: string;
  deadline: string;
  notes?: string;
}

export interface DeductionLimit {
  category: string;
  limit: string;
  details: string;
}

// Schedule C Line-by-Line Reference
export const scheduleCLines: ScheduleCLine[] = [
  {
    line: '1',
    label: 'Gross receipts or sales',
    description: 'Total income from your business before any deductions. Includes all payments for goods sold or services performed.',
    irsCategories: ['Gross Receipts'],
    tips: 'Include all 1099-NEC, 1099-K, and cash payments received.',
  },
  {
    line: '2',
    label: 'Returns and allowances',
    description: 'Refunds you gave to customers, rebates, and other allowances off the sale price.',
    irsCategories: ['Returns & Allowances'],
  },
  {
    line: '4',
    label: 'Cost of goods sold',
    description: 'Direct costs of producing goods you sold: materials, labor, shipping to you.',
    irsCategories: ['COGS'],
    tips: 'Calculated on Schedule C Part III. Only for businesses that sell products.',
  },
  {
    line: '6',
    label: 'Other income',
    description: 'Business income not from sales: interest on business accounts, recovered bad debts, scrap sales.',
    irsCategories: ['Other Income', 'Rents Received'],
  },
  {
    line: '8',
    label: 'Advertising',
    description: 'Costs to advertise your business: online ads, print ads, business cards, website, signage.',
    irsCategories: ['Advertising'],
    tips: 'Includes Google Ads, Facebook Ads, website hosting for marketing, and promotional materials.',
  },
  {
    line: '9',
    label: 'Car and truck expenses',
    description: 'Business use of your vehicle. Choose standard mileage rate OR actual expenses (gas, insurance, repairs, depreciation).',
    irsCategories: ['Car & Truck'],
    tips: 'Keep a mileage log. You cannot switch methods on a leased vehicle.',
  },
  {
    line: '10',
    label: 'Commissions and fees',
    description: 'Commissions paid to non-employees, referral fees, and sales commissions.',
    irsCategories: ['Commissions'],
    tips: 'Issue 1099-NEC for commissions over $600 paid to individuals.',
  },
  {
    line: '11',
    label: 'Contract labor',
    description: 'Payments to independent contractors for services. Must issue 1099-NEC if $600+.',
    irsCategories: ['Contract Labor'],
    tips: 'Keep W-9s on file for all contractors.',
  },
  {
    line: '12',
    label: 'Depletion',
    description: 'Depletion of natural resources (mining, oil, gas, timber).',
    irsCategories: [],
  },
  {
    line: '13',
    label: 'Depreciation (Section 179)',
    description: 'Cost recovery for business assets over their useful life, or immediate Section 179 expensing.',
    irsCategories: ['Depreciation', 'Equipment'],
    tips: 'Section 179 allows deducting the full cost of qualifying assets in the year purchased (up to $1,220,000 for 2024).',
  },
  {
    line: '14',
    label: 'Employee benefit programs',
    description: 'Health insurance, retirement plan contributions, and other benefits for employees (not yourself).',
    irsCategories: ['Employee Benefits'],
    tips: 'Self-employed health insurance is deducted on Form 1040, not Schedule C.',
  },
  {
    line: '15',
    label: 'Insurance (other than health)',
    description: 'Business insurance premiums: liability, property, E&O, workers comp, malpractice.',
    irsCategories: ['Insurance'],
    tips: 'Does not include health insurance for yourself (that goes on Form 1040 line 17).',
  },
  {
    line: '16a',
    label: 'Mortgage interest paid to banks',
    description: 'Interest on mortgages for business property paid to financial institutions.',
    irsCategories: ['Interest'],
  },
  {
    line: '16b',
    label: 'Other interest',
    description: 'Business loan interest, credit card interest on business purchases.',
    irsCategories: ['Interest'],
  },
  {
    line: '17',
    label: 'Legal and professional services',
    description: 'Attorney fees, CPA/accountant fees, bookkeeping, tax preparation for your business.',
    irsCategories: ['Legal & Professional', 'Professional Services'],
    tips: 'Only the business portion of tax preparation fees is deductible here.',
  },
  {
    line: '18',
    label: 'Office expense',
    description: 'Office supplies, postage, software subscriptions, computer supplies, printer ink.',
    irsCategories: ['Office Expense'],
    tips: 'Includes SaaS subscriptions, cloud hosting, and other digital tools used for business.',
  },
  {
    line: '19',
    label: 'Pension and profit-sharing plans',
    description: 'Employer contributions to employee pension or retirement plans.',
    irsCategories: [],
    tips: 'SEP-IRA and SIMPLE IRA contributions for yourself go on Form 1040.',
  },
  {
    line: '20a',
    label: 'Rent - vehicles, machinery, equipment',
    description: 'Rental or lease payments for business equipment, machinery, or vehicles.',
    irsCategories: ['Rent - Equipment'],
  },
  {
    line: '20b',
    label: 'Rent - other business property',
    description: 'Rent for office space, warehouse, retail space, and other real property.',
    irsCategories: ['Rent'],
    tips: 'If you rent your home and use part for business, report the business portion here.',
  },
  {
    line: '21',
    label: 'Repairs and maintenance',
    description: 'Costs to repair and maintain business property and equipment.',
    irsCategories: ['Repairs'],
    tips: 'Repairs maintain property; improvements that increase value must be depreciated.',
  },
  {
    line: '22',
    label: 'Supplies',
    description: 'Materials and supplies consumed in the course of business.',
    irsCategories: ['Supplies'],
  },
  {
    line: '23',
    label: 'Taxes and licenses',
    description: 'Business taxes, licenses, regulatory fees, and permits.',
    irsCategories: ['Taxes & Licenses', 'Licenses & Permits'],
    tips: 'Includes state/local business taxes, sales tax you pay on business purchases, and business license fees.',
  },
  {
    line: '24a',
    label: 'Travel',
    description: 'Business travel costs: airfare, hotel, rental car, transportation. Must be overnight and away from your tax home.',
    irsCategories: ['Travel'],
    tips: 'Keep receipts and document the business purpose of each trip.',
  },
  {
    line: '24b',
    label: 'Deductible meals',
    description: 'Business meals: 50% deductible when directly related to business discussion.',
    irsCategories: ['Meals & Entertainment'],
    tips: 'Entertainment expenses are NOT deductible since 2018. Meals are 50% deductible.',
  },
  {
    line: '25',
    label: 'Utilities',
    description: 'Electric, gas, water, phone, and internet for your business location.',
    irsCategories: ['Utilities'],
    tips: 'If you use a home office, deduct the business percentage of household utilities.',
  },
  {
    line: '26',
    label: 'Wages',
    description: 'Salaries and wages paid to employees (W-2 workers, not contractors).',
    irsCategories: ['Wages'],
    tips: 'You cannot deduct wages you pay to yourself as a sole proprietor.',
  },
  {
    line: '27a',
    label: 'Other expenses (from line 48)',
    description: 'Any legitimate business expenses not listed above.',
    irsCategories: ['Other Expense', 'Dues & Subscriptions', 'Education', 'Bank Charges', 'Gifts'],
    tips: 'List each expense type separately on Part V (line 48). Common items: bank fees, education, subscriptions, business gifts.',
  },
];

// IRS Standard Mileage Rates
export const mileageRates: MileageRate[] = [
  { year: 2026, businessRate: 70.0, medicalRate: 22, charityRate: 14 },
  { year: 2025, businessRate: 70.0, medicalRate: 21, charityRate: 14 },
  { year: 2024, businessRate: 67.0, medicalRate: 21, charityRate: 14 },
  { year: 2023, businessRate: 65.5, medicalRate: 22, charityRate: 14 },
  { year: 2022, businessRate: 62.5, medicalRate: 22, charityRate: 14 },
];

// Key Filing Deadlines
export const filingDeadlines: FilingDeadline[] = [
  {
    form: 'Form 1040 + Schedule C',
    description: 'Individual income tax return with business profit/loss',
    deadline: 'April 15',
    notes: 'Extension to October 15 available with Form 4868',
  },
  {
    form: 'Estimated Taxes (1040-ES)',
    description: 'Quarterly estimated tax payments for self-employed',
    deadline: 'Apr 15, Jun 15, Sep 15, Jan 15',
    notes: 'Required if you expect to owe $1,000+ in taxes',
  },
  {
    form: '1099-NEC',
    description: 'Report payments of $600+ to independent contractors',
    deadline: 'January 31',
    notes: 'File with IRS and provide copy to recipient',
  },
  {
    form: '1099-MISC',
    description: 'Report rents, royalties, and other income payments',
    deadline: 'January 31 (to recipient) / February 28 (to IRS)',
    notes: 'E-file deadline is March 31',
  },
  {
    form: 'W-2',
    description: 'Report wages and withholdings for employees',
    deadline: 'January 31',
    notes: 'File with SSA and provide copy to employees',
  },
  {
    form: 'Form 941',
    description: 'Quarterly employment tax return',
    deadline: 'Apr 30, Jul 31, Oct 31, Jan 31',
    notes: 'For employers who withhold income tax and FICA',
  },
  {
    form: 'Form 940',
    description: 'Annual federal unemployment (FUTA) tax return',
    deadline: 'January 31',
    notes: 'Due by February 10 if all FUTA tax was deposited on time',
  },
  {
    form: 'Schedule SE',
    description: 'Self-employment tax (Social Security + Medicare)',
    deadline: 'Filed with Form 1040',
    notes: '15.3% on net self-employment income (12.4% SS + 2.9% Medicare)',
  },
  {
    form: 'Form 8829',
    description: 'Home office deduction',
    deadline: 'Filed with Form 1040',
    notes: 'Simplified method: $5/sq ft, max 300 sq ft ($1,500). Regular method requires tracking actual expenses.',
  },
  {
    form: 'Sales Tax Returns',
    description: 'State/local sales tax collected from customers',
    deadline: 'Varies by state (monthly, quarterly, or annual)',
    notes: 'Check your state requirements. Nexus rules apply for online sellers.',
  },
];

// Common Deduction Limits
export const deductionLimits: DeductionLimit[] = [
  {
    category: 'Business Meals',
    limit: '50% deductible',
    details: 'Must be directly related to or associated with business. Keep receipts showing who attended, business purpose, and amount.',
  },
  {
    category: 'Business Gifts',
    limit: '$25 per recipient per year',
    details: 'Deduction limited to $25 per person. Does not include incidental costs like engraving or gift wrapping.',
  },
  {
    category: 'Home Office',
    limit: 'Simplified: $1,500/year (300 sq ft x $5)',
    details: 'Space must be used regularly and exclusively for business. Regular method allows actual proportional expenses.',
  },
  {
    category: 'Section 179 Expensing',
    limit: '$1,220,000 (2024)',
    details: 'Immediately deduct cost of qualifying business equipment instead of depreciating. Phases out when total equipment exceeds $3,050,000.',
  },
  {
    category: 'Vehicle Depreciation (MACRS)',
    limit: 'Year 1: $12,400 (2024)',
    details: 'Luxury vehicle depreciation caps apply. Higher limits for trucks/SUVs over 6,000 lbs GVWR.',
  },
  {
    category: 'Health Insurance (Self-Employed)',
    limit: 'Up to net self-employment income',
    details: 'Deducted on Form 1040 (not Schedule C). Cannot exceed net profit from business.',
  },
  {
    category: 'Retirement Contributions (SEP-IRA)',
    limit: '25% of net earnings, max $69,000 (2024)',
    details: 'Net earnings = net profit minus half of self-employment tax. Deadline is tax filing deadline including extensions.',
  },
  {
    category: 'Startup Costs',
    limit: '$5,000 deductible in first year',
    details: 'Up to $5,000 deductible immediately; remainder amortized over 180 months. Phases out when startup costs exceed $50,000.',
  },
  {
    category: 'Qualified Business Income (QBI)',
    limit: '20% of qualified business income',
    details: 'Section 199A deduction. Phase-out begins at $191,950 (single) / $383,900 (MFJ) for 2024. Certain service businesses may be limited.',
  },
];

// Map IRS categories to Schedule C line numbers for quick lookup
export const irsCategoryToLine: Record<string, string> = {};
scheduleCLines.forEach(line => {
  line.irsCategories.forEach(cat => {
    irsCategoryToLine[cat] = `Line ${line.line}`;
  });
});
