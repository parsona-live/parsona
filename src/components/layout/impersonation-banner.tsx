"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner() {
  const { isSuperAdmin, account } = useAuth();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [exiting, setExiting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof document !== "undefined") {
      const hasCookie = document.cookie.includes("wapp_impersonate_account_id=");
      setIsImpersonating(hasCookie && isSuperAdmin);
    }
  }, [isSuperAdmin]);

  if (!isImpersonating) return null;

  const handleExit = async () => {
    try {
      setExiting(true);
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      router.push("/admin/tenants");
      router.refresh();
    } catch {
      setExiting(false);
    }
  };

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs sm:text-sm flex items-center justify-between z-50">
      <div className="flex items-center gap-2 font-medium">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
        <span>
          Viewing as <strong className="text-amber-100">{account?.name ?? "Tenant"}</strong> (Super Admin Mode)
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExit}
        disabled={exiting}
        className="h-7 text-xs border-amber-500/40 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
      >
        <LogOut className="h-3.5 w-3.5 mr-1" />
        {exiting ? "Exiting..." : "Exit Impersonation"}
      </Button>
    </div>
  );
}

