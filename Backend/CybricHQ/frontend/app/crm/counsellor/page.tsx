// app/crm/counsellor/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function CounsellorDashboardPage() {
  const router = useRouter();

  // Example: redirect to crm login if not authenticated (adapt as needed)
  // Use actual auth check instead of naive redirect in production
  // if (!isAuthenticated) router.push("/crm/login");

  return (
    <main style={{ padding: 40 }}>
      <h1 className="text-2xl font-semibold">Counsellor Dashboard</h1>
      <p className="mt-2 text-gray-600">This is a placeholder counsellor dashboard page. Replace with your real UI.</p>

      <div className="mt-6">
        <button
          onClick={() => router.push("/crm/login")}
          className="btn-primary px-3 py-2 rounded"
        >
          Go to CRM Login
        </button>
      </div>
    </main>
  );
}
