import { redirect } from "next/navigation";

import { getSupabaseUserRole } from "@/lib/supabase/server";

export default async function AdminPage() {
  const userRole = await getSupabaseUserRole();

  if (!userRole || userRole.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="admin-shell">
      <h1>Admin dashboard</h1>
      <p>Authenticated admin access is active.</p>
    </main>
  );
}
