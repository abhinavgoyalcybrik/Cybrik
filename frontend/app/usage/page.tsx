'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface UsageDashboard {
  current_month: string;
  tenant_id: number;
  openai: {
    total_tokens: number;
    total_cost: string;
    api_calls: number;
    quota_limit?: number;
    percentage_used?: number;
  };
  elevenlabs: {
    total_characters: number;
    total_cost: string;
    api_calls: number;
    quota_limit?: number;
    percentage_used?: number;
  };
  smartflo: {
    total_minutes: string;
    total_cost: string;
    api_calls: number;
    quota_limit?: number;
    percentage_used?: number;
  };
  total_cost: string;
  total_api_calls: number;
  alerts: Array<{
    alert_type: string;
    message: string;
    status: string;
  }>;
}

interface MonthlyHistory {
  month: string;
  openai_total_tokens: number;
  openai_total_cost: string;
  elevenlabs_total_characters: number;
  elevenlabs_total_cost: string;
  smartflo_total_minutes: string;
  smartflo_total_cost: string;
  total_cost_usd: string;
  total_api_calls: number;
}

export default function TenantUsagePage() {
  const [dashboard, setDashboard] = useState<UsageDashboard | null>(null);
  const [history, setHistory] = useState<MonthlyHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load current month dashboard
      const dashRes = await fetch('/api/tenant/usage/dashboard/', {
        credentials: 'include',
      });
      const dashData = await dashRes.json();
      setDashboard(dashData);

      // Load historical data
      const histRes = await fetch('/api/tenant/usage/history/?months=6', {
        credentials: 'include',
      });
      const histData = await histRes.json();
      setHistory(Array.isArray(histData) ? histData : []);
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressTextColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 80) return 'text-orange-500';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading your usage data...</div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">
          No usage data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Usage Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your API usage and costs for {dashboard.current_month}</p>
        </div>
        <Button onClick={loadData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Active Alerts */}
      {dashboard.alerts && dashboard.alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-900 flex items-center">
              <span className="mr-2">⚠️</span>
              Important Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboard.alerts.map((alert, index) => (
                <div key={index} className="bg-white p-3 rounded-lg border border-orange-200">
                  <p className="text-sm text-gray-900 font-medium">{alert.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-lg text-gray-700">Total Cost This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">
              ${parseFloat(dashboard.total_cost).toFixed(2)}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Across {dashboard.total_api_calls.toLocaleString()} API calls
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg text-gray-700">API Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">OpenAI Calls</span>
                <span className="text-sm font-semibold">{dashboard.openai.api_calls.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">ElevenLabs Calls</span>
                <span className="text-sm font-semibold">{dashboard.elevenlabs.api_calls.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Smartflo Calls</span>
                <span className="text-sm font-semibold">{dashboard.smartflo.api_calls.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current">Current Month</TabsTrigger>
          <TabsTrigger value="history">Usage History</TabsTrigger>
        </TabsList>

        {/* Current Month Tab */}
        <TabsContent value="current" className="space-y-6">
          {/* OpenAI Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🤖</span>
                <span>OpenAI Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Tokens Used</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard.openai.total_tokens.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Cost</div>
                    <div className="text-2xl font-bold text-green-600">
                      ${parseFloat(dashboard.openai.total_cost).toFixed(2)}
                    </div>
                  </div>
                </div>

                {dashboard.openai.quota_limit && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Quota Usage</span>
                      <span className={`font-semibold ${getProgressTextColor(dashboard.openai.percentage_used || 0)}`}>
                        {dashboard.openai.percentage_used?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(dashboard.openai.percentage_used || 0)}`}
                        style={{ width: `${Math.min(dashboard.openai.percentage_used || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {dashboard.openai.total_tokens.toLocaleString()} / {dashboard.openai.quota_limit.toLocaleString()} tokens
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ElevenLabs Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🎙️</span>
                <span>ElevenLabs Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Characters Processed</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboard.elevenlabs.total_characters.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Cost</div>
                    <div className="text-2xl font-bold text-green-600">
                      ${parseFloat(dashboard.elevenlabs.total_cost).toFixed(2)}
                    </div>
                  </div>
                </div>

                {dashboard.elevenlabs.quota_limit && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Quota Usage</span>
                      <span className={`font-semibold ${getProgressTextColor(dashboard.elevenlabs.percentage_used || 0)}`}>
                        {dashboard.elevenlabs.percentage_used?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(dashboard.elevenlabs.percentage_used || 0)}`}
                        style={{ width: `${Math.min(dashboard.elevenlabs.percentage_used || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {dashboard.elevenlabs.total_characters.toLocaleString()} / {dashboard.elevenlabs.quota_limit.toLocaleString()} characters
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Smartflo Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📞</span>
                <span>Smartflo Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Minutes Used</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {parseFloat(dashboard.smartflo.total_minutes).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Cost</div>
                    <div className="text-2xl font-bold text-green-600">
                      ${parseFloat(dashboard.smartflo.total_cost).toFixed(2)}
                    </div>
                  </div>
                </div>

                {dashboard.smartflo.quota_limit && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Quota Usage</span>
                      <span className={`font-semibold ${getProgressTextColor(dashboard.smartflo.percentage_used || 0)}`}>
                        {dashboard.smartflo.percentage_used?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(dashboard.smartflo.percentage_used || 0)}`}
                        style={{ width: `${Math.min(dashboard.smartflo.percentage_used || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {parseFloat(dashboard.smartflo.total_minutes).toFixed(1)} / {dashboard.smartflo.quota_limit} minutes
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Past 6 Months Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Month</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">OpenAI</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">ElevenLabs</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Smartflo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Total Cost</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">API Calls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {history.map((month, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {month.month}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          ${parseFloat(month.openai_total_cost).toFixed(2)}
                          <div className="text-xs text-gray-500">
                            {month.openai_total_tokens.toLocaleString()} tokens
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          ${parseFloat(month.elevenlabs_total_cost).toFixed(2)}
                          <div className="text-xs text-gray-500">
                            {month.elevenlabs_total_characters.toLocaleString()} chars
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          ${parseFloat(month.smartflo_total_cost).toFixed(2)}
                          <div className="text-xs text-gray-500">
                            {parseFloat(month.smartflo_total_minutes).toFixed(1)} min
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                          ${parseFloat(month.total_cost_usd).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {month.total_api_calls.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {history.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No historical data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Trend Summary */}
          {history.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Average Monthly Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    ${(history.reduce((sum, h) => sum + parseFloat(h.total_cost_usd), 0) / history.length).toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Highest Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    ${Math.max(...history.map(h => parseFloat(h.total_cost_usd))).toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Lowest Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ${Math.min(...history.map(h => parseFloat(h.total_cost_usd))).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Information Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="text-blue-600 text-xl">💡</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">About Your Usage</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Usage resets at the beginning of each month</li>
                <li>• Costs are calculated based on actual service provider pricing</li>
                <li>• You'll receive alerts when approaching 80% of any quota</li>
                <li>• Historical data is kept for your records and billing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
