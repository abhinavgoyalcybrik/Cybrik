"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

function EditApplicantForm() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [first_name, setFirstName] = useState("");
    const [last_name, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [dob, setDob] = useState("");
    const [passport_number, setPassportNumber] = useState("");
    const [address, setAddress] = useState("");
    const [country_of_interest, setCountryOfInterest] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (id) {
            apiFetch(`/api/applicants/${id}/`)
                .then((data) => {
                    if (data) {
                        setFirstName(data.first_name || "");
                        setLastName(data.last_name || "");
                        setEmail(data.email || "");
                        setPhone(data.phone || "");
                        setDob(data.dob || "");
                        setPassportNumber(data.passport_number || "");
                        setAddress(data.address || "");
                        setCountryOfInterest(data.preferred_country || "");
                    }
                })
                .catch((err) => setMessage("Failed to load applicant: " + err.message))
                .finally(() => setLoading(false));
        }
    }, [id]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage("");
        try {
            const payload = {
                first_name,
                last_name,
                email,
                phone,
                dob: dob || null,
                passport_number,
                address,
                preferred_country: country_of_interest,
                metadata: {
                    // Keep other metadata if needed, but address/country are now top-level
                }
            };

            await apiFetch(`/api/applicants/${id}/`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });

            setMessage("Applicant updated successfully");
            setTimeout(() => {
                router.push(`/applicants/${id}`);
            }, 1000);
        } catch (err: any) {
            setMessage("Error: " + (err.message || JSON.stringify(err)));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="p-6">Loading...</div>;
    }

    return (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--cy-navy)]">Edit Applicant</h1>
                <p className="text-[var(--cy-text-secondary)] mt-1">Update applicant information</p>
            </div>

            <div className="card p-6">
                {message && (
                    <div className={`mb-4 p-3 rounded ${message.startsWith('Error') || message.startsWith('Failed') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
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


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="address" className="label">
                                Address
                            </label>
                            <input
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Full Address"
                                className="input"
                            />
                        </div>

                        <div>
                            <label htmlFor="country_of_interest" className="label">
                                Preferred Country
                            </label>
                            <input
                                value={country_of_interest}
                                onChange={(e) => setCountryOfInterest(e.target.value)}
                                placeholder="e.g. USA, UK, Canada"
                                className="input"
                            />
                        </div>
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
                            disabled={saving}
                            className="btn btn-primary"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}

export default function EditApplicantPage() {
    return (
        <DashboardLayout>
            <EditApplicantForm />
        </DashboardLayout>
    );
}
