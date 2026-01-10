import apiFetch from "@/lib/api";

export async function convertLeadToApplicant(lead: any) {
  const payload = {
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: "lead",
    notes: lead.notes ?? "",
  };
  return await apiFetch("/api/applicants/", { method: "POST", body: JSON.stringify(payload) });
}
