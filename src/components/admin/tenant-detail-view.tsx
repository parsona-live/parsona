"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Workflow,
  Phone,
  CreditCard,
  Bot,
  Users,
  ChevronLeft,
  LogIn,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  Save,
  RotateCw,
  Sparkles,
  Shield,
  FileText,
  Clock,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TenantDetailData {
  account: {
    id: string;
    name: string;
    status: string;
    plan_tier: string;
    created_at: string;
    negotiated_price_inr?: number;
    billing_cycle_day?: number;
    billing_status?: string;
    billing_notes?: string | null;
    internal_notes?: string | null;
    max_contacts?: number;
    max_broadcasts_per_month?: number;
    ai_messages_quota?: number;
  };
  whatsappConfig: {
    phone_number: string | null;
    phone_number_id: string | null;
    waba_id: string | null;
    status: string | null;
  } | null;
  flows: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    trigger_type?: string;
    created_at: string;
    updated_at: string;
  }>;
  aiConfig: {
    provider?: string;
    model?: string;
    system_prompt?: string;
    is_enabled?: boolean;
  } | null;
  members: Array<{
    id: string;
    email: string;
    full_name: string | null;
    account_role: string;
    created_at: string;
  }>;
  templates: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  stats: {
    contactsCount: number;
    messagesCount: number;
    flowsCount: number;
  };
}

export function TenantDetailView({ initialData }: { initialData: TenantDetailData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "automations" | "whatsapp" | "billing" | "ai" | "team">("overview");
  const [account, setAccount] = useState(initialData.account);
  const [flows, setFlows] = useState(initialData.flows);
  const [aiConfig, setAiConfig] = useState(initialData.aiConfig || {
    provider: "openrouter",
    model: "deepseek/deepseek-chat",
    system_prompt: "",
    is_enabled: true,
  });
  const [aiApiKey, setAiApiKey] = useState("");

  // Billing form state
  const [negotiatedPrice, setNegotiatedPrice] = useState<number>(account.negotiated_price_inr ?? 0);
  const [billingCycleDay, setBillingCycleDay] = useState<number>(account.billing_cycle_day ?? 1);
  const [billingStatus, setBillingStatus] = useState<string>(account.billing_status ?? "active");
  const [billingNotes, setBillingNotes] = useState<string>(account.billing_notes ?? "");
  const [internalNotes, setInternalNotes] = useState<string>(account.internal_notes ?? "");

  // Loading & status states
  const [savingBilling, setSavingBilling] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [togglingFlowId, setTogglingFlowId] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Template clone dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialData.templates[0]?.id ?? "");
  const [assigningTemplate, setAssigningTemplate] = useState(false);

  const showToast = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Action: Impersonate
  const handleImpersonate = async () => {
    try {
      setImpersonating(true);
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      if (!res.ok) throw new Error("Failed to impersonate");
      window.location.href = "/dashboard";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Impersonation failed");
      setImpersonating(false);
    }
  };

  // Action: Toggle Account Active/Suspended
  const handleToggleAccountStatus = async () => {
    const nextStatus = account.status === "active" ? "suspended" : "active";
    if (!confirm(`Are you sure you want to ${nextStatus === "suspended" ? "suspend" : "reactivate"} this account?`)) return;
    try {
      const res = await fetch(`/api/admin/tenants/${account.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setAccount({ ...account, status: nextStatus });
      showToast(`Account marked as ${nextStatus}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Status update failed");
    }
  };

  // Action: Toggle Flow Active / Inactive
  const handleToggleFlow = async (flowId: string, currentStatus: string) => {
    try {
      setTogglingFlowId(flowId);
      const nextStatus = currentStatus === "active" ? "draft" : "active";
      const res = await fetch(`/api/admin/tenants/${account.id}/flows/${flowId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to toggle flow");
      const data = await res.json();
      setFlows(flows.map((f) => (f.id === flowId ? { ...f, status: data.flow.status } : f)));
      showToast(`Automation flow is now ${nextStatus}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle flow");
    } finally {
      setTogglingFlowId(null);
    }
  };

  // Action: Assign Master Template
  const handleAssignTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      setAssigningTemplate(true);
      const res = await fetch("/api/admin/automations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          targetAccountId: account.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to clone template");
      const data = await res.json();
      if (data.flowId) {
        showToast("Master automation cloned into tenant successfully!");
        setAssignDialogOpen(false);
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to clone template");
    } finally {
      setAssigningTemplate(false);
    }
  };

  // Action: Save Negotiated Billing
  const handleSaveBilling = async () => {
    try {
      setSavingBilling(true);
      const res = await fetch(`/api/admin/tenants/${account.id}/billing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negotiated_price_inr: Number(negotiatedPrice),
          billing_cycle_day: Number(billingCycleDay),
          billing_status: billingStatus,
          billing_notes: billingNotes,
          internal_notes: internalNotes,
        }),
      });
      if (!res.ok) throw new Error("Failed to save billing");
      const data = await res.json();
      setAccount({ ...account, ...data.account });
      showToast("Custom negotiated billing updated successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save billing");
    } finally {
      setSavingBilling(false);
    }
  };

  // Action: Save AI Config
  const handleSaveAi = async () => {
    try {
      setSavingAi(true);
      const res = await fetch(`/api/admin/tenants/${account.id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiConfig.provider,
          model: aiConfig.model,
          systemPrompt: aiConfig.system_prompt,
          isEnabled: aiConfig.is_enabled,
          apiKey: aiApiKey.trim() !== "" ? aiApiKey : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save AI configuration");
      showToast("Tenant AI settings saved!");
      setAiApiKey("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save AI configuration");
    } finally {
      setSavingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm text-white shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-4 w-4" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Header Breadcrumbs & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/tenants"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{account.name}</h1>
              {account.status === "active" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <XCircle className="h-3 w-3" /> Suspended
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">ID: {account.id}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Impersonate */}
          <Button
            variant="outline"
            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/15"
            onClick={handleImpersonate}
            disabled={impersonating}
          >
            {impersonating ? (
              <RotateCw className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <LogIn className="h-4 w-4 mr-1.5" />
            )}
            Open Workspace (Impersonate)
          </Button>

          {/* Toggle Status */}
          <Button
            variant="ghost"
            className={account.status === "active" ? "text-rose-400 hover:bg-rose-500/10" : "text-emerald-400 hover:bg-emerald-500/10"}
            onClick={handleToggleAccountStatus}
          >
            {account.status === "active" ? (
              <>
                <PowerOff className="h-4 w-4 mr-1.5" /> Suspend
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-1.5" /> Reactivate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border overflow-x-auto pb-px">
        {[
          { id: "overview", label: "Overview", icon: Building2 },
          { id: "automations", label: `Automations (${flows.length})`, icon: Workflow },
          { id: "whatsapp", label: "WhatsApp Gateway", icon: Phone },
          { id: "billing", label: "Negotiated Billing", icon: CreditCard },
          { id: "ai", label: "AI Configuration", icon: Bot },
          { id: "team", label: `Team Members (${initialData.members.length})`, icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                active
                  ? "border-amber-500 text-amber-400 bg-amber-500/5 font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="bg-card/70 border-border">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Contacts Base</CardDescription>
                <CardTitle className="text-2xl font-bold">{initialData.stats.contactsCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">Registered WhatsApp contacts</div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Total Workflows</CardDescription>
                <CardTitle className="text-2xl font-bold">{flows.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {flows.filter((f) => f.status === "active").length} currently active
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Negotiated Fee</CardDescription>
                <CardTitle className="text-2xl font-bold text-amber-400">
                  ₹{Number(account.negotiated_price_inr ?? 0).toLocaleString("en-IN")}/mo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">Billed on day {account.billing_cycle_day ?? 1} of month</div>
              </CardContent>
            </Card>
          </div>

          {/* Business & Internal Notes */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Business Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Business Name</span>
                  <span className="font-medium text-foreground">{account.name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Registered On</span>
                  <span className="font-medium text-foreground">
                    {new Date(account.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">WhatsApp Connected</span>
                  <span className="font-medium text-foreground">
                    {initialData.whatsappConfig?.phone_number || "Not connected"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Max Contacts Quota</span>
                  <span className="font-medium text-foreground">
                    {account.max_contacts ?? 5000} contacts
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-400" /> Admin Internal Notes
                </CardTitle>
                <CardDescription className="text-xs">Private notes visible only to Super Admins</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Record client requirements, negotiated terms, special instructions..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  className="text-sm resize-none"
                />
              </CardContent>
              <CardFooter className="flex justify-end pt-0">
                <Button
                  size="sm"
                  onClick={handleSaveBilling}
                  disabled={savingBilling}
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                >
                  {savingBilling ? <RotateCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Save Notes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMATIONS */}
      {activeTab === "automations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Client Automations & Chatbots</h2>
              <p className="text-xs text-muted-foreground">
                Manage, activate, or deactivate flows for {account.name} directly from this panel.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setAssignDialogOpen(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Clone Master Template
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Automation Flow</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Direct Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flows.length > 0 ? (
                  flows.map((flow) => {
                    const isToggling = togglingFlowId === flow.id;
                    const isActive = flow.status === "active";
                    return (
                      <tr key={flow.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-foreground">{flow.name}</div>
                          {flow.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-sm">
                              {flow.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                          {flow.trigger_type || "keywords"}
                        </td>
                        <td className="py-3.5 px-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                              Draft / Paused
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground">
                          {new Date(flow.updated_at || flow.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant={isActive ? "outline" : "default"}
                            className={`h-8 text-xs ${
                              isActive
                                ? "border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white"
                            }`}
                            onClick={() => handleToggleFlow(flow.id, flow.status)}
                            disabled={isToggling}
                          >
                            {isToggling ? (
                              <RotateCw className="h-3 w-3 animate-spin mr-1" />
                            ) : isActive ? (
                              <PowerOff className="h-3 w-3 mr-1" />
                            ) : (
                              <Power className="h-3 w-3 mr-1" />
                            )}
                            {isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No automations installed for this business yet. Click &quot;Clone Master Template&quot; to assign one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WHATSAPP GATEWAY */}
      {activeTab === "whatsapp" && (
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-500" /> WhatsApp Integration Status
              </CardTitle>
              <CardDescription className="text-xs">
                Meta Cloud API or WhatsApp QR Gateway connection for this client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground mb-1">Connected Phone Number</div>
                  <div className="text-base font-semibold font-mono text-foreground">
                    {initialData.whatsappConfig?.phone_number || "Not connected"}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground mb-1">Gateway Status</div>
                  <div className="text-base font-semibold">
                    {initialData.whatsappConfig?.phone_number ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Connected & Ready
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <XCircle className="h-4 w-4" /> Disconnected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {initialData.whatsappConfig && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-muted-foreground">Phone Number ID</span>
                    <span className="font-mono text-foreground">{initialData.whatsappConfig.phone_number_id || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-muted-foreground">WABA ID</span>
                    <span className="font-mono text-foreground">{initialData.whatsappConfig.waba_id || "N/A"}</span>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-amber-300 border-amber-500/30"
                onClick={handleImpersonate}
              >
                <LogIn className="h-3.5 w-3.5 mr-1.5" /> Connect WhatsApp via Client Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* TAB 4: NEGOTIATED BILLING */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-amber-400" /> Commercial & Billing Terms
              </CardTitle>
              <CardDescription className="text-xs">
                Set custom negotiated monthly charges. The client will only see this negotiated fee in their billing settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Negotiated Monthly Fee (₹ INR)</label>
                  <Input
                    type="number"
                    min="0"
                    step="500"
                    value={negotiatedPrice}
                    onChange={(e) => setNegotiatedPrice(Number(e.target.value))}
                    placeholder="e.g. 5000"
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">What the client pays monthly</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Billing Cycle Day</label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={billingCycleDay}
                    onChange={(e) => setBillingCycleDay(Number(e.target.value))}
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">Day of month invoice is generated</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Billing Status</label>
                  <select
                    value={billingStatus}
                    onChange={(e) => setBillingStatus(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs"
                  >
                    <option value="active">Active (Paid / Current)</option>
                    <option value="pending_setup">Pending Initial Setup</option>
                    <option value="payment_due">Payment Due</option>
                    <option value="overdue">Overdue / Grace Period</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">Current standing of this business</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Billing Notes / Contract Scope</label>
                <Textarea
                  placeholder="e.g. Agreement includes 10k messages, custom lead bot, 2 human agents. Signed on 01/11."
                  value={billingNotes}
                  onChange={(e) => setBillingNotes(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-border pt-4">
              <Button
                onClick={handleSaveBilling}
                disabled={savingBilling}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {savingBilling ? <RotateCw className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save Commercial Terms
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* TAB 5: AI CONFIGURATION */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" /> Tenant AI Engine Setup
              </CardTitle>
              <CardDescription className="text-xs">
                Configure OpenRouter, OpenAI, or Anthropic specifically for this client&apos;s auto-replies and bots.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">AI Provider</label>
                  <select
                    value={aiConfig.provider || "openrouter"}
                    onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs"
                  >
                    <option value="openrouter">OpenRouter (DeepSeek, Claude, Llama)</option>
                    <option value="openai">OpenAI (ChatGPT)</option>
                    <option value="anthropic">Anthropic (Claude Direct)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Model Identifier</label>
                  <Input
                    value={aiConfig.model || ""}
                    onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                    placeholder="e.g. deepseek/deepseek-chat or gpt-4o-mini"
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">API Key (Optional override)</label>
                <Input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="Leave blank to preserve current key or use global platform key"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Business Persona &amp; Instructions</label>
                <Textarea
                  value={aiConfig.system_prompt || ""}
                  onChange={(e) => setAiConfig({ ...aiConfig, system_prompt: e.target.value })}
                  placeholder="You are an AI assistant representing {account.name}. Answer customer inquiries politely in English/Hindi..."
                  rows={5}
                  className="text-sm resize-none"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-border pt-4">
              <Button
                onClick={handleSaveAi}
                disabled={savingAi}
                className="bg-amber-600 hover:bg-amber-500 text-white"
              >
                {savingAi ? <RotateCw className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save AI Settings
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* TAB 6: TEAM MEMBERS */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialData.members.length > 0 ? (
                  initialData.members.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {member.full_name || "Account Member"}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                        {member.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="capitalize text-xs font-medium">
                          {member.account_role}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No members found for this tenant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Template Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-amber-400" /> Clone Master Automation
            </DialogTitle>
            <DialogDescription>
              Select a master automation template to clone directly into <strong>{account.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-foreground">Select Master Template</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs"
            >
              {initialData.templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} {tpl.description ? `— ${tpl.description}` : ""}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignTemplate}
              disabled={assigningTemplate || !selectedTemplateId}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {assigningTemplate ? <RotateCw className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Clone into Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

