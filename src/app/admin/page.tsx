import { redirect } from "next/navigation";

import { getMongoUser } from "@/lib/auth";
import AdminDashboardRoute from "./AdminDashboardRoute";

export default async function AdminPage() {
  const user = await getMongoUser();

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <AdminDashboardRoute />;
}
