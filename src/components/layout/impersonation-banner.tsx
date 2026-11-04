"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function ImpersonationBanner() {
  const { account } = useAuth();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [tenantName, setTenantName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("owner");
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";").map((c) => c.trim());
      const hasFlag = cookies.some(
        (c) => c.startsWith("wapp_is_impersonating=") || c.startsWith("wapp_impersonate_account_id=")
      );
      setIsImpersonating(hasFlag);

      const nameCookie = cookies.find((c) => c.startsWith("wapp_impersonated_tenant_name="));
      if (nameCookie) {
        try {
          const val = nameCookie.split("=")[1];
          setTenantName(decodeURIComponent(val));
        } catch {}
      }

      const emailCookie = cookies.find((c) => c.startsWith("wapp_impersonated_user_email="));
      if (emailCookie) {
        try {
          const val = emailCookie.split("=")[1];
          setUserEmail(decodeURIComponent(val));
        } catch {}
      }

      const roleCookie = cookies.find((c) => c.startsWith("wapp_impersonated_user_role="));
      if (roleCookie) {
        setUserRole(roleCookie.split("=")[1]);
      }
    }
  }, []);

  if (!isImpersonating) return null;

  const displayTenantName = tenantName || account?.name || "Tenant";

  const handleExit = async () => {
    try {
      setExiting(true);
      const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        window.location.href = "/admin/tenants";
      }
    } catch {
      window.location.href = "/admin/tenants";
    }
  };

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs sm:text-sm flex items-center justify-between z-50 sticky top-0 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-2 font-medium">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="flex items-center flex-wrap gap-1">
          <span>Viewing as</span>
          <strong className="text-amber-100 font-semibold">{displayTenantName}</strong>
          {userEmail ? (
            <span className="text-amber-300/80 hidden sm:inline">
              ({userRole}: {userEmail})
            </span>
          ) : null}
          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] uppercase tracking-wider font-semibold border border-amber-500/30">
            Super Admin Impersonation
          </span>
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExit}
        disabled={exiting}
        className="h-7 text-xs border-amber-500/40 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100 font-medium"
      >
        <LogOut className="h-3.5 w-3.5 mr-1.5" />
        {exiting ? "Exiting..." : "Exit Impersonation"}
      </Button>
    </div>
  );
}
