"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApplicantsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to leads page - Applicant model deprecated
    router.push("/crm/leads");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-600">Redirecting to Leads...</p>
    </div>
  );
}