"use client";

import { useRouter } from "next/navigation";

import AdminDashboard from "./AdminDashboard";

export default function AdminDashboardRoute() {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  return <AdminDashboard onSignOut={handleSignOut} />;
}