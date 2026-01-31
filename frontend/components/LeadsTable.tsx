import React, { useEffect, useState } from "react";
import apiFetch from "../lib/api";

export default function LeadsTable({ initialFilters = {} }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(filters = {}) {
    setLoading(true);
    const qs = new URLSearchParams(filters as any).toString();
    const data = await apiFetch(`/api/leads/?${qs}`);
    setLeads(data.results || data); // depends on pagination
    setLoading(false);
  }

  useEffect(()=>{ load(initialFilters); }, []);

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      {loading ? <div>Loading…</div> :
        <table className="w-full">
          <thead><tr><th>Name</th><th>Country</th><th>Intake</th><th>Status</th></tr></thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="border-t">
                <td>{l.name}</td>
                <td>{l.country_of_interest}</td>
                <td>{l.intake}</td>
                <td>{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </div>
  );
}
