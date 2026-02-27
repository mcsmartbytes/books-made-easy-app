'use client';

import { useState } from 'react';
import {
  LearningSuggestion,
  createMerchantRule,
  createItemRule,
  disableLearningFor,
} from '@/lib/learningDetection';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface LearningPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  suggestion: LearningSuggestion;
  categories: Category[];
  vendor?: string;
  itemName?: string;
  userId: string;
}

export default function LearningPromptModal({
  isOpen,
  onClose,
  onSuccess,
  suggestion,
  categories,
  vendor,
  itemName,
  userId,
}: LearningPromptModalProps) {
  const [pattern, setPattern] = useState(suggestion.suggestedPattern);
  const [matchType, setMatchType] = useState<'exact' | 'contains' | 'starts_with'>(
    suggestion.suggestedMatchType
  );
  const [categoryId, setCategoryId] = useState(suggestion.newCategoryId || '');
  const [isBusiness, setIsBusiness] = useState(suggestion.newIsBusiness ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isItemRule = suggestion.ruleType === 'item';
  const patternLabel = isItemRule ? 'Item' : 'Vendor';

  async function handleSaveRule() {
    setSaving(true);
    setError(null);

    try {
      const modifiedSuggestion: LearningSuggestion = {
        ...suggestion,
        suggestedPattern: pattern,
        suggestedMatchType: matchType,
        newCategoryId: categoryId || null,
        newIsBusiness: isBusiness,
      };

      let result;
      if (isItemRule) {
        result = await createItemRule(userId, modifiedSuggestion, vendor);
      } else {
        result = await createMerchantRule(userId, modifiedSuggestion, vendor || pattern);
      }

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'Failed to create rule');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  function handleNeverAsk() {
    const targetPattern = isItemRule ? (itemName || pattern) : (vendor || pattern);
    disableLearningFor(targetPattern, isItemRule ? 'item' : 'vendor');
    onClose();
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Learn This Pattern?</h2>
                <p className="text-sm text-gray-500">Save time on future entries</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Message */}
          <div className="mb-5 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">{suggestion.displayMessage}</p>
            <p className="text-sm text-gray-500 mt-1">
              Would you like to apply this automatically next time?
            </p>
          </div>

          {/* Rule Configuration */}
          <div className="space-y-4">
            {/* Pattern */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {patternLabel} Pattern
              </label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder={`Enter ${patternLabel.toLowerCase()} pattern...`}
              />
            </div>

            {/* Match Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Type
              </label>
              <select
                value={matchType}
                onChange={(e) =>
                  setMatchType(e.target.value as 'exact' | 'contains' | 'starts_with')
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="exact">Exact match</option>
                <option value="contains">Contains</option>
                <option value="starts_with">Starts with</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {matchType === 'exact' && 'Only matches if the text is exactly the same'}
                {matchType === 'contains' && 'Matches if the text appears anywhere'}
                {matchType === 'starts_with' && 'Matches if the text starts with this pattern'}
              </p>
            </div>

            {/* Category */}
            {(suggestion.correctionType === 'vendor_category' ||
              suggestion.correctionType === 'item_category') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Business/Personal Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Mark as Business</span>
              <button
                type="button"
                onClick={() => setIsBusiness(!isBusiness)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isBusiness ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isBusiness ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Preview */}
            <div className="p-3 border border-dashed border-gray-300 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-1">RULE PREVIEW</p>
              <p className="text-sm text-gray-700">
                When {patternLabel.toLowerCase()}{' '}
                <span className="font-mono bg-gray-100 px-1 rounded">
                  {matchType === 'exact' ? '=' : matchType === 'starts_with' ? 'starts with' : 'contains'}{' '}
                  &quot;{pattern}&quot;
                </span>
              </p>
              <p className="text-sm text-gray-700">
                → Set category to{' '}
                <span className="font-medium">
                  {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : '(none)'}
                </span>
                {' '}and mark as{' '}
                <span className={`font-medium ${isBusiness ? 'text-blue-600' : 'text-gray-600'}`}>
                  {isBusiness ? 'Business' : 'Personal'}
                </span>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Not Now
              </button>
              <button
                onClick={handleSaveRule}
                disabled={saving || !pattern.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Rule'
                )}
              </button>
            </div>
            <button
              onClick={handleNeverAsk}
              disabled={saving}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Don&apos;t ask again for this {isItemRule ? 'item' : 'vendor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
