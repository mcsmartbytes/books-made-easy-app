'use client';

import { useState, useEffect } from 'react';
import { LineItem, formatPrice, formatQuantity, detectPriceChange } from '@/lib/lineItems';
import { ItemMemory, MemorySuggestion } from '@/lib/moneyMemory';

interface PriceAlert {
  item_name: string;
  current_price: number;
  previous_price: number;
  change_pct: number;
  previous_date: string;
  previous_vendor?: string;
}

interface MemoryData {
  memories: Record<string, ItemMemory>;
  suggestions: MemorySuggestion[];
}

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  userId: string;
  vendor?: string;
  readOnly?: boolean;
}

export default function LineItemsEditor({
  items,
  onChange,
  userId,
  vendor,
  readOnly = false,
}: LineItemsEditorProps) {
  const [priceAlerts, setPriceAlerts] = useState<Map<string, PriceAlert>>(new Map());
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [showMemoryTips, setShowMemoryTips] = useState(true);

  // Fetch price history for items to check for price changes and memory suggestions
  useEffect(() => {
    async function checkPriceHistory() {
      if (items.length === 0 || !userId) return;

      setLoadingPrices(true);
      try {
        const alerts = new Map<string, PriceAlert>();

        // Fetch price history for all items
        const res = await fetch(`/api/price-history?user_id=${userId}&mode=history&limit=500`);
        const data = await res.json();

        if (data.success && data.data) {
          const historyByItem = new Map<string, any[]>();
          for (const entry of data.data) {
            const key = entry.item_name_normalized;
            if (!historyByItem.has(key)) {
              historyByItem.set(key, []);
            }
            historyByItem.get(key)!.push(entry);
          }

          // Check each item for price changes
          for (const item of items) {
            const normalized = item.item_name_normalized || item.item_name.toLowerCase().trim();
            const history = historyByItem.get(normalized) || [];

            if (history.length > 0) {
              // Sort by date descending
              history.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
              const previousPrice = history[0].unit_price;
              const change = detectPriceChange(item.unit_price, previousPrice, 0.05);

              if (change.changed) {
                alerts.set(item.item_name, {
                  item_name: item.item_name,
                  current_price: item.unit_price,
                  previous_price: previousPrice,
                  change_pct: change.pct,
                  previous_date: history[0].purchase_date,
                  previous_vendor: history[0].vendor,
                });
              }
            }
          }
        }

        setPriceAlerts(alerts);

        // Fetch memory suggestions for items
        const itemNames = items
          .filter(item => item.item_name.trim())
          .map(item => item.item_name)
          .join(',');

        if (itemNames) {
          const memoryParams = new URLSearchParams({
            user_id: userId,
            items: itemNames,
          });
          if (vendor) memoryParams.set('vendor', vendor);

          const memoryRes = await fetch(`/api/memory-suggestions?${memoryParams}`);
          const memoryResult = await memoryRes.json();

          if (memoryResult.success) {
            setMemoryData({
              memories: memoryResult.memories || {},
              suggestions: memoryResult.suggestions || [],
            });
          }
        }
      } catch (error) {
        console.error('Error checking price history:', error);
      } finally {
        setLoadingPrices(false);
      }
    }

    checkPriceHistory();
  }, [items, userId, vendor]);

  const handleItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'quantity' || field === 'unit_price') {
      const numValue = parseFloat(value as string) || 0;
      item[field] = numValue;
      // Recalculate line total
      item.line_total = Math.round(item.quantity * item.unit_price * 100) / 100;
    } else if (field === 'item_name') {
      item.item_name = value as string;
      item.item_name_normalized = (value as string).toLowerCase().trim();
    } else {
      (item as any)[field] = value;
    }

    updated[index] = item;
    onChange(updated);
  };

  const handleAddItem = () => {
    const newItem: LineItem = {
      item_name: '',
      item_name_normalized: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      unit_of_measure: 'each',
      is_taxable: true,
      sort_order: items.length,
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    // Update sort orders
    updated.forEach((item, i) => {
      item.sort_order = i;
    });
    onChange(updated);
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

  if (items.length === 0 && readOnly) {
    return null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Line Items ({items.length})
          {loadingPrices && (
            <span className="text-xs text-gray-500 animate-pulse">Checking prices...</span>
          )}
        </h3>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAddItem}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        )}
      </div>

      {/* Price Alerts Summary */}
      {priceAlerts.size > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">
                Price changes detected on {priceAlerts.size} item{priceAlerts.size > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Prices differ from your last purchase. See highlights below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Money Memory Suggestions */}
      {showMemoryTips && memoryData && memoryData.suggestions.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <span className="text-lg flex-shrink-0">💡</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-800">
                  Money Memory Tips
                </p>
                <div className="mt-2 space-y-1.5">
                  {memoryData.suggestions.slice(0, 3).map((suggestion, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1.5 rounded ${
                        suggestion.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : suggestion.priority === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-white text-gray-600'
                      }`}
                    >
                      {suggestion.type === 'savings_tip' && '💵 '}
                      {suggestion.type === 'price_alert' && '📈 '}
                      {suggestion.type === 'vendor_suggestion' && '🏪 '}
                      {suggestion.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowMemoryTips(false)}
              className="p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
              title="Dismiss tips"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium w-20">Qty</th>
              <th className="px-3 py-2 text-left font-medium w-20">Unit</th>
              <th className="px-3 py-2 text-right font-medium w-24">Price</th>
              <th className="px-3 py-2 text-right font-medium w-24">Total</th>
              {!readOnly && <th className="px-3 py-2 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, index) => {
              const alert = priceAlerts.get(item.item_name);
              const hasAlert = !!alert;

              return (
                <tr key={index} className={hasAlert ? 'bg-amber-50' : 'bg-white'}>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-gray-900">{item.item_name}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.item_name}
                        onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                        className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-purple-500 text-sm"
                        placeholder="Item name"
                      />
                    )}
                    {hasAlert && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`text-xs font-medium ${alert.change_pct > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {alert.change_pct > 0 ? '↑' : '↓'} {Math.abs(alert.change_pct).toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          vs {formatPrice(alert.previous_price)} on {new Date(alert.previous_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {readOnly ? (
                      <span className="text-gray-900">{formatQuantity(item.quantity)}</span>
                    ) : (
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-purple-500 text-sm text-right"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-gray-500">{item.unit_of_measure || 'ea'}</span>
                    ) : (
                      <select
                        value={item.unit_of_measure || 'each'}
                        onChange={(e) => handleItemChange(index, 'unit_of_measure', e.target.value)}
                        className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-purple-500 text-sm"
                      >
                        <option value="each">each</option>
                        <option value="lb">lb</option>
                        <option value="oz">oz</option>
                        <option value="gal">gal</option>
                        <option value="L">L</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="pack">pack</option>
                        <option value="box">box</option>
                        <option value="case">case</option>
                        <option value="dozen">dozen</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {readOnly ? (
                      <span className={`${hasAlert && alert.change_pct > 0 ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        {formatPrice(item.unit_price)}
                      </span>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className={`w-full pl-6 pr-2 py-1 border rounded focus:ring-2 focus:ring-purple-500 text-sm text-right ${
                            hasAlert && alert.change_pct > 0 ? 'border-red-300 bg-red-50' : ''
                          }`}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    {formatPrice(item.line_total)}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-500 hover:text-red-700"
                        title="Remove item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 font-medium">
            <tr>
              <td colSpan={readOnly ? 4 : 5} className="px-3 py-2 text-right">
                Items Total:
              </td>
              <td className="px-3 py-2 text-right text-purple-700">
                {formatPrice(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {items.length === 0 && !readOnly && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">No line items yet.</p>
          <button
            type="button"
            onClick={handleAddItem}
            className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            + Add your first item
          </button>
        </div>
      )}
    </div>
  );
}
