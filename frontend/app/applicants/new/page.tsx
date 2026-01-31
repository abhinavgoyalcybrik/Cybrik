"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewApplicantRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/crm/leads/new");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-600">Redirecting...</p>
    </div>
  );
}
