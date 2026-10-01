"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import AdminDashboard from "./AdminDashboard";

export default function AdminDashboardRoute({ adminName }: { adminName: string }) {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const verifyAdminSession = async () => {
      try {
        const response = await fetch("/api/auth", { cache: "no-store", credentials: "same-origin" });
        const result = await response.json() as { user?: { role?: string } | null };
        if (mounted && result.user?.role !== "admin") router.replace("/");
      } catch {
        // Keep the page available during a temporary network interruption.
      }
    };
    const handleFocus = () => { if (!document.hidden) void verifyAdminSession(); };
    void verifyAdminSession();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      mounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [router]);

  const handleSignOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  return <AdminDashboard onSignOut={handleSignOut} adminName={adminName} />;
}
