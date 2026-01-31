"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

function NewApplicationForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const applicantId = searchParams ? searchParams.get("applicantId") : null;

    const [applicants, setApplicants] = useState<any[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState(applicantId || "");
    const [program, setProgram] = useState("");
    const [status, setStatus] = useState("pending");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        // Fetch leads for the dropdown
        apiFetch("/api/leads/")
            .then((data) => {
                setApplicants(Array.isArray(data) ? data : data.results || []);
            })
            .catch((err) => console.error("Failed to load leads", err));
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        if (!selectedApplicant) {
            setMessage("Error: Please select an applicant");
            setLoading(false);
            return;
        }

        try {
            const payload = {
                applicant: selectedApplicant,
                program,
                status,
            };

            const res = await apiFetch("/api/applications/", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            if (res) {
                setMessage("Application started successfully");
                setTimeout(() => {
                    router.push(`/applications/${res.id}`);
                }, 1000);
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
                <h1 className="text-2xl font-bold text-[var(--cy-navy)]">Start New Application</h1>
                <p className="text-[var(--cy-text-secondary)] mt-1">Create a new application for a student</p>
            </div>

            <div className="card p-6">
                {message && (
                    <div className={`mb-4 p-3 rounded ${message.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="applicant" className="label">
                            Applicant *
                        </label>
                        <select
                            required
                            value={selectedApplicant}
                            onChange={(e) => setSelectedApplicant(e.target.value)}
                            className="select w-full"
                        >
                            <option value="">Select an applicant</option>
                            {applicants.map((app) => (
                                <option key={app.id} value={app.id}>
                                    {app.first_name} {app.last_name} ({app.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="program" className="label">
                            Program Name *
                        </label>
                        <input
                            required
                            value={program}
                            onChange={(e) => setProgram(e.target.value)}
                            placeholder="e.g. Bachelor of Computer Science"
                            className="input"
                        />
                    </div>



                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="btn btn-outline"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                        >
                            {loading ? "Creating..." : "Create Application"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function NewApplicationPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<div className="p-6">Loading...</div>}>
                <NewApplicationForm />
            </Suspense>
        </DashboardLayout>
    );
}
