// Learning Detection Library
// Detects user corrections and builds learning suggestions

export type CorrectionType = 'vendor_category' | 'vendor_business' | 'item_category' | 'item_business';

export interface CorrectionContext {
  type: CorrectionType;
  vendor?: string;
  itemName?: string;
  oldCategoryId?: string | null;
  newCategoryId?: string | null;
  oldCategoryName?: string | null;
  newCategoryName?: string | null;
  oldIsBusiness?: boolean;
  newIsBusiness?: boolean;
}

export interface LearningSuggestion {
  shouldPrompt: boolean;
  ruleType: 'merchant' | 'item';
  existingRuleId?: string;
  suggestedPattern: string;
  suggestedMatchType: 'exact' | 'contains' | 'starts_with';
  newCategoryId?: string | null;
  newCategoryName?: string | null;
  newIsBusiness?: boolean;
  correctionType: CorrectionType;
  displayMessage: string;
}

export interface OriginalExpenseValues {
  category_id?: string | null;
  is_business?: boolean;
  vendor?: string | null;
}

export interface UpdatedExpenseValues {
  category_id?: string | null;
  is_business?: boolean;
  vendor?: string | null;
}

// Detect if an edit represents a meaningful correction
export function detectCorrection(
  original: OriginalExpenseValues,
  updated: UpdatedExpenseValues,
  categories?: { id: string; name: string }[]
): CorrectionContext | null {
  // Must have a vendor to create a rule
  const vendor = updated.vendor?.trim();
  if (!vendor) return null;

  // Check for category change
  if (original.category_id !== updated.category_id && updated.category_id) {
    const oldCategory = categories?.find(c => c.id === original.category_id);
    const newCategory = categories?.find(c => c.id === updated.category_id);

    return {
      type: 'vendor_category',
      vendor,
      oldCategoryId: original.category_id,
      newCategoryId: updated.category_id,
      oldCategoryName: oldCategory?.name || null,
      newCategoryName: newCategory?.name || null,
    };
  }

  // Check for business/personal change
  if (original.is_business !== updated.is_business) {
    return {
      type: 'vendor_business',
      vendor,
      oldIsBusiness: original.is_business,
      newIsBusiness: updated.is_business,
    };
  }

  return null;
}

// Detect correction for a line item
export function detectItemCorrection(
  itemName: string,
  vendor: string | undefined,
  oldCategoryId: string | null | undefined,
  newCategoryId: string | null | undefined,
  oldIsBusiness: boolean | undefined,
  newIsBusiness: boolean | undefined,
  categories?: { id: string; name: string }[]
): CorrectionContext | null {
  if (!itemName?.trim()) return null;

  // Check for category change
  if (oldCategoryId !== newCategoryId && newCategoryId) {
    const oldCategory = categories?.find(c => c.id === oldCategoryId);
    const newCategory = categories?.find(c => c.id === newCategoryId);

    return {
      type: 'item_category',
      itemName: itemName.trim(),
      vendor: vendor?.trim(),
      oldCategoryId,
      newCategoryId,
      oldCategoryName: oldCategory?.name || null,
      newCategoryName: newCategory?.name || null,
    };
  }

  // Check for business/personal change
  if (oldIsBusiness !== newIsBusiness && newIsBusiness !== undefined) {
    return {
      type: 'item_business',
      itemName: itemName.trim(),
      vendor: vendor?.trim(),
      oldIsBusiness,
      newIsBusiness,
    };
  }

  return null;
}

// Build a learning suggestion from a correction context
export function buildLearningSuggestion(
  correction: CorrectionContext,
  existingRuleId?: string
): LearningSuggestion {
  const isItemCorrection = correction.type === 'item_category' || correction.type === 'item_business';
  const pattern = isItemCorrection
    ? correction.itemName?.toLowerCase() || ''
    : correction.vendor?.toLowerCase() || '';

  // Determine suggested match type based on pattern
  let suggestedMatchType: 'exact' | 'contains' | 'starts_with' = 'contains';

  // For short patterns (single word), use exact
  if (pattern.split(/\s+/).length === 1 && pattern.length <= 15) {
    suggestedMatchType = 'exact';
  }
  // For longer patterns, use contains
  else if (pattern.length > 20) {
    suggestedMatchType = 'contains';
  }

  // Build display message
  let displayMessage = '';
  if (correction.type === 'vendor_category') {
    displayMessage = `You categorized "${correction.vendor}" as "${correction.newCategoryName}".`;
  } else if (correction.type === 'vendor_business') {
    const status = correction.newIsBusiness ? 'Business' : 'Personal';
    displayMessage = `You marked "${correction.vendor}" as ${status}.`;
  } else if (correction.type === 'item_category') {
    displayMessage = `You categorized "${correction.itemName}" as "${correction.newCategoryName}".`;
  } else if (correction.type === 'item_business') {
    const status = correction.newIsBusiness ? 'Business' : 'Personal';
    displayMessage = `You marked "${correction.itemName}" as ${status}.`;
  }

  return {
    shouldPrompt: true,
    ruleType: isItemCorrection ? 'item' : 'merchant',
    existingRuleId,
    suggestedPattern: pattern,
    suggestedMatchType,
    newCategoryId: correction.newCategoryId,
    newCategoryName: correction.newCategoryName,
    newIsBusiness: correction.newIsBusiness,
    correctionType: correction.type,
    displayMessage,
  };
}

// Check if a merchant rule already exists for this pattern
export async function checkExistingMerchantRule(
  userId: string,
  pattern: string
): Promise<{ exists: boolean; ruleId?: string }> {
  try {
    const res = await fetch(
      `/api/merchant-rules/match?user_id=${userId}&pattern=${encodeURIComponent(pattern)}`
    );
    const data = await res.json();

    if (data.success) {
      return { exists: data.exists, ruleId: data.ruleId };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

// Check if an item rule already exists for this pattern
export async function checkExistingItemRule(
  userId: string,
  pattern: string
): Promise<{ exists: boolean; ruleId?: string }> {
  try {
    const res = await fetch(
      `/api/item-rules/match?user_id=${userId}&pattern=${encodeURIComponent(pattern)}`
    );
    const data = await res.json();

    if (data.success) {
      return { exists: data.exists, ruleId: data.ruleId };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

// Create a merchant rule from a learning suggestion
export async function createMerchantRule(
  userId: string,
  suggestion: LearningSuggestion,
  vendor: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/merchant-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        merchant_pattern: suggestion.suggestedPattern,
        match_type: suggestion.suggestedMatchType,
        category_id: suggestion.newCategoryId,
        is_business: suggestion.newIsBusiness ?? true,
        vendor_display_name: vendor,
        auto_created: true,
      }),
    });

    const data = await res.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Create an item rule from a learning suggestion
export async function createItemRule(
  userId: string,
  suggestion: LearningSuggestion,
  vendorPattern?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/item-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        item_pattern: suggestion.suggestedPattern,
        match_type: suggestion.suggestedMatchType,
        category_id: suggestion.newCategoryId,
        is_business: suggestion.newIsBusiness ?? true,
        vendor_pattern: vendorPattern?.toLowerCase() || null,
        auto_created: true,
      }),
    });

    const data = await res.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Storage key for "don't ask again" preferences
const LEARNING_PREFS_KEY = 'expense_learning_prefs';

interface LearningPrefs {
  disabledVendors: string[];
  disabledItems: string[];
  globallyDisabled: boolean;
}

// Get learning preferences from localStorage
export function getLearningPrefs(): LearningPrefs {
  if (typeof window === 'undefined') {
    return { disabledVendors: [], disabledItems: [], globallyDisabled: false };
  }

  try {
    const stored = localStorage.getItem(LEARNING_PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}

  return { disabledVendors: [], disabledItems: [], globallyDisabled: false };
}

// Save learning preferences to localStorage
export function saveLearningPrefs(prefs: LearningPrefs): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LEARNING_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

// Check if learning prompt should be shown for this vendor/item
export function shouldShowLearningPrompt(
  pattern: string,
  type: 'vendor' | 'item'
): boolean {
  const prefs = getLearningPrefs();

  if (prefs.globallyDisabled) return false;

  const normalizedPattern = pattern.toLowerCase().trim();

  if (type === 'vendor') {
    return !prefs.disabledVendors.includes(normalizedPattern);
  } else {
    return !prefs.disabledItems.includes(normalizedPattern);
  }
}

// Disable learning prompts for a specific vendor/item
export function disableLearningFor(pattern: string, type: 'vendor' | 'item'): void {
  const prefs = getLearningPrefs();
  const normalizedPattern = pattern.toLowerCase().trim();

  if (type === 'vendor') {
    if (!prefs.disabledVendors.includes(normalizedPattern)) {
      prefs.disabledVendors.push(normalizedPattern);
    }
  } else {
    if (!prefs.disabledItems.includes(normalizedPattern)) {
      prefs.disabledItems.push(normalizedPattern);
    }
  }

  saveLearningPrefs(prefs);
}
