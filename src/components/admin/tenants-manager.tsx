"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Search,
  LogIn,
  Workflow,
  CheckCircle2,
  XCircle,
  Phone,
  PowerOff,
  Power,
  RotateCw,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TenantRow {
  id: string;
  name: string;
  status: string;
  plan_tier: string;
  created_at: string;
  whatsapp_phone?: string | null;
}

export interface TemplateFlow {
  id: string;
  name: string;
  description: string | null;
}

interface TenantsManagerProps {
  initialTenants: TenantRow[];
  templates: TemplateFlow[];
}

export function TenantsManager({ initialTenants, templates }: TenantsManagerProps) {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>(initialTenants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Assign Flow Dialog state
  const [assignDialogAccount, setAssignDialogAccount] = useState<TenantRow | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id ?? ""
  );
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Filtered list
  const filtered = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Action: Impersonate
  const handleImpersonate = async (account: TenantRow) => {
    try {
      setLoadingId(account.id);
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      if (!res.ok) {
        throw new Error("Failed to impersonate");
      }
      // Redirect to client dashboard in tenant's context
      window.location.href = "/dashboard";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Impersonation failed");
      setLoadingId(null);
    }
  };

  // Action: Toggle Status (Activate / Suspend)
  const handleToggleStatus = async (account: TenantRow) => {
    const nextStatus = account.status === "active" ? "suspended" : "active";
    const confirmMsg =
      nextStatus === "suspended"
        ? `Are you sure you want to suspend "${account.name}"? They will lose access to WhatsApp messaging.`
        : `Reactivate "${account.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      setLoadingId(account.id);
      const res = await fetch(`/api/admin/tenants/${account.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      setTenants((prev) =>
        prev.map((item) =>
          item.id === account.id ? { ...item, status: nextStatus } : item
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating account status");
    } finally {
      setLoadingId(null);
    }
  };

  // Action: Assign Flow
  const handleAssignFlow = async () => {
    if (!assignDialogAccount || !selectedTemplateId) return;
    try {
      setAssigning(true);
      setAssignSuccess(null);
      const res = await fetch("/api/admin/automations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateFlowId: selectedTemplateId,
          targetAccountId: assignDialogAccount.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign flow");

      setAssignSuccess(
        `Flow assigned successfully to ${assignDialogAccount.name}!`
      );
      setTimeout(() => {
        setAssignDialogAccount(null);
        setAssignSuccess(null);
      }, 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign flow");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search, Filters, and New Client Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search business name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {["all", "active", "suspended", "past_due"].map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
                className="text-xs capitalize h-8"
              >
                {status === "all" ? "All Accounts" : status.replace("_", " ")}
              </Button>
            ))}
          </div>

          <Link
            href="/admin/tenants/new"
            className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-500 transition-colors shrink-0 h-8 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Onboard Client
          </Link>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">WhatsApp Number</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length > 0 ? (
                filtered.map((tenant) => {
                  const isLoading = loadingId === tenant.id;
                  return (
                    <tr key={tenant.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/tenants/${tenant.id}`}
                              className="font-medium text-foreground hover:text-amber-400 hover:underline transition-colors block truncate"
                            >
                              {tenant.name}
                            </Link>
                            <div className="text-[11px] text-muted-foreground font-mono truncate">{tenant.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="capitalize text-xs font-medium">
                          {tenant.plan_tier || "starter"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        {tenant.whatsapp_phone ? (
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-mono">
                            <Phone className="h-3.5 w-3.5 text-emerald-500" />
                            {tenant.whatsapp_phone}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not connected</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {tenant.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="h-3 w-3" />
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View / Manage Tenant Detail */}
                          <Link
                            href={`/admin/tenants/${tenant.id}`}
                            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2.5 h-8 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                            title="Manage Tenant Details & Automations"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-amber-400" />
                            Manage
                          </Link>

                          {/* Assign Automation Flow */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => {
                              setAssignDialogAccount(tenant);
                              setAssignSuccess(null);
                            }}
                            title="Assign Master Flow"
                          >
                            <Workflow className="h-3.5 w-3.5 mr-1 text-amber-400" />
                            Assign Flow
                          </Button>

                          {/* Impersonate Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/15"
                            onClick={() => handleImpersonate(tenant)}
                            disabled={isLoading}
                            title="Open Tenant Dashboard as Admin"
                          >
                            {isLoading ? (
                              <RotateCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <LogIn className="h-3.5 w-3.5 mr-1" />
                                Impersonate
                              </>
                            )}
                          </Button>

                          {/* Suspend / Reactivate */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-8 w-8 p-0 ${
                              tenant.status === "active"
                                ? "text-muted-foreground hover:text-rose-400"
                                : "text-emerald-400 hover:text-emerald-300"
                            }`}
                            onClick={() => handleToggleStatus(tenant)}
                            disabled={isLoading}
                            title={tenant.status === "active" ? "Suspend Account" : "Reactivate Account"}
                          >
                            {tenant.status === "active" ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No businesses match your search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Flow Dialog */}
      <Dialog
        open={Boolean(assignDialogAccount)}
        onOpenChange={(open) => !open && setAssignDialogAccount(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-amber-400" />
              Assign Master Flow
            </DialogTitle>
            <DialogDescription>
              Clone a master automation flow into{" "}
              <strong>{assignDialogAccount?.name}</strong>. It will be added to their account ready to activate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {templates.length > 0 ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Select Master Flow Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.description ? `— ${tpl.description}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-md border border-amber-500/20">
                No master templates exist yet. Create a flow with <code>is_template = true</code> in Master Automations.
              </p>
            )}

            {assignSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20">
                {assignSuccess}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAssignDialogAccount(null)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignFlow}
              disabled={assigning || templates.length === 0}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {assigning ? "Cloning..." : "Assign to Tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

