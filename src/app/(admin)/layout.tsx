import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/account";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Super Admin — WAPP",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    redirect("/dashboard");
  }

  return (
    <AdminShell
      userEmail={admin.email}
      adminName={admin.profile.fullName}
    >
      {children}
    </AdminShell>
  );
}

