"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

function NewApplicantForm() {
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [passport_number, setPassportNumber] = useState("");

  // Qualification fields (optional - for ElevenLabs dynamic variables)
  const [highest_qualification, setHighestQualification] = useState("");
  const [qualification_marks, setQualificationMarks] = useState("");
  const [english_test_scores, setEnglishTestScores] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const searchParams = useSearchParams();
  const leadId = searchParams ? searchParams.get("leadId") : null;

  useEffect(() => {
    if (leadId) {
      // Fetch lead details to pre-fill all fields including qualification details
      apiFetch(`/api/leads/${leadId}/`)
        .then((lead) => {
          if (lead) {
            // Basic info
            setFirstName(lead.name ? lead.name.split(" ")[0] : "");
            setLastName(lead.name ? lead.name.split(" ").slice(1).join(" ") : "");
            setEmail(lead.email || "");
            setPhone(lead.phone || "");
            // Qualification details (if available from lead)
            setHighestQualification(lead.highest_qualification || "");
            setQualificationMarks(lead.qualification_marks || "");
            setEnglishTestScores(lead.english_test_scores || "");
          }
        })
        .catch((err) => console.error("Failed to fetch lead details", err));
    }
  }, [leadId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const payload: any = {
        first_name,
        last_name,
        email,
        phone,
        dob: dob || null,
        passport_number,
        // Optional qualification fields for ElevenLabs
        highest_qualification: highest_qualification || null,
        qualification_marks: qualification_marks || null,
        english_test_scores: english_test_scores || null,
      };

      if (leadId) {
        payload.leadId = leadId;
      }

      const res = await apiFetch("/api/applicants/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res) {
        setMessage("Applicant created successfully");
        // Optionally reset form or redirect
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setDob("");
        setPassportNumber("");
        setHighestQualification("");
        setQualificationMarks("");
        setEnglishTestScores("");
      }
    } catch (err: any) {
      setMessage("Error: " + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--cy-navy)]">Create New Applicant</h1>
        <p className="text-[var(--cy-text-secondary)] mt-1">Add a new applicant to your system</p>
      </div>

      <div className="card p-6">
        {message && (
          <div className={`mb-4 p-3 rounded ${message.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="first_name" className="label">
                First Name *
              </label>
              <input
                required
                value={first_name}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="last_name" className="label">
                Last Name
              </label>
              <input
                value={last_name}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="email" className="label">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="dob" className="label">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="passport_number" className="label">
                Passport Number
              </label>
              <input
                value={passport_number}
                onChange={(e) => setPassportNumber(e.target.value)}
                placeholder="Passport number"
                className="input"
              />
            </div>
          </div>

          {/* Qualification Details Section */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-[var(--cy-navy)] mb-4">
              Qualification Details <span className="text-sm font-normal text-[var(--cy-text-muted)]">(Optional - for AI calls)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="highest_qualification" className="label">
                  Highest Qualification
                </label>
                <input
                  value={highest_qualification}
                  onChange={(e) => setHighestQualification(e.target.value)}
                  placeholder="e.g., B.Tech, 12th, Diploma"
                  className="input"
                />
                <p className="text-xs text-[var(--cy-text-muted)] mt-1">Used for AI agent personalization</p>
              </div>

              <div>
                <label htmlFor="qualification_marks" className="label">
                  Marks/Percentage
                </label>
                <input
                  value={qualification_marks}
                  onChange={(e) => setQualificationMarks(e.target.value)}
                  placeholder="e.g., 85%, CGPA 8.5"
                  className="input"
                />
                <p className="text-xs text-[var(--cy-text-muted)] mt-1">Academic performance</p>
              </div>

              <div>
                <label htmlFor="english_test_scores" className="label">
                  English Test Scores
                </label>
                <input
                  value={english_test_scores}
                  onChange={(e) => setEnglishTestScores(e.target.value)}
                  placeholder="e.g., IELTS 7.5, PTE 65"
                  className="input"
                />
                <p className="text-xs text-[var(--cy-text-muted)] mt-1">IELTS, PTE, TOEFL, etc.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <a
              href="/applicants"
              className="btn btn-outline"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Saving..." : "Create Applicant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewApplicantPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <NewApplicantForm />
      </Suspense>
    </DashboardLayout>
  );
}
