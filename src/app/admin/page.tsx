import { redirect } from "next/navigation";

import { getMongoUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getMongoUser();

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="admin-shell">
      <h1>Admin dashboard</h1>
      <p>Authenticated admin access is active.</p>
    </main>
  );
}
