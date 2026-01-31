"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ApplicantDetailRedirectPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    useEffect(() => {
        if (id) {
            router.push(`/crm/leads/${id}`);
        }
    }, [id, router]);

    return (
        <div className="flex items-center justify-center h-screen">
            <p className="text-gray-600">Redirecting...</p>
        </div>
    );
}

