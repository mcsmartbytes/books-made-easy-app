import { supabase } from '@/utils/supabase';

// Types
export interface MerchantRule {
  id: string;
  user_id: string;
  merchant_pattern: string;
  match_type: 'exact' | 'contains' | 'starts_with';
  category_id: string | null;
  is_business: boolean;
  vendor_display_name: string | null;
  priority: number;
  is_active: boolean;
  auto_created: boolean;
  match_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  categories?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
}

export interface MerchantRuleMatch {
  rule: MerchantRule;
  category_id: string | null;
  category_name?: string;
  is_business: boolean;
  vendor_display_name: string | null;
}

export interface CreateRuleInput {
  user_id: string;
  merchant_pattern: string;
  match_type?: 'exact' | 'contains' | 'starts_with';
  category_id?: string | null;
  is_business?: boolean;
  vendor_display_name?: string | null;
  priority?: number;
  auto_created?: boolean;
}

// Pattern matching logic
function matchesPattern(
  vendor: string,
  pattern: string,
  matchType: 'exact' | 'contains' | 'starts_with'
): boolean {
  const normalizedVendor = vendor.toLowerCase().trim();
  const normalizedPattern = pattern.toLowerCase().trim();

  switch (matchType) {
    case 'exact':
      return normalizedVendor === normalizedPattern;
    case 'starts_with':
      return normalizedVendor.startsWith(normalizedPattern);
    case 'contains':
    default:
      return normalizedVendor.includes(normalizedPattern);
  }
}

// Find a matching rule for a vendor
export async function findMatchingRule(
  userId: string,
  vendor: string
): Promise<MerchantRuleMatch | null> {
  if (!vendor || !vendor.trim()) {
    return null;
  }

  const { data: rules, error } = await supabase
    .from('merchant_rules')
    .select(`
      *,
      categories (
        id,
        name,
        icon,
        color
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('match_count', { ascending: false });

  if (error || !rules) {
    console.error('Error fetching merchant rules:', error);
    return null;
  }

  // Find first matching rule (rules are already sorted by priority)
  for (const rule of rules as MerchantRule[]) {
    if (matchesPattern(vendor, rule.merchant_pattern, rule.match_type)) {
      return {
        rule,
        category_id: rule.category_id,
        category_name: rule.categories?.name,
        is_business: rule.is_business,
        vendor_display_name: rule.vendor_display_name,
      };
    }
  }

  return null;
}

// Get all rules for a user
export async function getUserRules(userId: string): Promise<MerchantRule[]> {
  const { data, error } = await supabase
    .from('merchant_rules')
    .select(`
      *,
      categories (
        id,
        name,
        icon,
        color
      )
    `)
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user rules:', error);
    return [];
  }

  return data as MerchantRule[];
}

// Create a new rule
export async function createRule(input: CreateRuleInput): Promise<MerchantRule | null> {
  const { data, error } = await supabase
    .from('merchant_rules')
    .insert({
      user_id: input.user_id,
      merchant_pattern: input.merchant_pattern,
      match_type: input.match_type || 'contains',
      category_id: input.category_id || null,
      is_business: input.is_business ?? true,
      vendor_display_name: input.vendor_display_name || null,
      priority: input.priority || 0,
      auto_created: input.auto_created || false,
    })
    .select(`
      *,
      categories (
        id,
        name,
        icon,
        color
      )
    `)
    .single();

  if (error) {
    console.error('Error creating merchant rule:', error);
    return null;
  }

  return data as MerchantRule;
}

// Update an existing rule
export async function updateRule(
  ruleId: string,
  updates: Partial<Omit<MerchantRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<MerchantRule | null> {
  const { data, error } = await supabase
    .from('merchant_rules')
    .update(updates)
    .eq('id', ruleId)
    .select(`
      *,
      categories (
        id,
        name,
        icon,
        color
      )
    `)
    .single();

  if (error) {
    console.error('Error updating merchant rule:', error);
    return null;
  }

  return data as MerchantRule;
}

// Delete a rule
export async function deleteRule(ruleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('merchant_rules')
    .delete()
    .eq('id', ruleId);

  if (error) {
    console.error('Error deleting merchant rule:', error);
    return false;
  }

  return true;
}

// Increment match count (call this when a rule is applied)
export async function incrementMatchCount(ruleId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_rule_match_count', {
    rule_id: ruleId,
  });

  if (error) {
    console.error('Error incrementing match count:', error);
  }
}

// Check if a rule already exists for a vendor pattern
export async function ruleExistsForPattern(
  userId: string,
  merchantPattern: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('merchant_rules')
    .select('id')
    .eq('user_id', userId)
    .ilike('merchant_pattern', merchantPattern)
    .limit(1);

  if (error) {
    console.error('Error checking for existing rule:', error);
    return false;
  }

  return data && data.length > 0;
}

// Create a rule from an expense (for auto-learning)
export async function createRuleFromExpense(
  userId: string,
  vendor: string,
  categoryId: string,
  isBusiness: boolean
): Promise<MerchantRule | null> {
  // Check if rule already exists
  const exists = await ruleExistsForPattern(userId, vendor);
  if (exists) {
    return null;
  }

  return createRule({
    user_id: userId,
    merchant_pattern: vendor,
    match_type: 'contains',
    category_id: categoryId,
    is_business: isBusiness,
    vendor_display_name: vendor,
    auto_created: true,
  });
}

// Normalize vendor name for display
export function normalizeVendorName(vendor: string): string {
  if (!vendor) return '';

  // Remove common prefixes/suffixes
  let normalized = vendor
    .replace(/^(SQ\s*\*|TST\s*\*|PAYPAL\s*\*|AMZN\s*)/i, '')
    .replace(/\s*#\d+$/i, '')
    .replace(/\s+\d{4,}$/i, '')
    .trim();

  // Title case
  normalized = normalized
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return normalized;
}
