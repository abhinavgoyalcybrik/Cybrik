"use client";

import React, { useEffect, useState, useMemo } from "react";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Loader from "@/components/ui/Loader";
import { useUser } from "@/context/UserContext";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import TrendChart from "@/components/dashboard/charts/TrendChart";
import FunnelChart from "@/components/dashboard/charts/FunnelChart";
import ApplicationsChart from "@/components/dashboard/charts/ApplicationsChart";
import CostChart from "@/components/dashboard/charts/CostChart";
import LLMUsageWidget from "@/components/dashboard/LLMUsageWidget";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import {
  Settings,
  Save,
  LayoutDashboard,
  BarChart3,
  Search,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";

const DEFAULT_LAYOUT = [
  { i: "stat_leads", x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "stat_applicants", x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "stat_conversion", x: 8, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "trend_chart", x: 0, y: 2, w: 8, h: 4, minW: 2, minH: 3 },
  { i: "funnel_chart", x: 8, y: 2, w: 4, h: 4, minW: 2, minH: 3 },
  { i: "llm_usage", x: 0, y: 6, w: 4, h: 3, minW: 2, minH: 2 },
  { i: "app_status", x: 4, y: 6, w: 4, h: 3, minW: 2, minH: 2 },
  { i: "cost_chart", x: 8, y: 6, w: 4, h: 3, minW: 2, minH: 2 },
];

export default function DashboardPage() {
  const { user: me, loading: userLoading } = useUser();
  const [layout, setLayout] = useState<any[]>(DEFAULT_LAYOUT);
  const [analyticsData, setAnalyticsData] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (userLoading) return;

    async function loadData() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (dateRange?.from)
          queryParams.append("start", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange?.to)
          queryParams.append("end", format(dateRange.to, "yyyy-MM-dd"));
        const qs = queryParams.toString();

        const queryString = queryParams.toString();
        const url = queryString
          ? `/api/dashboard/overview/?${queryString}`
          : `/api/dashboard/overview/`;
        const data = await apiFetch(url);
        const [
          configRes,
          timeSeriesRes,
          funnelRes,
          llmRes,
          appStatusRes,
          costRes,
          overviewRes,
        ] = await Promise.allSettled([
          apiFetch("/api/dashboard/config/"),
          apiFetch(`/api/analytics/time-series/?${qs}`),
          apiFetch(`/api/analytics/funnel/?${qs}`),
          apiFetch(`/api/analytics/llm-usage/?${qs}`),
          apiFetch(`/api/analytics/applications-status/?${qs}`),
          apiFetch(`/api/analytics/cost-time-series/?${qs}`),
          apiFetch(`/api/dashboard/overview/?${qs}`),
        ]);

        if (
          configRes.status === "fulfilled" &&
          configRes.value.layout !== null &&
          configRes.value.layout !== undefined
        ) {
          setLayout(configRes.value.layout);
        }

        const newAnalytics: any = {};
        if (timeSeriesRes.status === "fulfilled")
          newAnalytics.timeSeries = timeSeriesRes.value;
        if (funnelRes.status === "fulfilled")
          newAnalytics.funnel = funnelRes.value;
        if (llmRes.status === "fulfilled") newAnalytics.llm = llmRes.value;
        if (appStatusRes.status === "fulfilled")
          newAnalytics.appStatus = appStatusRes.value;
        if (costRes.status === "fulfilled")
          newAnalytics.costSeries = costRes.value;
        if (overviewRes.status === "fulfilled")
          newAnalytics.overview = overviewRes.value;

        setAnalyticsData(newAnalytics);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userLoading, dateRange]);

  const handleLayoutChange = (newLayout: any[]) => {
    setLayout(newLayout);
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/dashboard/config/save/", {
        method: "POST",
        body: JSON.stringify({ layout }),
      });
      alert("Dashboard layout saved successfully!");
      setIsEditable(false);
    } catch (err) {
      console.error("Failed to save layout", err);
      alert("Failed to save layout. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetLayout = async () => {
    if (confirm("Are you sure you want to reset the dashboard layout to default?")) {
      setLayout(DEFAULT_LAYOUT);
      // Optionally save immediately
      try {
        await apiFetch("/api/dashboard/config/save/", {
          method: "POST",
          body: JSON.stringify({ layout: DEFAULT_LAYOUT }),
        });
      } catch (err) {
        console.error("Failed to save reset layout", err);
      }
    }
  };

  const filteredLayout = useMemo(() => {
    if (!searchTerm) return layout;
    return layout.filter((item) =>
      item.i.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [layout, searchTerm]);

  const renderWidget = (id: string) => {
    // ... (search logic)

    switch (id) {
      case "stat_leads":
        return (
          <Link href="/leads" className="block h-full">
            <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-white/20 shadow-sm flex flex-col justify-center hover:shadow-md transition-shadow h-full cursor-pointer group">
              <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold group-hover:text-indigo-600 transition-colors">
                Total Leads
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 mt-1 sm:mt-2">
                {analyticsData.funnel?.funnel?.[0]?.count || 0}
              </div>
              <div className="text-[10px] sm:text-xs text-emerald-500 mt-1 font-medium">
                In selected period
              </div>
            </div>
          </Link>
        );
      case "stat_applicants":
        return (
          <Link href="/applicants" className="block h-full">
            <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-white/20 shadow-sm flex flex-col justify-center hover:shadow-md transition-shadow h-full cursor-pointer group">
              <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold group-hover:text-indigo-600 transition-colors">
                Applicants
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-indigo-600 mt-1 sm:mt-2">
                {analyticsData.funnel?.funnel?.[2]?.count || 0}
              </div>
              <div className="text-[10px] sm:text-xs text-indigo-400 mt-1 font-medium">
                Active pipeline
              </div>
            </div>
          </Link>
        );
      case "stat_conversion":
        return (
          <Link href="/applications" className="block h-full">
            <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-white/20 shadow-sm flex flex-col justify-center hover:shadow-md transition-shadow h-full cursor-pointer group">
              <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold group-hover:text-indigo-600 transition-colors">
                Conversion Rate
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-600 mt-1 sm:mt-2">
                {analyticsData.overview?.conversion_rate_percent || 0}%
              </div>
              <div className="text-[10px] sm:text-xs text-emerald-400 mt-1 font-medium">
                Leads Converted
              </div>
            </div>
          </Link>
        );
      case "trend_chart":
        return (
          <TrendChart
            data={analyticsData.timeSeries?.leads || []}
            title="Lead Growth"
          />
        );
      case "funnel_chart":
        return (
          <FunnelChart
            data={analyticsData.funnel?.funnel || []}
            title="Conversion Funnel"
          />
        );
      case "llm_usage":
        return <LLMUsageWidget data={analyticsData.llm} />;
      case "app_status":
        return (
          <ApplicationsChart
            data={analyticsData.appStatus || []}
            title="Application Status"
          />
        );
      case "cost_chart":
        return (
          <CostChart
            data={analyticsData.costSeries || []}
            title="Daily AI Cost"
          />
        );
      default:
        return (
          <div className="bg-white/50 backdrop-blur p-4 rounded-2xl border border-white/20 h-full flex items-center justify-center text-slate-400 font-medium">
            Unknown Widget
          </div>
        );
    }
  };

  if (loading && !analyticsData.overview) {
    // Initial load only
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <Loader size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={me}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <LayoutDashboard className="w-10 h-10 text-[var(--cy-lime)]" />
                Dashboard
              </h1>
              <p className="text-blue-100 text-lg max-w-2xl">
                Overview of your performance and metrics.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 items-end md:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <input
                  type="text"
                  placeholder="Search widgets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)] w-full md:w-48"
                />
              </div>
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
              <div className="flex gap-2">
                {((me as any)?.role === "admin" || me?.is_superuser) &&
                  (isEditable ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={resetLayout}
                        className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={saveLayout}
                        disabled={saving}
                        className="gap-2 bg-[var(--cy-lime)] hover:brightness-110 text-[var(--cy-navy)] font-bold"
                      >
                        <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditable(true)}
                      className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      Customize
                    </Button>
                  ))}
                {((me as any)?.role === "admin" || me?.is_superuser) && (
                  <Link href="/settings/dashboard">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-white/10 text-white"
                    >
                      <Settings className="w-5 h-5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-slate-100/50 p-1 rounded-xl mb-6">
            <TabsTrigger
              value="overview"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600"
            >
              <BarChart3 className="w-4 h-4 mr-2" /> Detailed Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <DashboardGrid
              layout={layout}
              onLayoutChange={handleLayoutChange}
              isEditable={isEditable}
            >
              {layout.map((item) => {
                // Simple visibility filter based on search
                if (
                  searchTerm &&
                  !item.i.toLowerCase().includes(searchTerm.toLowerCase())
                ) {
                  return <div key={item.i} className="hidden" />;
                }
                return (
                  <div
                    key={item.i}
                    className={cn(
                      "h-full w-full transition-all duration-200",
                      isEditable &&
                      "border-2 border-dashed border-indigo-300 rounded-2xl relative group bg-indigo-50/30",
                    )}
                  >
                    {isEditable && (
                      <div className="drag-handle absolute top-2 right-2 cursor-move p-1.5 bg-white rounded-lg shadow-sm hover:shadow-md z-10 text-slate-400 hover:text-indigo-600 transition-colors">
                        ✋
                      </div>
                    )}
                    {renderWidget(item.i)}
                  </div>
                );
              })}
            </DashboardGrid>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-96">
                <ApplicationsChart
                  data={analyticsData.appStatus || []}
                  title="Application Status Distribution"
                />
              </div>
              <div className="h-96">
                <CostChart
                  data={analyticsData.costSeries || []}
                  title="Daily AI Cost Trend"
                />
              </div>
              <div className="h-96 md:col-span-2">
                <TrendChart
                  data={analyticsData.timeSeries?.leads || []}
                  title="Lead Acquisition Velocity"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
