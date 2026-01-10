"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import apiFetch from "@/lib/api";
import Link from "next/link";
import { useUser } from "@/context/UserContext";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [remember, setRemember] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { refreshUser } = useUser();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      // Refresh the global user context immediately after login
      await refreshUser();

      // We can get the fresh user from the API response or just rely on the context update
      // But for redirection logic, we might want to fetch it or wait for context
      // Since refreshUser updates the context, we can just fetch 'me' here for the redirection logic
      // OR better, let's just fetch it for the redirection logic as before, but we MUST await refreshUser first

      const profile = await apiFetch("/api/auth/me/");
      const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : (profile?.groups ?? []);

      if (profile?.is_superuser || roles.includes("admin")) {
        router.push("/dashboard");
      } else if (roles.includes("counsellor") || roles.includes("counselor")) {
        router.push("/dashboard");
      } else if (roles.includes("admissions")) {
        router.push("/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Login error", err);
      setError(err?.message ?? "Login failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-[#F8FAFC] to-[#E8F5DC]/30 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0 items-stretch">
        <div className="hidden lg:flex flex-col justify-center gap-8 p-8 xl:p-12 bg-[#0B1F3A] rounded-l-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="loginCircuit" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                  <circle cx="30" cy="30" r="2" fill="#6FB63A" />
                  <path d="M30 0 L30 28 M60 30 L32 30" stroke="#6FB63A" strokeWidth="0.5" fill="none" />
                  <circle cx="10" cy="50" r="1.5" fill="#6FB63A" />
                  <path d="M10 50 L10 60" stroke="#6FB63A" strokeWidth="0.3" fill="none" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#loginCircuit)" />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#6FB63A]" />
                <div className="w-6 h-[2px] bg-[#6FB63A]" />
                <div className="w-1.5 h-1.5 rounded-full border border-[#6FB63A]" />
              </div>
            </div>

            <h2 className="text-3xl xl:text-4xl font-bold text-white mb-3">
              Welcome to
              <br />
              <span className="text-[#6FB63A]">Cybrik Solutions</span>
            </h2>
            <p className="text-[#B0BDCC] text-sm xl:text-base mb-8">
              Smart CRM & Admissions platform crafted for education consultants and counselors.
            </p>

            <div className="space-y-4">
              <FeatureRow
                icon={<SpeedIcon />}
                title="Faster Follow-ups"
                desc="Auto-workflows and quick call actions"
              />
              <FeatureRow
                icon={<ChartIcon />}
                title="Clear Dashboards"
                desc="Role-specific metrics and KPIs"
              />
              <FeatureRow
                icon={<ShieldIcon />}
                title="Secure Access"
                desc="Enterprise-grade security"
              />
            </div>

            <div className="mt-8 pt-6 border-t border-[#16263F]">
              <p className="text-xs text-[#5B6A7F]">
                Trusted by <span className="text-[#6FB63A] font-semibold">500+</span> education consultancies worldwide
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 xl:p-12 rounded-2xl lg:rounded-l-none lg:rounded-r-2xl shadow-xl lg:shadow-2xl">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <span className="text-xl font-bold text-[#0B1F3A]">CYBRIK</span>
            <span className="text-xl font-bold text-[#6FB63A]">SOLUTIONS</span>
          </div>

          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B1F3A] mb-2">Sign in to CRM</h1>
            <p className="text-sm text-[#5B6A7F]">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#3D4B5C] mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={loading}
                  required
                  className="w-full border border-[#E6ECF4] rounded-lg py-3 pl-10 pr-4 text-[#0B1F3A] placeholder-[#B0BDCC] focus:outline-none focus:border-[#6FB63A] focus:ring-2 focus:ring-[#6FB63A]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#3D4B5C] mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockIcon />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                  className="w-full border border-[#E6ECF4] rounded-lg py-3 pl-10 pr-4 text-[#0B1F3A] placeholder-[#B0BDCC] focus:outline-none focus:border-[#6FB63A] focus:ring-2 focus:ring-[#6FB63A]/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-[#5B6A7F] cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#E6ECF4] text-[#6FB63A] focus:ring-[#6FB63A]/20"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-[#6FB63A] hover:text-[#5FA030] font-medium transition-colors">
                Forgot password?
              </a>
            </div>

            {error && (
              <div role="alert" className="text-sm text-red-600 border border-red-100 bg-red-50 px-4 py-3 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-3.5 rounded-lg text-white font-semibold bg-[#6FB63A] hover:bg-[#5FA030] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-[#6FB63A]/25 hover:shadow-xl hover:shadow-[#6FB63A]/30 flex items-center justify-center gap-2"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Spinner /> Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 text-center">
            <p className="text-sm text-[#5B6A7F]">
              Need access?{" "}
              <a href="mailto:contact@cybriksolutions.com" className="text-[#6FB63A] hover:text-[#5FA030] font-medium transition-colors">
                Contact administrator
              </a>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-[#E6ECF4]">
            <Link href="/" className="flex items-center justify-center gap-2 text-sm text-[#8494A7] hover:text-[#0B1F3A] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 flex items-center justify-center bg-[#16263F] text-[#6FB63A] rounded-lg flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-semibold text-white text-sm">{title}</div>
        <div className="text-xs text-[#8494A7]">{desc}</div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5 text-[#B0BDCC]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 20a8 8 0 10-16 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5 text-[#B0BDCC]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpeedIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
