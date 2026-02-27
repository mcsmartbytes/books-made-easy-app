// Industry definitions with preset categories, products/services, and expense types

export interface IndustryCategory {
  name: string;
  type: 'income' | 'expense' | 'product' | 'service';
  taxDeductible?: boolean;
  irsCategory?: string;
}

export interface Industry {
  id: string;
  name: string;
  icon: string;
  description: string;
  categories: IndustryCategory[];
}

export const industries: Industry[] = [
  {
    id: 'consulting',
    name: 'Consulting & Professional Services',
    icon: '💼',
    description: 'Business consulting, legal, accounting, and professional services',
    categories: [
      // Income/Services
      { name: 'Consulting Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Advisory Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Project Management', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Training & Workshops', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Retainer Fees', type: 'service', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Professional Development', type: 'expense', taxDeductible: true, irsCategory: 'Education' },
      { name: 'Software Subscriptions', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Professional Memberships', type: 'expense', taxDeductible: true, irsCategory: 'Dues & Subscriptions' },
      { name: 'Client Entertainment', type: 'expense', taxDeductible: true, irsCategory: 'Meals & Entertainment' },
      { name: 'Travel - Client Visits', type: 'expense', taxDeductible: true, irsCategory: 'Travel' },
      { name: 'Office Supplies', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Marketing & Advertising', type: 'expense', taxDeductible: true, irsCategory: 'Advertising' },
      { name: 'Insurance - Professional Liability', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
    ],
  },
  {
    id: 'retail',
    name: 'Retail & E-commerce',
    icon: '🛍️',
    description: 'Physical and online retail stores',
    categories: [
      // Products
      { name: 'Merchandise Sales', type: 'product', irsCategory: 'Gross Receipts' },
      { name: 'Shipping Revenue', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Gift Cards', type: 'product', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Cost of Goods Sold', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Inventory Purchases', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Shipping & Freight', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Packaging Supplies', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Payment Processing Fees', type: 'expense', taxDeductible: true, irsCategory: 'Bank Charges' },
      { name: 'E-commerce Platform Fees', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Store Rent', type: 'expense', taxDeductible: true, irsCategory: 'Rent' },
      { name: 'Store Utilities', type: 'expense', taxDeductible: true, irsCategory: 'Utilities' },
      { name: 'Marketing & Advertising', type: 'expense', taxDeductible: true, irsCategory: 'Advertising' },
      { name: 'Returns & Refunds', type: 'expense', taxDeductible: true, irsCategory: 'Returns & Allowances' },
    ],
  },
  {
    id: 'construction',
    name: 'Construction & Contracting',
    icon: '🏗️',
    description: 'General contractors, builders, and construction services',
    categories: [
      // Services
      { name: 'Contract Labor', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Project Revenue', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Change Orders', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Permit Fees Billed', type: 'service', irsCategory: 'Gross Receipts' },
      // Products
      { name: 'Materials Sales', type: 'product', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Building Materials', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Subcontractor Payments', type: 'expense', taxDeductible: true, irsCategory: 'Contract Labor' },
      { name: 'Equipment Rental', type: 'expense', taxDeductible: true, irsCategory: 'Rent - Equipment' },
      { name: 'Tool Purchases', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Permits & Licenses', type: 'expense', taxDeductible: true, irsCategory: 'Licenses & Permits' },
      { name: 'Workers Comp Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
      { name: 'Vehicle - Fuel', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Vehicle - Maintenance', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Safety Equipment', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Waste Disposal', type: 'expense', taxDeductible: true, irsCategory: 'Other Expense' },
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Medical',
    icon: '🏥',
    description: 'Medical practices, clinics, and healthcare providers',
    categories: [
      // Services
      { name: 'Patient Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Consultation Fees', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Procedures', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Lab Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Telehealth Services', type: 'service', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Medical Supplies', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Medical Equipment', type: 'expense', taxDeductible: true, irsCategory: 'Equipment' },
      { name: 'Lab Supplies', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Malpractice Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
      { name: 'Continuing Education', type: 'expense', taxDeductible: true, irsCategory: 'Education' },
      { name: 'Medical Licenses', type: 'expense', taxDeductible: true, irsCategory: 'Licenses & Permits' },
      { name: 'EHR Software', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Billing Services', type: 'expense', taxDeductible: true, irsCategory: 'Professional Services' },
      { name: 'Office Rent', type: 'expense', taxDeductible: true, irsCategory: 'Rent' },
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant & Food Service',
    icon: '🍽️',
    description: 'Restaurants, cafes, catering, and food trucks',
    categories: [
      // Products/Services
      { name: 'Food Sales', type: 'product', irsCategory: 'Gross Receipts' },
      { name: 'Beverage Sales', type: 'product', irsCategory: 'Gross Receipts' },
      { name: 'Catering Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Delivery Revenue', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Gift Cards', type: 'product', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Food Costs', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Beverage Costs', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Kitchen Supplies', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Disposables & Packaging', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Restaurant Rent', type: 'expense', taxDeductible: true, irsCategory: 'Rent' },
      { name: 'Utilities', type: 'expense', taxDeductible: true, irsCategory: 'Utilities' },
      { name: 'Equipment Maintenance', type: 'expense', taxDeductible: true, irsCategory: 'Repairs' },
      { name: 'Health Permits', type: 'expense', taxDeductible: true, irsCategory: 'Licenses & Permits' },
      { name: 'Delivery App Fees', type: 'expense', taxDeductible: true, irsCategory: 'Commissions' },
      { name: 'POS System', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
    ],
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    icon: '🏠',
    description: 'Real estate agents, property management, and brokers',
    categories: [
      // Services
      { name: 'Commission Income', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Property Management Fees', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Referral Fees Received', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Rental Income', type: 'service', irsCategory: 'Rents Received' },
      // Expenses
      { name: 'MLS Fees', type: 'expense', taxDeductible: true, irsCategory: 'Dues & Subscriptions' },
      { name: 'Referral Fees Paid', type: 'expense', taxDeductible: true, irsCategory: 'Commissions' },
      { name: 'Marketing - Listings', type: 'expense', taxDeductible: true, irsCategory: 'Advertising' },
      { name: 'Photography & Staging', type: 'expense', taxDeductible: true, irsCategory: 'Advertising' },
      { name: 'Signage', type: 'expense', taxDeductible: true, irsCategory: 'Advertising' },
      { name: 'Lockbox & Key Services', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'E&O Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
      { name: 'License Renewal', type: 'expense', taxDeductible: true, irsCategory: 'Licenses & Permits' },
      { name: 'Client Gifts', type: 'expense', taxDeductible: true, irsCategory: 'Gifts' },
      { name: 'Vehicle Expenses', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
    ],
  },
  {
    id: 'technology',
    name: 'Technology & Software',
    icon: '💻',
    description: 'Software development, IT services, and tech startups',
    categories: [
      // Services/Products
      { name: 'Software Licenses', type: 'product', irsCategory: 'Gross Receipts' },
      { name: 'SaaS Subscriptions', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Development Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Support & Maintenance', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Implementation Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Training Services', type: 'service', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Cloud Hosting (AWS/GCP/Azure)', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Software Tools & IDEs', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'API Services', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Domain & SSL', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Contractor Developers', type: 'expense', taxDeductible: true, irsCategory: 'Contract Labor' },
      { name: 'Hardware & Equipment', type: 'expense', taxDeductible: true, irsCategory: 'Equipment' },
      { name: 'Cyber Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
      { name: 'Conference & Events', type: 'expense', taxDeductible: true, irsCategory: 'Travel' },
    ],
  },
  {
    id: 'creative',
    name: 'Creative & Design',
    icon: '🎨',
    description: 'Graphic design, photography, videography, and creative agencies',
    categories: [
      // Services
      { name: 'Design Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Photography Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Video Production', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Branding Projects', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Print Design', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Stock License Sales', type: 'product', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Adobe Creative Suite', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Design Software', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Stock Photos/Assets', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Camera Equipment', type: 'expense', taxDeductible: true, irsCategory: 'Equipment' },
      { name: 'Printing Costs', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Props & Styling', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Studio Rent', type: 'expense', taxDeductible: true, irsCategory: 'Rent' },
      { name: 'Portfolio Website', type: 'expense', taxDeductible: true, irsCategory: 'Advertising' },
    ],
  },
  {
    id: 'fitness',
    name: 'Fitness & Wellness',
    icon: '💪',
    description: 'Gyms, personal trainers, yoga studios, and wellness coaches',
    categories: [
      // Services
      { name: 'Membership Fees', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Personal Training', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Group Classes', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Nutrition Coaching', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Online Programs', type: 'service', irsCategory: 'Gross Receipts' },
      // Products
      { name: 'Merchandise Sales', type: 'product', irsCategory: 'Gross Receipts' },
      { name: 'Supplement Sales', type: 'product', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Fitness Equipment', type: 'expense', taxDeductible: true, irsCategory: 'Equipment' },
      { name: 'Equipment Maintenance', type: 'expense', taxDeductible: true, irsCategory: 'Repairs' },
      { name: 'Certifications', type: 'expense', taxDeductible: true, irsCategory: 'Education' },
      { name: 'Liability Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
      { name: 'Facility Rent', type: 'expense', taxDeductible: true, irsCategory: 'Rent' },
      { name: 'Cleaning & Sanitation', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Music Licensing', type: 'expense', taxDeductible: true, irsCategory: 'Dues & Subscriptions' },
      { name: 'Booking Software', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
    ],
  },
  {
    id: 'transportation',
    name: 'Transportation & Logistics',
    icon: '🚚',
    description: 'Trucking, delivery services, and logistics companies',
    categories: [
      // Services
      { name: 'Freight Revenue', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Delivery Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Hauling Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Fuel Surcharge', type: 'service', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Fuel', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Vehicle Maintenance', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Vehicle Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
      { name: 'Truck Payments', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Tolls', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'DOT Compliance', type: 'expense', taxDeductible: true, irsCategory: 'Licenses & Permits' },
      { name: 'CDL & Medical Cards', type: 'expense', taxDeductible: true, irsCategory: 'Licenses & Permits' },
      { name: 'Load Board Subscriptions', type: 'expense', taxDeductible: true, irsCategory: 'Dues & Subscriptions' },
      { name: 'ELD/GPS Service', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Cargo Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
    ],
  },
  {
    id: 'landscaping',
    name: 'Landscaping & Lawn Care',
    icon: '🌿',
    description: 'Landscaping, lawn maintenance, and outdoor services',
    categories: [
      // Services
      { name: 'Lawn Maintenance', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Landscaping Design', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Tree Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Irrigation Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Snow Removal', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Hardscaping', type: 'service', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Plants & Materials', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Mulch & Soil', type: 'expense', taxDeductible: true, irsCategory: 'COGS' },
      { name: 'Equipment - Mowers', type: 'expense', taxDeductible: true, irsCategory: 'Equipment' },
      { name: 'Equipment - Fuel', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Equipment Maintenance', type: 'expense', taxDeductible: true, irsCategory: 'Repairs' },
      { name: 'Vehicle Expenses', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Trailer Expenses', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Pesticide License', type: 'expense', taxDeductible: true, irsCategory: 'Licenses & Permits' },
      { name: 'Liability Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
    ],
  },
  {
    id: 'cleaning',
    name: 'Cleaning Services',
    icon: '🧹',
    description: 'Residential and commercial cleaning services',
    categories: [
      // Services
      { name: 'Residential Cleaning', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Commercial Cleaning', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Deep Cleaning', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Move-in/Move-out', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Window Cleaning', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Carpet Cleaning', type: 'service', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Cleaning Supplies', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Equipment', type: 'expense', taxDeductible: true, irsCategory: 'Equipment' },
      { name: 'Vehicle Expenses', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Uniforms', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Bonding & Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
      { name: 'Background Checks', type: 'expense', taxDeductible: true, irsCategory: 'Other Expense' },
      { name: 'Scheduling Software', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
    ],
  },
  {
    id: 'education',
    name: 'Education & Tutoring',
    icon: '📚',
    description: 'Tutoring, online courses, and educational services',
    categories: [
      // Services
      { name: 'Tutoring Sessions', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Online Courses', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Workshop Fees', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Test Prep Services', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Coaching Services', type: 'service', irsCategory: 'Gross Receipts' },
      // Products
      { name: 'Course Materials', type: 'product', irsCategory: 'Gross Receipts' },
      { name: 'Workbooks', type: 'product', irsCategory: 'Gross Receipts' },
      // Expenses
      { name: 'Educational Materials', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Course Platform Fees', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Video Equipment', type: 'expense', taxDeductible: true, irsCategory: 'Equipment' },
      { name: 'Teaching Certifications', type: 'expense', taxDeductible: true, irsCategory: 'Education' },
      { name: 'Background Check', type: 'expense', taxDeductible: true, irsCategory: 'Other Expense' },
      { name: 'Zoom/Meeting Software', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Marketing', type: 'expense', taxDeductible: true, irsCategory: 'Advertising' },
    ],
  },
  {
    id: 'other',
    name: 'Other / General Business',
    icon: '🏢',
    description: 'General business categories for any industry',
    categories: [
      // Services/Products
      { name: 'Services Revenue', type: 'service', irsCategory: 'Gross Receipts' },
      { name: 'Product Sales', type: 'product', irsCategory: 'Gross Receipts' },
      { name: 'Other Income', type: 'service', irsCategory: 'Other Income' },
      // Expenses
      { name: 'Advertising & Marketing', type: 'expense', taxDeductible: true, irsCategory: 'Advertising' },
      { name: 'Bank Fees', type: 'expense', taxDeductible: true, irsCategory: 'Bank Charges' },
      { name: 'Business Insurance', type: 'expense', taxDeductible: true, irsCategory: 'Insurance' },
      { name: 'Contract Labor', type: 'expense', taxDeductible: true, irsCategory: 'Contract Labor' },
      { name: 'Depreciation', type: 'expense', taxDeductible: true, irsCategory: 'Depreciation' },
      { name: 'Dues & Subscriptions', type: 'expense', taxDeductible: true, irsCategory: 'Dues & Subscriptions' },
      { name: 'Equipment', type: 'expense', taxDeductible: true, irsCategory: 'Equipment' },
      { name: 'Interest Expense', type: 'expense', taxDeductible: true, irsCategory: 'Interest' },
      { name: 'Legal & Professional', type: 'expense', taxDeductible: true, irsCategory: 'Professional Services' },
      { name: 'Meals & Entertainment', type: 'expense', taxDeductible: true, irsCategory: 'Meals & Entertainment' },
      { name: 'Office Expense', type: 'expense', taxDeductible: true, irsCategory: 'Office Expense' },
      { name: 'Rent', type: 'expense', taxDeductible: true, irsCategory: 'Rent' },
      { name: 'Repairs & Maintenance', type: 'expense', taxDeductible: true, irsCategory: 'Repairs' },
      { name: 'Supplies', type: 'expense', taxDeductible: true, irsCategory: 'Supplies' },
      { name: 'Taxes & Licenses', type: 'expense', taxDeductible: true, irsCategory: 'Taxes & Licenses' },
      { name: 'Travel', type: 'expense', taxDeductible: true, irsCategory: 'Travel' },
      { name: 'Utilities', type: 'expense', taxDeductible: true, irsCategory: 'Utilities' },
      { name: 'Vehicle Expenses', type: 'expense', taxDeductible: true, irsCategory: 'Car & Truck' },
      { name: 'Wages & Payroll', type: 'expense', taxDeductible: true, irsCategory: 'Wages' },
    ],
  },
];

// IRS Schedule C categories for tax compliance
export const irsCategories = [
  'Gross Receipts',
  'Returns & Allowances',
  'COGS',
  'Advertising',
  'Car & Truck',
  'Commissions',
  'Contract Labor',
  'Depreciation',
  'Employee Benefits',
  'Insurance',
  'Interest',
  'Legal & Professional',
  'Office Expense',
  'Rent',
  'Rent - Equipment',
  'Repairs',
  'Supplies',
  'Taxes & Licenses',
  'Travel',
  'Meals & Entertainment',
  'Utilities',
  'Wages',
  'Other Expense',
  'Dues & Subscriptions',
  'Education',
  'Bank Charges',
  'Licenses & Permits',
  'Gifts',
  'Equipment',
  'Rents Received',
  'Other Income',
];
