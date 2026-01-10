'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Mic,
  PenTool,
  Headphones,
  LogOut,
  Trophy,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import DashboardAnalytics from '@/components/DashboardAnalytics';
import DashboardGettingStarted from '@/components/DashboardGettingStarted';



interface TestCounts {
  speaking: number;
  writing: number;
  listening: number;
  reading: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const [testCounts, setTestCounts] = useState<TestCounts>({
    speaking: 0,
    writing: 0,
    listening: 0,
    reading: 0,
  });
  const [completedCounts, setCompletedCounts] = useState<TestCounts>({
    speaking: 0,
    writing: 0,
    listening: 0,
    reading: 0,
  });

  // Authentication check - verify with backend to prevent redirect loop
  const [authVerified, setAuthVerified] = useState(false);

  useEffect(() => {
    const verifySession = async () => {
      // If user is already set, we're good
      if (user) {
        setAuthVerified(true);
        return;
      }

      // If still loading auth state, wait
      if (isLoading) return;

      // Prevent multiple verification attempts
      if (authVerified) return;
      setAuthVerified(true);

      // Check backend session before redirecting to login
      try {
        const res = await fetch('/api/ielts/auth/me/', {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            // User is authenticated via cookie, update localStorage
            localStorage.setItem('ielts_user', JSON.stringify(data.user));
            // Use router.refresh() instead of window.location.reload()
            window.location.href = '/dashboard';
            return;
          }
        }

        // Not authenticated, redirect to login
        router.push('/login');
      } catch (err) {
        // Error checking session, redirect to login
        router.push('/login');
      }
    };

    verifySession();
  }, [isLoading, user, router, authVerified]);

  // Fetch test counts from JSON files and backend
  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    Promise.all([
      // Fetch from local JSON files
      fetch('/data/speaking_tests.json').then(r => r.json()).catch(() => ({ tests: [] })),
      fetch('/data/writing_tests.json').then(r => r.json()).catch(() => ({ tests: [] })),
      fetch('/data/listening_tests.json').then(r => r.json()).catch(() => ({ tests: [] })),
      fetch('/data/reading_tests.json').then(r => r.json()).catch(() => ({ tests: [] })),
      // Also fetch from backend API if available
      fetch(`${API_BASE}/api/ielts/tests/?module_type=listening`, { credentials: 'include' })
        .then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/ielts/tests/?module_type=reading`, { credentials: 'include' })
        .then(r => r.json()).catch(() => []),
    ]).then(([speakingData, writingData, listeningJsonData, readingJsonData, listeningApiData, readingApiData]) => {
      // Combine counts from JSON and API - Prioritize API if available to avoid duplicates
      const listeningApiTests = Array.isArray(listeningApiData) ? listeningApiData : listeningApiData.results || [];
      const readingApiTests = Array.isArray(readingApiData) ? readingApiData : readingApiData.results || [];

      setTestCounts({
        speaking: speakingData.tests?.length || 0,
        writing: writingData.tests?.length || 0,
        listening: listeningApiTests.length > 0 ? listeningApiTests.length : (listeningJsonData.tests?.length || 0),
        reading: readingApiTests.length > 0 ? readingApiTests.length : (readingJsonData.tests?.length || 0),
      });
    });

    // Fetch user sessions for completed counts
    fetch(`${API_BASE}/api/ielts/sessions/`, { credentials: 'include' })
      .then(r => r.json())
      .then((sessions: any[]) => {
        if (!Array.isArray(sessions)) return;

        const completed = { speaking: 0, writing: 0, listening: 0, reading: 0 };

        sessions.forEach(session => {
          // Helper to determine type
          const guessType = (title: string) => {
            const t = title.toLowerCase();
            if (t.includes('speak')) return 'speaking';
            if (t.includes('writ')) return 'writing';
            if (t.includes('listen') || t.includes('lt')) return 'listening';
            if (t.includes('read') || t.includes('rt')) return 'reading';
            return 'reading'; // default
          };

          const type = session.module_type || guessType(session.test_title || '');
          if (session.is_completed || session.status === 'completed') {
            if (completed[type as keyof typeof completed] !== undefined) {
              completed[type as keyof typeof completed]++;
            }
          }

          // Also check nested attempts if any
          if (session.module_attempts) {
            session.module_attempts.forEach((att: any) => {
              const attType = att.module_type || guessType(session.test_title || '');
              if (att.is_completed && completed[attType as keyof typeof completed] !== undefined) {
                // Avoid double counting if session was already counted? 
                // Actually sessions usually group attempts. Let's rely on distinct attempts if present.
                // For simplicity, just count unique completed tests based on session for now or strictly completed attempts.
              }
            });
          }
        });
        setCompletedCounts(completed);
      })
      .catch(e => console.error(e));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/ielts/auth/logout/', { method: 'POST', credentials: 'include' });
    } catch (e) { }
    localStorage.removeItem('ielts_user');
    localStorage.removeItem('ielts_token');
    // Use AuthContext logout for complete cleanup
    logout();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6FB63A]"></div>
      </div>
    );
  }

  const evaluationsRemaining = user?.evaluations_remaining ?? 3;
  const hasFullAccess = user?.has_full_access ?? false;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <AdminLayout
      title="Dashboard"
      subtitle={`Welcome back, ${firstName}`}
      actions={
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-[#6FB63A] hover:bg-[#5FA030] rounded-lg text-[#0B1F3A] font-medium transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      }
    >
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link href="/tests/writing" className="block">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform">
                <PenTool className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-slate-500">Writing</span>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {completedCounts.writing} <span className="text-base text-slate-400 font-normal">/ {testCounts.writing}</span>
            </p>
          </div>
        </Link>

        <Link href="/tests/speaking" className="block">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                <Mic className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-slate-500">Speaking</span>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {completedCounts.speaking} <span className="text-base text-slate-400 font-normal">/ {testCounts.speaking}</span>
            </p>
          </div>
        </Link>

        <Link href="/tests/listening" className="block">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
                <Headphones className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-slate-500">Listening</span>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {completedCounts.listening} <span className="text-base text-slate-400 font-normal">/ {testCounts.listening}</span>
            </p>
          </div>
        </Link>

        <Link href="/tests/reading" className="block">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-slate-500">Reading</span>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {completedCounts.reading} <span className="text-base text-slate-400 font-normal">/ {testCounts.reading}</span>
            </p>
          </div>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Analytics */}
        <div className="flex-1 space-y-8">
          <DashboardAnalytics />

          {/* Quick Stats moved below or integrated? User image showed Analytics prominent */}
          {/* Let's keep Quick Stats but perhaps smaller or above */}
        </div>

        {/* Right Column: Getting Started */}
        <div className="w-full lg:w-96 space-y-6">

          {/* Profile Goals Card */}
          {user?.target_score && (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-500 mb-4">Your Goals</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#6FB63A] to-emerald-500 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{user.target_score}</span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">Target Band Score</p>
                  <p className="text-sm text-slate-500">
                    {user.test_type === 'academic' ? 'Academic' : user.test_type === 'general' ? 'General Training' : 'IELTS'}
                  </p>
                </div>
              </div>
              {user.exam_date && user.exam_date !== 'unknown' && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Exam Date</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {new Date(user.exam_date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                  {(() => {
                    const examDate = new Date(user.exam_date);
                    const today = new Date();
                    const diffTime = examDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 0) {
                      return (
                        <p className="text-sm text-emerald-600 font-medium mt-1">
                          {diffDays} days to go!
                        </p>
                      );
                    } else if (diffDays === 0) {
                      return <p className="text-sm text-orange-600 font-medium mt-1">Today!</p>;
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          )}

          <DashboardGettingStarted />

          {/* Upgrade Banner */}
          {!hasFullAccess && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white text-center shadow-lg shadow-blue-900/20">
              <p className="text-sm font-medium opacity-90 mb-1">0/3 weekly free check rights used</p>
              <p className="text-xs opacity-70 mb-4">Renews in 6 days 23 hours...</p>
              <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4" />
                Upgrade to premium now
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
