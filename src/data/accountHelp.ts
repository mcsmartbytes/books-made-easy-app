// Default help text and normal balance for account subtypes
// Normal balance: Assets & Expenses = Debit, Liabilities, Equity & Income = Credit

export const normalBalanceByType: Record<string, 'debit' | 'credit'> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  income: 'credit',
};

export const accountHelpBySubtype: Record<string, string> = {
  // Assets
  'Cash': 'Cash on hand, including petty cash. Increases with debits.',
  'Bank': 'Money held in checking or savings accounts at financial institutions.',
  'Accounts Receivable': 'Amounts owed to your business by customers for goods or services delivered but not yet paid.',
  'Inventory': 'Goods purchased or manufactured for resale to customers.',
  'Fixed Assets': 'Long-term tangible property such as equipment, vehicles, and buildings. Subject to depreciation.',
  'Other Current Assets': 'Short-term assets expected to be converted to cash within one year.',
  // Liabilities
  'Accounts Payable': 'Amounts your business owes to vendors and suppliers for goods or services received.',
  'Credit Card': 'Outstanding balances on business credit cards.',
  'Loans': 'Money borrowed from banks or other lenders, typically with scheduled repayment terms.',
  'Other Current Liabilities': 'Short-term obligations due within one year (e.g., sales tax payable, accrued wages).',
  'Long-term Liabilities': 'Obligations not due within the next 12 months (e.g., mortgages, long-term notes).',
  // Equity
  'Owner Equity': 'The owner\'s investment in the business, including contributions and draws.',
  'Retained Earnings': 'Cumulative net income that has been reinvested in the business rather than distributed.',
  'Common Stock': 'Equity shares issued by a corporation to its shareholders.',
  // Income
  'Sales': 'Revenue earned from selling products or goods.',
  'Service Revenue': 'Revenue earned from providing services to customers.',
  'Interest Income': 'Income earned from bank accounts, loans, or other interest-bearing investments.',
  'Other Income': 'Miscellaneous income not from primary business operations (e.g., gains on asset sales).',
  // Expenses
  'Cost of Goods Sold': 'Direct costs of producing goods sold (materials, direct labor, manufacturing overhead).',
  'Operating Expenses': 'Day-to-day costs of running the business (office supplies, software, etc.).',
  'Payroll': 'Employee wages, salaries, and payroll-related taxes and benefits.',
  'Marketing': 'Advertising, promotions, and marketing campaign costs.',
  'Utilities': 'Electric, gas, water, internet, and phone service costs.',
  'Rent': 'Payments for leasing office space, equipment, or other property.',
  'Other Expenses': 'Miscellaneous business expenses not categorized elsewhere.',
};

// Returns help text for a given subtype, with a fallback based on account type
export function getAccountHelpText(subtype: string, type: string): string {
  if (subtype && accountHelpBySubtype[subtype]) {
    return accountHelpBySubtype[subtype];
  }
  const typeDefaults: Record<string, string> = {
    asset: 'Resources owned by the business that have economic value. Normal balance: Debit.',
    liability: 'Obligations the business owes to others. Normal balance: Credit.',
    equity: 'The owner\'s residual interest in business assets after deducting liabilities. Normal balance: Credit.',
    income: 'Revenue earned from business operations. Normal balance: Credit.',
    expense: 'Costs incurred in the process of earning revenue. Normal balance: Debit.',
  };
  return typeDefaults[type] || '';
}
