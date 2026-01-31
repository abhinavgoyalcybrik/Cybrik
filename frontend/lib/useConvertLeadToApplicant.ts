import apiFetch from "@/lib/api";

export async function convertLeadToApplicant(lead: any) {
  // Convert Lead to Application instead (Applicant model deprecated)
  // This now creates an Application from a Lead
  const payload = {
    lead_id: lead.id,
    program: lead.interested_service || "General",
    status: "pending"
  };
  return await apiFetch("/api/applications/", { method: "POST", body: JSON.stringify(payload) });
}
