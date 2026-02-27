'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { expensesSupabase } from '@/utils/expensesSupabase';

interface PriceTrend {
  item_name: string;
  item_name_normalized: string;
  current_price: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  price_change_30d: number;
  price_change_90d: number;
  purchase_count: number;
  last_purchase: string;
  vendors: string[];
}

interface PriceAlert {
  item_name: string;
  vendor: string;
  current_price: number;
  previous_price: number;
  change_pct: number;
  purchase_date: string;
  severity: 'info' | 'warning' | 'alert';
}

interface PriceHistoryEntry {
  id: string;
  item_name_normalized: string;
  vendor: string;
  unit_price: number;
  quantity: number;
  unit_of_measure: string;
  purchase_date: string;
}

interface VendorPriceData {
  vendor: string;
  vendor_normalized: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  purchase_count: number;
  last_purchase: string;
  total_spent: number;
}

interface ItemVendorComparison {
  item_name: string;
  item_name_normalized: string;
  vendors: VendorPriceData[];
  best_vendor: VendorPriceData | null;
  worst_vendor: VendorPriceData | null;
  price_spread: number;
  price_spread_pct: number;
  total_purchases: number;
}

interface SavingsOpportunity {
  item_name: string;
  item_name_normalized: string;
  total_spent: number;
  optimal_spend: number;
  overpaid_amount: number;
  overpaid_pct: number;
  best_vendor: string;
  best_price: number;
  worst_vendor: string;
  worst_price: number;
  recommendation: string;
}

interface VendorRanking {
  vendor: string;
  vendor_normalized: string;
  items_with_best_price: number;
  items_with_worst_price: number;
  total_items_tracked: number;
  avg_price_rank: number;
  potential_savings_if_switched: number;
  total_purchases: number;
}

interface SavingsSummary {
  total_overpaid_ytd: number;
  potential_annual_savings: number;
  top_opportunities: SavingsOpportunity[];
}

type TabType = 'overview' | 'vendors' | 'savings';

export default function PriceTrackerPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [trends, setTrends] = useState<PriceTrend[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [biggestIncreases, setBiggestIncreases] = useState<PriceTrend[]>([]);
  const [frequentItems, setFrequentItems] = useState<PriceTrend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemHistory, setItemHistory] = useState<PriceHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Vendor comparison state
  const [vendorComparisons, setVendorComparisons] = useState<ItemVendorComparison[]>([]);
  const [vendorRankings, setVendorRankings] = useState<VendorRanking[]>([]);
  const [savingsSummary, setSavingsSummary] = useState<SavingsSummary | null>(null);
  const [vendorDataLoaded, setVendorDataLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view price tracking.');
        setLoading(false);
        return;
      }

      // Load trends
      const trendsRes = await fetch(`/api/expenses/price-history?user_id=${user.id}&mode=trends`);
      const trendsData = await trendsRes.json();

      if (trendsData.success) {
        setTrends(trendsData.data.trends || []);
        setBiggestIncreases(trendsData.data.biggest_increases || []);
        setFrequentItems(trendsData.data.frequent_items || []);
      }

      // Load alerts
      const alertsRes = await fetch(`/api/expenses/price-history?user_id=${user.id}&mode=alerts`);
      const alertsData = await alertsRes.json();

      if (alertsData.success) {
        setAlerts(alertsData.data || []);
      }
    } catch (err) {
      console.error('Error loading price data:', err);
      setError('Failed to load price tracking data.');
    } finally {
      setLoading(false);
    }
  }

  async function loadVendorData() {
    if (vendorDataLoaded) return;

    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) return;

      const res = await fetch(`/api/expenses/price-history?user_id=${user.id}&mode=vendor-comparison`);
      const data = await res.json();

      if (data.success) {
        setVendorComparisons(data.data.items || []);
        setVendorRankings(data.data.vendor_rankings || []);
        setSavingsSummary(data.data.savings_summary || null);
        setVendorDataLoaded(true);
      }
    } catch (err) {
      console.error('Error loading vendor data:', err);
    }
  }

  // Load vendor data when switching to those tabs
  useEffect(() => {
    if ((activeTab === 'vendors' || activeTab === 'savings') && !vendorDataLoaded) {
      loadVendorData();
    }
  }, [activeTab, vendorDataLoaded]);

  async function loadItemHistory(itemName: string) {
    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) return;

      const res = await fetch(`/api/expenses/price-history?user_id=${user.id}&item_name=${encodeURIComponent(itemName)}&mode=history`);
      const data = await res.json();

      if (data.success) {
        setItemHistory(data.data || []);
        setSelectedItem(itemName);
      }
    } catch (err) {
      console.error('Error loading item history:', err);
    }
  }

  function formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }

  function formatChange(pct: number): { text: string; color: string } {
    const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
    const color = pct > 5 ? 'text-red-600' : pct < -5 ? 'text-green-600' : 'text-gray-500';
    return { text: `${arrow} ${Math.abs(pct).toFixed(1)}%`, color };
  }

  const filteredTrends = searchQuery
    ? trends.filter(t =>
        t.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.vendors.some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : trends;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-red-500">{error}</p>
          <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Tracker</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track item prices over time from your receipts
          </p>
        </div>
        <div className="w-full md:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items or vendors..."
            className="w-full md:w-64 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
            activeTab === 'overview'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
            activeTab === 'vendors'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          Vendor Comparison
        </button>
        <button
          onClick={() => setActiveTab('savings')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
            activeTab === 'savings'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          Savings
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase">Items Tracked</p>
              <p className="mt-2 text-3xl font-bold text-blue-600">{trends.length}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase">Price Increases</p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {alerts.filter(a => a.change_pct > 0).length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase">Price Decreases</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {alerts.filter(a => a.change_pct < 0).length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Savings found</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase">Frequent Purchases</p>
              <p className="mt-2 text-3xl font-bold text-purple-600">{frequentItems.length}</p>
              <p className="text-xs text-gray-500 mt-1">3+ times</p>
            </div>
          </div>

          {/* Price Alerts */}
          {alerts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-lg font-semibold text-amber-900 mb-3">Recent Price Changes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {alerts.slice(0, 6).map((alert, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 ${
                      alert.change_pct > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                    }`}
                  >
                    <p className="font-medium text-gray-900 text-sm truncate">{alert.item_name}</p>
                    <p className="text-xs text-gray-500">{alert.vendor}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-600">
                        {formatPrice(alert.previous_price)} → {formatPrice(alert.current_price)}
                      </span>
                      <span className={alert.change_pct > 0 ? 'text-red-600' : 'text-green-600'}>
                        {alert.change_pct > 0 ? '↑' : '↓'} {Math.abs(alert.change_pct).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Biggest Increases */}
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-red-500">↑</span> Biggest Price Increases
                </h2>
              </div>
              {biggestIncreases.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No price increases detected</div>
              ) : (
                <div className="divide-y">
                  {biggestIncreases.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadItemHistory(item.item_name_normalized)}
                      className="w-full p-3 hover:bg-gray-50 transition text-left"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-900 truncate">{item.item_name}</span>
                        <span className="text-red-600 text-sm">
                          +{item.price_change_30d.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatPrice(item.current_price)} • {item.purchase_count} purchases
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Frequently Purchased */}
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-purple-500">★</span> Frequently Purchased
                </h2>
              </div>
              {frequentItems.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Not enough purchase history yet</div>
              ) : (
                <div className="divide-y">
                  {frequentItems.slice(0, 5).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadItemHistory(item.item_name_normalized)}
                      className="w-full p-3 hover:bg-gray-50 transition text-left"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-900 truncate">{item.item_name}</span>
                        <span className="text-purple-600 text-sm">{item.purchase_count}x</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Avg: {formatPrice(item.avg_price)} • Range: {formatPrice(item.min_price)}-{formatPrice(item.max_price)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Item Detail / Search Results */}
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-900">
                  {selectedItem ? 'Price History' : 'All Items'}
                </h2>
              </div>
              {selectedItem ? (
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-gray-900">{selectedItem}</h3>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ← Back
                    </button>
                  </div>
                  {itemHistory.length === 0 ? (
                    <p className="text-sm text-gray-500">No history found</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {itemHistory.map((entry, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div>
                            <p className="text-gray-900">{formatPrice(entry.unit_price)}</p>
                            <p className="text-xs text-gray-500">{entry.vendor}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-600">{entry.quantity} {entry.unit_of_measure}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(entry.purchase_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : filteredTrends.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {searchQuery ? 'No items match your search' : 'No items tracked yet. Scan receipts to start tracking!'}
                </div>
              ) : (
                <div className="divide-y max-h-80 overflow-y-auto">
                  {filteredTrends.slice(0, 10).map((item, idx) => {
                    const change = formatChange(item.price_change_30d);
                    return (
                      <button
                        key={idx}
                        onClick={() => loadItemHistory(item.item_name_normalized)}
                        className="w-full p-3 hover:bg-gray-50 transition text-left"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-900 truncate">{item.item_name}</span>
                          <span className={`text-sm ${change.color}`}>{change.text}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatPrice(item.current_price)} • Last: {new Date(item.last_purchase).toLocaleDateString()}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Vendor Comparison Tab */}
      {activeTab === 'vendors' && (
        <>
          {/* Vendor Rankings */}
          {vendorRankings.length > 0 && (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Rankings</h3>
              <p className="text-sm text-gray-500 mb-4">Based on average prices across all items you&apos;ve purchased</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendorRankings.slice(0, 6).map((vendor, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-4 border ${
                      idx === 0
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{vendor.vendor}</span>
                      {idx === 0 && (
                        <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">
                          Best Value
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Best prices on:</span>
                        <span className="text-green-600">{vendor.items_with_best_price} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Highest prices on:</span>
                        <span className="text-red-600">{vendor.items_with_worst_price} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total purchases:</span>
                        <span className="text-gray-600">{vendor.total_purchases}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Item-by-Item Comparison */}
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">Price Comparison by Item</h2>
              <p className="text-xs text-gray-500 mt-1">Items purchased from multiple vendors</p>
            </div>
            {vendorComparisons.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No items purchased from multiple vendors yet.</p>
                <p className="text-sm mt-2">Buy the same item from different stores to compare prices!</p>
              </div>
            ) : (
              <div className="divide-y">
                {vendorComparisons.map((item, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.item_name}</h4>
                        <p className="text-xs text-gray-500">{item.total_purchases} total purchases</p>
                      </div>
                      {item.price_spread_pct > 0 && (
                        <div className="text-right">
                          <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
                            {item.price_spread_pct.toFixed(0)}% price spread
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.vendors.map((vendor, vIdx) => {
                        const bestPrice = item.best_vendor?.avg_price || item.vendors[0].avg_price;
                        const priceDiffPct = vIdx > 0 ? ((vendor.avg_price - bestPrice) / bestPrice * 100) : 0;
                        return (
                          <div
                            key={vIdx}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                              vIdx === 0
                                ? 'bg-green-50 border border-green-200'
                                : vIdx === item.vendors.length - 1 && item.vendors.length > 1
                                  ? 'bg-red-50 border border-red-200'
                                  : 'bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <span className="text-gray-600">{vendor.vendor}</span>
                            <span className={vIdx === 0 ? 'text-green-600 font-medium' : 'text-gray-900'}>
                              {formatPrice(vendor.avg_price)}
                            </span>
                            {vIdx === 0 && item.vendors.length > 1 && (
                              <span className="text-xs text-green-600">Best</span>
                            )}
                            {vIdx > 0 && priceDiffPct > 0 && (
                              <span className="text-xs text-red-600">+{priceDiffPct.toFixed(0)}%</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {item.price_spread_pct >= 10 && item.best_vendor && item.worst_vendor && (
                      <p className="text-xs text-green-600 mt-2">
                        {item.price_spread_pct.toFixed(0)}% cheaper at {item.best_vendor.vendor} vs {item.worst_vendor.vendor}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Savings Tab */}
      {activeTab === 'savings' && (
        <>
          {/* Savings Summary Card */}
          {savingsSummary && savingsSummary.total_overpaid_ytd > 0 && (
            <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Potential Savings</h3>
                  <p className="text-sm text-green-700">If you always bought at the best price</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-xs text-gray-500 uppercase mb-1">You Could Have Saved</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatPrice(savingsSummary.total_overpaid_ytd)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="text-xs text-gray-500 uppercase mb-1">Items with Savings</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {savingsSummary.top_opportunities.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Savings Opportunities */}
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">Savings Opportunities</h2>
              <p className="text-xs text-gray-500 mt-1">Switch vendors to save money on these items</p>
            </div>
            {!savingsSummary || savingsSummary.top_opportunities.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No savings opportunities found yet.</p>
                <p className="text-sm mt-2">Buy items from different vendors to find the best deals!</p>
              </div>
            ) : (
              <div className="divide-y">
                {savingsSummary.top_opportunities.map((opp, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{opp.item_name}</h4>
                        <p className="text-sm text-green-600">{opp.recommendation}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-600">
                          Save {formatPrice(opp.overpaid_amount)}
                        </span>
                        <p className="text-xs text-gray-500">{opp.overpaid_pct.toFixed(0)}% less</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm mt-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-gray-500">Best:</span>
                        <span className="text-gray-900">{opp.best_vendor}</span>
                        <span className="text-green-600">{formatPrice(opp.best_price)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span className="text-gray-500">Worst:</span>
                        <span className="text-gray-900">{opp.worst_vendor}</span>
                        <span className="text-red-600">{formatPrice(opp.worst_price)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* No Savings Banner */}
          {(!savingsSummary || savingsSummary.total_overpaid_ytd === 0) && vendorDataLoaded && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <span className="text-3xl">🎉</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Great Job!</h3>
              <p className="text-gray-600">
                You&apos;re already getting the best prices on your purchases.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Keep shopping at your current vendors for the best value.
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {trends.length === 0 && !loading && activeTab === 'overview' && (
        <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Tracking Prices</h3>
          <p className="text-gray-500 mb-4 max-w-md mx-auto">
            Upload receipts with itemized purchases to automatically track prices over time.
            You&apos;ll see alerts when prices increase or decrease.
          </p>
          <Link
            href="/dashboard/expenses/new"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Add Expense with Receipt
          </Link>
        </div>
      )}

      <div className="flex justify-start">
        <Link href="/dashboard/expenses/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
