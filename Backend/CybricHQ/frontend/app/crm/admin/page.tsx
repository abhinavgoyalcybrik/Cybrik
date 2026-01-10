// frontend/app/crm/admin/page.tsx
import Link from "next/link";
import StatCard from "@/components/StatCard";
import RecentApplicants from "@/components/RecentApplicants";
import LogoutButton from "@/components/LogoutButton";

export const revalidate = 0; // always fetch fresh on dev

async function fetchJson(path: string) {
  // Using rewrite/proxy recommended: call /api/... which rewrites to your Django backend.
  const base = "";
  const url = path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`Failed fetching ${path}: ${res.status}`);
  return res.json();
}

export default async function AdminPage() {
  // Fetch dashboard data from your Django endpoints (proxied at /api/... or direct)
  let stats = { total_users: 0, total_applicants: 0, total_applications: 0, new_today: 0 };
  let recent: any[] = [];
  let users: any[] = [];

  try {
    stats = await fetchJson("/api/crm/admin/stats/");
  } catch (e) {
    console.error("admin stats fetch failed", e);
  }

  try {
    recent = await fetchJson("/api/crm/admin/recent-applicants/");
  } catch (e) {
    console.error("recent applicants fetch failed", e);
  }

  try {
    users = await fetchJson("/api/crm/admin/users/");
  } catch (e) {
    console.error("admin users fetch failed", e);
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">Overview & quick actions</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/crm" className="px-3 py-2 rounded bg-white border">Back to CRM</Link>
          <a
            href="/mnt/data/cybricHQ_multitenancy_architecture.pdf"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded bg-white border"
          >
            View Architecture PDF
          </a>
          <LogoutButton />
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Users" value={stats.total_users ?? 0} subtitle="Total platform users" />
        <StatCard title="Applicants" value={stats.total_applicants ?? 0} subtitle="Total applicants" />
        <StatCard title="Applications" value={stats.total_applications ?? 0} subtitle="Total applications" />
        <StatCard title="New today" value={stats.new_today ?? 0} subtitle="Applicants created today" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Recent Applicants</h2>
          <RecentApplicants initial={recent} />
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">ID</th>
                  <th className="py-2">Username</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Roles</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-400">No users found</td>
                  </tr>
                )}
                {users.map((u:any) => (
                  <tr key={u.id} className="border-t">
                    <td className="py-2">{u.id}</td>
                    <td className="py-2">{u.username}</td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{(u.roles || []).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
