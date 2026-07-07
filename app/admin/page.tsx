"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminSiteForm, { AdminSite } from "@/components/AdminSiteForm";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  const [site, setSite] = useState<AdminSite | null | undefined>(undefined);

  useEffect(() => {
    const raw = localStorage.getItem("cooltime_admin_site");
    if (raw) {
      try {
        setSite(JSON.parse(raw));
      } catch {
        setSite(null);
      }
    } else {
      setSite(null);
    }
  }, []);

  if (site === undefined) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!site) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-100 to-slate-50 px-4">
        <Link href="/" className="text-sm font-medium text-sky-600 underline">
          ← 처음으로
        </Link>
        <AdminSiteForm onReady={setSite} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <AdminDashboard site={site} onExit={() => setSite(null)} />
    </main>
  );
}
