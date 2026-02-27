export type IndustryKey =
  | 'real_estate'
  | 'construction'
  | 'healthcare'
  | 'consulting'
  | 'retail'
  | 'restaurant'
  | 'technology'
  | 'transportation'
  | 'creative'
  | 'legal'
  | 'accounting'
  | 'fitness'
  | 'photography'
  | 'other';

export interface IndustryCategoryDef {
  name: string;
  icon: string;
  color: string;
  is_tax_deductible: boolean;
}

export const INDUSTRY_CATEGORIES: Record<IndustryKey, IndustryCategoryDef[]> = {
  real_estate: [
    { name: 'MLS Fees', icon: '🏡', color: '#8B5CF6', is_tax_deductible: true },
    { name: 'Staging', icon: '🛋️', color: '#F59E0B', is_tax_deductible: true },
    { name: 'Property Showings', icon: '🏠', color: '#3B82F6', is_tax_deductible: true },
    { name: 'Client Gifts', icon: '🎁', color: '#EC4899', is_tax_deductible: true },
    { name: 'Open House Snacks', icon: '🍪', color: '#F97316', is_tax_deductible: true },
  ],
  construction: [
    { name: 'Materials', icon: '🧱', color: '#F59E0B', is_tax_deductible: true },
    { name: 'Equipment Rental', icon: '🏗️', color: '#10B981', is_tax_deductible: true },
    { name: 'Permits', icon: '📄', color: '#6366F1', is_tax_deductible: true },
  ],
  healthcare: [
    { name: 'Medical Supplies', icon: '🧪', color: '#10B981', is_tax_deductible: true },
    { name: 'Continuing Education', icon: '🎓', color: '#8B5CF6', is_tax_deductible: true },
  ],
  consulting: [
    { name: 'Software Subscriptions', icon: '💻', color: '#3B82F6', is_tax_deductible: true },
    { name: 'Client Meals', icon: '🍽️', color: '#EF4444', is_tax_deductible: true },
  ],
  retail: [
    { name: 'Inventory', icon: '📦', color: '#F59E0B', is_tax_deductible: true },
    { name: 'Packaging', icon: '📦', color: '#64748B', is_tax_deductible: true },
  ],
  restaurant: [
    { name: 'Food Supplies', icon: '🥦', color: '#10B981', is_tax_deductible: true },
    { name: 'Kitchen Equipment', icon: '🍳', color: '#F97316', is_tax_deductible: true },
  ],
  technology: [
    { name: 'Cloud Services', icon: '☁️', color: '#3B82F6', is_tax_deductible: true },
    { name: 'Devices', icon: '📱', color: '#8B5CF6', is_tax_deductible: true },
  ],
  transportation: [
    { name: 'Vehicle Maintenance', icon: '🛠️', color: '#10B981', is_tax_deductible: true },
    { name: 'Fuel', icon: '⛽', color: '#F59E0B', is_tax_deductible: true },
  ],
  creative: [
    { name: 'Studio Rental', icon: '🏢', color: '#6366F1', is_tax_deductible: true },
    { name: 'Props & Materials', icon: '🎨', color: '#F97316', is_tax_deductible: true },
  ],
  legal: [
    { name: 'Bar Dues', icon: '⚖️', color: '#8B5CF6', is_tax_deductible: true },
    { name: 'Research Tools', icon: '📚', color: '#64748B', is_tax_deductible: true },
  ],
  accounting: [
    { name: 'Software', icon: '🧮', color: '#3B82F6', is_tax_deductible: true },
    { name: 'Professional Development', icon: '🎓', color: '#8B5CF6', is_tax_deductible: true },
  ],
  fitness: [
    { name: 'Equipment', icon: '🏋️', color: '#10B981', is_tax_deductible: true },
    { name: 'Supplements', icon: '💊', color: '#F59E0B', is_tax_deductible: true },
  ],
  photography: [
    { name: 'Camera Gear', icon: '📷', color: '#3B82F6', is_tax_deductible: true },
    { name: 'Editing Software', icon: '🖥️', color: '#8B5CF6', is_tax_deductible: true },
  ],
  other: [],
};
