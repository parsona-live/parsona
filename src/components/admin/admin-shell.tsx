"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Workflow,
  Activity,
  ShieldAlert,
  ArrowRightLeft,
  LogOut,
  Menu,
  X,
  CreditCard,
} from "lucide-react";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface AdminShellProps {
  children: React.ReactNode;
  userEmail?: string;
  adminName?: string;
}

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants & Businesses", icon: Building2 },
  { href: "/admin/automations", label: "Master Automations", icon: Workflow },
  { href: "/admin/billing", label: "Billing & Plans", icon: CreditCard },
  { href: "/admin/system", label: "System & Routing", icon: Activity },
];

export function AdminShell({ children, userEmail, adminName }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-0 max-lg:-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                WAPP <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Admin</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Platform Control</div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 text-muted-foreground hover:text-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-500/15 text-amber-400 font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-amber-400" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Workspace Switcher & User Profile */}
        <div className="border-t border-border p-3 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Switch to Client App
            </span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">/dashboard</span>
          </Link>

          <div className="flex items-center justify-between pt-2 px-1">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-medium text-foreground truncate">{adminName || "Super Admin"}</div>
              <div className="text-[11px] text-muted-foreground truncate">{userEmail}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="text-sm font-semibold text-foreground">
              Super Admin Console
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ModeToggle />
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

