"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Bell, Target, TrendingUp, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TargetData {
  id: number;
  counselor_name: string;
  target_enrollments: number;
  completed_enrollments: number;
  period_type: string;
  start_date: string;
  end_date: string;
  status: string;
  progress_percentage: number;
  remaining_enrollments: number;
  is_completed: boolean;
}

interface TargetSummary {
  total_targets: number;
  total_target_enrollments: number;
  total_completed: number;
  pending: number;
  completion_rate: number;
}

export default function CounselorTargetNotification() {
  const [targets, setTargets] = useState<TargetData[]>([]);
  const [summary, setSummary] = useState<TargetSummary | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      const response = await apiFetch("/api/counselor-targets/my_targets/");
      setTargets(response.targets || []);
      setSummary(response.summary || null);
      
      // Show notification if there are pending targets and user hasn't dismissed
      if (response.targets.length > 0 && !dismissed) {
        setShowNotification(true);
      }
    } catch (error) {
      console.error("Failed to fetch targets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowNotification(false);
    setDismissed(true);
  };

  if (loading || !summary || targets.length === 0) {
    return null;
  }

  return (
    <>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setShowNotification(true)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <Target className="w-6 h-6 text-gray-700" />
        {summary.pending > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {summary.pending}
          </span>
        )}
      </button>

      {/* Notification Modal */}
      {showNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Target className="w-6 h-6" />
                  <h2 className="text-xl font-semibold">Your Targets</h2>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 p-6 bg-gray-50 border-b">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Target</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total_target_enrollments}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{summary.total_completed}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-orange-600">{summary.pending}</p>
                  </div>
                  <Bell className="w-8 h-8 text-orange-500" />
                </div>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="px-6 py-4 bg-white border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-sm font-semibold text-gray-900">
                  {Math.round(summary.completion_rate)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, summary.completion_rate)}%` }}
                ></div>
              </div>
            </div>

            {/* Target Details */}
            <div className="p-6 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Active Targets
              </h3>
              <div className="space-y-4">
                {targets.map((target) => (
                  <div
                    key={target.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {target.period_type.charAt(0).toUpperCase() + target.period_type.slice(1)} Target
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              target.status === 'active'
                                ? 'bg-blue-100 text-blue-800'
                                : target.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {target.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(target.start_date).toLocaleDateString()} - {new Date(target.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {target.completed_enrollments} / {target.target_enrollments}
                        </p>
                        <p className="text-xs text-gray-500">enrollments</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            target.progress_percentage >= 100
                              ? 'bg-green-500'
                              : target.progress_percentage >= 75
                              ? 'bg-blue-500'
                              : target.progress_percentage >= 50
                              ? 'bg-yellow-500'
                              : 'bg-orange-500'
                          }`}
                          style={{ width: `${Math.min(100, target.progress_percentage)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {target.remaining_enrollments} remaining
                      </span>
                      <span
                        className={`font-semibold ${
                          target.progress_percentage >= 75 ? 'text-green-600' : 'text-orange-600'
                        }`}
                      >
                        {Math.round(target.progress_percentage)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
              <Button onClick={handleDismiss} variant="outline">
                Close
              </Button>
              <Button
                onClick={() => {
                  handleDismiss();
                  // You can add navigation to applications page here
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Applications
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
