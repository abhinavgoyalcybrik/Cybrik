// frontend/components/LogoutButton.tsx
"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    try {
      await fetch("/api/auth/logout/", { method: "POST", credentials: "include" });
    } catch (e) {
      console.error(e);
    } finally {
      router.push("/crm/login");
    }
  }

  return (
    <button onClick={onLogout} className="px-3 py-2 rounded bg-red-50 text-red-700 border">
      Logout
    </button>
  );
}
