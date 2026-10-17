import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return <AdminDashboard />;
}
