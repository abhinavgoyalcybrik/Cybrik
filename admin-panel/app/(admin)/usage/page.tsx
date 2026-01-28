'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  Activity, 
  Zap, 
  DollarSign,
  Calendar,
  RefreshCw,
  Download,
  Filter,
  Users
} from 'lucide-react';
import { tenantApi, usageApi } from '@/lib/api';

interface Tenant {
  id: number;
  name: string;
  domain?: string;
}

interface UsageSummary {
  id: number;
  tenant: number;
  tenant_name: string;
  period_start: string;
  period_end: string;
  openai_total_tokens: number;
  openai_total_cost: string;
  elevenlabs_total_characters: number;
  elevenlabs_total_cost: string;
  smartflo_total_minutes: string;
  smartflo_total_cost: string;
  total_cost_usd: string;
  total_api_calls: number;
}

interface UsageAlert {
  id: number;
  tenant: number;
  tenant_name: string;
  alert_type: string;
  service: string;
  message: string;
  current_value: string;
  threshold_value: string;
  status: string;
  created_at: string;
}

interface UsageLog {
  id: number;
  tenant: number;
  tenant_name: string;
  service: string;
  endpoint: string;
  request_timestamp: string;
  tokens_input?: number;
  tokens_output?: number;
  characters_processed?: number;
  duration_seconds?: number;
  cost_usd: string;
  is_error: boolean;
  error_message?: string;
}

export default function UsagePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<UsageSummary[]>([]);
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string>('all');

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      loadData();
    }
  }, [selectedTenant]);

  const loadTenants = async () => {
    try {
      const data: any = await tenantApi.list();
      const tenantList = Array.isArray(data) ? data : data.results || [];
      setTenants(tenantList);
      
      // Auto-select first tenant
      if (tenantList.length > 0 && !selectedTenant) {
        setSelectedTenant(tenantList[0].id);
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const loadData = async () => {
    if (!selectedTenant) return;
    
    setLoading(true);
    try {
      // Load summaries for selected tenant
      const summariesData: any = await usageApi.getSummaries({ tenant: selectedTenant });
      setSummaries(Array.isArray(summariesData) ? summariesData : summariesData.results || []);

      // Load alerts for selected tenant
      const alertsData: any = await usageApi.getAlerts({ tenant: selectedTenant, status: 'active' });
      setAlerts(Array.isArray(alertsData) ? alertsData : alertsData.results || []);

      // Load logs for selected tenant
      const logsData: any = await usageApi.getLogs({ tenant: selectedTenant, limit: 100 });
      setLogs(Array.isArray(logsData) ? logsData : logsData.results || []);
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: number) => {
    try {
      await usageApi.acknowledgeAlert(String(alertId));
      loadData(); // Reload data
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesService = selectedService === 'all' || log.service === selectedService;
    return matchesService;
  });

  const currentSummary = summaries.length > 0 ? summaries[0] : null;
  const selectedTenantName = tenants.find(t => t.id === selectedTenant)?.name || 'Select Tenant';

  if (loading && tenants.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Tenant Selector */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Usage Analytics</h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Real-time API usage, costs, and performance metrics
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm" disabled={!selectedTenant || loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedTenant}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tenant Selector */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-xl shadow-md">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Select Customer to View Usage
              </label>
              <select
                value={selectedTenant || ''}
                onChange={(e) => setSelectedTenant(Number(e.target.value))}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400"
              >
                <option value="">-- Select a Customer --</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} {tenant.domain && `(${tenant.domain})`}
                  </option>
                ))}
              </select>
            </div>
            {tenants.length > 0 && (
              <div className="text-right">
                <div className="text-xs text-blue-700 font-medium">Total Customers</div>
                <div className="text-2xl font-bold text-blue-900">{tenants.length}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedTenant && (
        <Card className="border-dashed border-2">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <BarChart3 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Customer Selected</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Please select a customer from the dropdown above to view their detailed usage analytics, costs, and performance metrics.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTenant && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-600 uppercase flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-gray-900 truncate" title={selectedTenantName}>{selectedTenantName}</div>
                {currentSummary && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(currentSummary.period_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-600 uppercase flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Total Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  ${currentSummary ? parseFloat(currentSummary.total_cost_usd).toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-green-700 mt-1 font-medium">This Month</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-600 uppercase flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Total API Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {currentSummary ? currentSummary.total_api_calls.toLocaleString() : '0'}
                </div>
                <p className="text-xs text-blue-700 mt-1 font-medium">Requests Made</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow bg-gradient-to-br from-red-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-gray-600 uppercase flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{alerts.length}</div>
                <p className="text-xs text-red-700 mt-1 font-medium">
                  {alerts.length === 0 ? 'All Good' : 'Needs Attention'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Alerts Section */}
          {alerts.length > 0 && (
            <Card className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-orange-50 shadow-md">
              <CardHeader>
                <CardTitle className="text-red-900 flex items-center gap-2">
                  <div className="p-2 bg-red-500 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <span>Active Alerts - {selectedTenantName} ({alerts.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="bg-white p-5 rounded-xl border-l-4 border-l-red-400 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                              {alert.service.toUpperCase()}
                            </span>
                            <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                              {alert.alert_type.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-800 text-sm font-medium mb-1">{alert.message}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Current: <span className="font-semibold">{parseFloat(alert.current_value).toLocaleString()}</span>
                            </span>
                            {alert.threshold_value && (
                              <span className="flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" />
                                Limit: <span className="font-semibold">{parseFloat(alert.threshold_value).toLocaleString()}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => acknowledgeAlert(alert.id)}
                          variant="outline"
                          size="sm"
                          className="ml-4 border-red-300 text-red-700 hover:bg-red-50"
                        >
                          Acknowledge
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs for different views */}
          <Tabs defaultValue="summary" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex bg-gray-100 p-1 rounded-lg">
              <TabsTrigger value="summary" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <BarChart3 className="w-4 h-4" />
                <span>Usage Summary</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Activity className="w-4 h-4" />
                <span>Recent Activity</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Calendar className="w-4 h-4" />
                <span>Monthly History</span>
              </TabsTrigger>
            </TabsList>

            {/* Usage Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              {loading ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-gray-500">Loading usage data...</div>
                  </CardContent>
                </Card>
              ) : currentSummary ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* OpenAI Card */}
                    <Card className="border-l-4 border-l-purple-500 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-white">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="p-2 bg-purple-500 rounded-lg">
                            <span className="text-white text-xl">🤖</span>
                          </div>
                          <div>
                            <div className="font-bold">OpenAI</div>
                            <div className="text-xs text-gray-500 font-normal">GPT Models</div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Tokens</div>
                            <div className="text-3xl font-bold text-purple-700">
                              {currentSummary.openai_total_tokens.toLocaleString()}
                            </div>
                          </div>
                          <div className="pt-3 border-t border-purple-100">
                            <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Cost</div>
                            <div className="text-2xl font-bold text-green-600">
                              ${parseFloat(currentSummary.openai_total_cost).toFixed(2)}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-purple-100 flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <div className="text-xs text-gray-500">
                              {new Date(currentSummary.period_start).toLocaleDateString()} - {new Date(currentSummary.period_end).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* ElevenLabs Card */}
                    <Card className="border-l-4 border-l-blue-500 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-white">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="p-2 bg-blue-500 rounded-lg">
                            <span className="text-white text-xl">🎤</span>
                          </div>
                          <div>
                            <div className="font-bold">ElevenLabs</div>
                            <div className="text-xs text-gray-500 font-normal">Text-to-Speech</div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Characters</div>
                            <div className="text-3xl font-bold text-blue-700">
                              {currentSummary.elevenlabs_total_characters.toLocaleString()}
                            </div>
                          </div>
                          <div className="pt-3 border-t border-blue-100">
                            <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Cost</div>
                            <div className="text-2xl font-bold text-green-600">
                              ${parseFloat(currentSummary.elevenlabs_total_cost).toFixed(2)}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-blue-100 flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <div className="text-xs text-gray-500">
                              {new Date(currentSummary.period_start).toLocaleDateString()} - {new Date(currentSummary.period_end).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Smartflo Card */}
                    <Card className="border-l-4 border-l-indigo-500 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-indigo-50 to-white">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="p-2 bg-indigo-500 rounded-lg">
                            <span className="text-white text-xl">📞</span>
                          </div>
                          <div>
                            <div className="font-bold">Smartflo</div>
                            <div className="text-xs text-gray-500 font-normal">Phone Calls</div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Minutes</div>
                            <div className="text-3xl font-bold text-indigo-700">
                              {parseFloat(currentSummary.smartflo_total_minutes).toFixed(1)}
                            </div>
                          </div>
                          <div className="pt-3 border-t border-indigo-100">
                            <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Cost</div>
                            <div className="text-2xl font-bold text-green-600">
                              ${parseFloat(currentSummary.smartflo_total_cost).toFixed(2)}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-indigo-100 flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <div className="text-xs text-gray-500">
                              {new Date(currentSummary.period_start).toLocaleDateString()} - {new Date(currentSummary.period_end).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Total Summary */}
                  <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="p-4 bg-green-500 rounded-xl shadow-md">
                            <DollarSign className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <div className="text-sm text-green-700 font-semibold uppercase mb-1">Total Monthly Cost</div>
                            <div className="text-5xl font-bold text-green-700">
                              ${parseFloat(currentSummary.total_cost_usd).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-1">
                            <Zap className="w-4 h-4 text-green-700" />
                            <div className="text-sm text-green-700 font-semibold uppercase">Total API Calls</div>
                          </div>
                          <div className="text-5xl font-bold text-green-700">
                            {currentSummary.total_api_calls.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-gray-500">
                      No usage data found for this customer
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Recent Activity Tab */}
            <TabsContent value="logs" className="space-y-4">
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  >
                    <option value="all">All Services</option>
                    <option value="openai">🤖 OpenAI</option>
                    <option value="elevenlabs">🎤 ElevenLabs</option>
                    <option value="smartflo">📞 Smartflo</option>
                  </select>
                </div>
                <div className="flex-1"></div>
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Showing {filteredLogs.length > 50 ? '50' : filteredLogs.length} of {filteredLogs.length} logs
                </div>
              </div>

              <Card className="shadow-md">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {filteredLogs.slice(0, 50).map((log, index) => (
                      <div 
                        key={log.id} 
                        className={`flex items-start gap-4 p-4 rounded-xl border-l-4 transition-all hover:shadow-md ${
                          log.is_error 
                            ? 'bg-red-50 border-l-red-500' 
                            : index % 2 === 0 
                              ? 'bg-blue-50 border-l-blue-400' 
                              : 'bg-gray-50 border-l-gray-400'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                            log.service === 'openai' ? 'bg-purple-500' : 
                            log.service === 'elevenlabs' ? 'bg-blue-500' : 
                            'bg-indigo-500'
                          }`}>
                            <span className="text-white text-xl">
                              {log.service === 'openai' && '🤖'}
                              {log.service === 'elevenlabs' && '🎤'}
                              {log.service === 'smartflo' && '📞'}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1 bg-white text-gray-700 text-xs font-bold rounded-full border-2 border-gray-300">
                                  {log.service.toUpperCase()}
                                </span>
                                {log.is_error && (
                                  <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    ERROR
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-700 font-medium mb-1">
                                {log.service === 'openai' && `${((log.tokens_input || 0) + (log.tokens_output || 0)).toLocaleString()} tokens processed`}
                                {log.service === 'elevenlabs' && `${(log.characters_processed || 0).toLocaleString()} characters synthesized`}
                                {log.service === 'smartflo' && `${((log.duration_seconds || 0) / 60).toFixed(1)} minutes talk time`}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {new Date(log.request_timestamp).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <div className="text-xl font-bold text-green-600">
                                ${parseFloat(log.cost_usd).toFixed(4)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {filteredLogs.length === 0 && (
                      <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                          <Activity className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activity Found</h3>
                        <p className="text-gray-500">
                          No activity logs found for {selectedTenantName}
                        </p>
                      </div>
                    )}

                    {filteredLogs.length > 50 && (
                      <div className="text-center text-sm text-gray-500 pt-4 border-t flex items-center justify-center gap-2">
                        <Activity className="w-4 h-4" />
                        Showing 50 of {filteredLogs.length} logs
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Monthly History Tab */}
            <TabsContent value="history" className="space-y-4">
              {loading ? (
                <Card>
                  <CardContent className="py-16">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mr-3" />
                      <div className="text-lg text-gray-500">Loading history...</div>
                    </div>
                  </CardContent>
                </Card>
              ) : summaries.length > 0 ? (
                <Card className="shadow-md">
                  <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Calendar className="w-6 h-6 text-blue-600" />
                      Usage History - {selectedTenantName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {summaries.map((summary, index) => (
                        <div 
                          key={summary.id} 
                          className="p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-l-4 border-l-blue-500 hover:shadow-lg transition-all"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-5 h-5 text-blue-600" />
                                <div className="font-bold text-xl text-gray-900">
                                  {new Date(summary.period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </div>
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-2">
                                <span>{new Date(summary.period_start).toLocaleDateString()}</span>
                                <span>→</span>
                                <span>{new Date(summary.period_end).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2 justify-end mb-1">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                <div className="text-3xl font-bold text-green-600">
                                  ${parseFloat(summary.total_cost_usd).toFixed(2)}
                                </div>
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-1 justify-end">
                                <Zap className="w-4 h-4" />
                                {summary.total_api_calls.toLocaleString()} API calls
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-lg border border-purple-200 hover:border-purple-400 transition-colors">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-purple-500 rounded">
                                  <span className="text-white text-sm">🤖</span>
                                </div>
                                <div className="text-sm font-semibold text-gray-700">OpenAI</div>
                              </div>
                              <div className="font-bold text-lg text-gray-900">
                                ${parseFloat(summary.openai_total_cost).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {summary.openai_total_tokens.toLocaleString()} tokens
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-blue-200 hover:border-blue-400 transition-colors">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-blue-500 rounded">
                                  <span className="text-white text-sm">🎤</span>
                                </div>
                                <div className="text-sm font-semibold text-gray-700">ElevenLabs</div>
                              </div>
                              <div className="font-bold text-lg text-gray-900">
                                ${parseFloat(summary.elevenlabs_total_cost).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {summary.elevenlabs_total_characters.toLocaleString()} chars
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-colors">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-indigo-500 rounded">
                                  <span className="text-white text-sm">📞</span>
                                </div>
                                <div className="text-sm font-semibold text-gray-700">Smartflo</div>
                              </div>
                              <div className="font-bold text-lg text-gray-900">
                                ${parseFloat(summary.smartflo_total_cost).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {parseFloat(summary.smartflo_total_minutes).toFixed(1)} min
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-16">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                        <Calendar className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No History Available</h3>
                      <p className="text-gray-500">
                        No history data found for {selectedTenantName}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
