"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditApplicantRedirectPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    useEffect(() => {
        if (id) {
            router.push(`/crm/leads/${id}/edit`);
        }
    }, [id, router]);

    return (
        <div className="flex items-center justify-center h-screen">
            <p className="text-gray-600">Redirecting...</p>
        </div>
    );
}
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
