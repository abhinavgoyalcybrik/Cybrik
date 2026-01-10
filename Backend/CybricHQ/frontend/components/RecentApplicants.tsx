// frontend/components/RecentApplicants.tsx
"use client";
import { useState } from "react";

export default function RecentApplicants({ initial = [] }: { initial: any[] }) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/admin/recent-applicants/", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">Latest applicants</div>
        <button
          onClick={refresh}
          className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <ul className="space-y-2">
        {items.length === 0 && (<li className="text-sm text-gray-400">No recent applicants</li>)}
        {items.map((a:any) => (
          <li key={a.id} className="p-3 border rounded flex items-center justify-between">
            <div>
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-gray-500">{a.email}</div>
            </div>
            <a href={`/crm/applicants/${a.id}`} className="text-sm text-blue-600">Open</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
