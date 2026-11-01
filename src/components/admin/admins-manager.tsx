"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Trash2,
  Copy,
  Check,
  RotateCw,
  Mail,
  User,
  Shield,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  admin_role: string | null;
  created_at: string;
}

interface AdminsManagerProps {
  initialAdmins: AdminUser[];
  currentAdminEmail?: string;
}

export function AdminsManager({ initialAdmins, currentAdminEmail }: AdminsManagerProps) {
  const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Add form state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("super_admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result modal for new user credentials
  const [createdAdminResult, setCreatedAdminResult] = useState<{
    email: string;
    temporaryPassword?: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAddAdmin = async () => {
    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, role, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add administrator");

      setAdmins((prev) => [
        ...prev.filter((a) => a.email !== data.admin.email),
        {
          id: data.admin.id,
          email: data.admin.email,
          full_name: data.admin.fullName,
          admin_role: data.admin.role,
          created_at: new Date().toISOString(),
        },
      ]);

      setDialogOpen(false);
      setEmail("");
      setFullName("");
      setPassword("");

      if (data.admin.isNewUser && data.admin.temporaryPassword) {
        setCreatedAdminResult({
          email: data.admin.email,
          temporaryPassword: data.admin.temporaryPassword,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add administrator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeAdmin = async (targetAdmin: AdminUser) => {
    if (
      !confirm(
        `Are you sure you want to revoke platform administrator access from ${targetAdmin.email}?`
      )
    ) {
      return;
    }

    try {
      setRevokingId(targetAdmin.id);
      const res = await fetch(`/api/admin/admins/${targetAdmin.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke access");

      setAdmins((prev) => prev.filter((a) => a.id !== targetAdmin.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke admin");
    } finally {
      setRevokingId(null);
    }
  };

  const copyCredentials = () => {
    if (!createdAdminResult) return;
    const text = `WAPP Administrator Access Granted
URL: ${window.location.origin}/login
Email: ${createdAdminResult.email}
Password: ${createdAdminResult.temporaryPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            Platform Administrators
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage who has access to the Super Admin control center and configure roles
          </p>
        </div>

        <Button
          onClick={() => {
            setErrorMsg(null);
            setDialogOpen(true);
          }}
          className="bg-amber-600 hover:bg-amber-500 text-white gap-1.5 text-xs font-semibold"
        >
          <UserPlus className="h-4 w-4" /> Add Administrator
        </Button>
      </div>

      {/* Admins Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Administrator</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Granted Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {admins.map((adm) => {
              const isCurrent = adm.email.toLowerCase() === currentAdminEmail?.toLowerCase();
              const isRevoking = revokingId === adm.id;
              return (
                <tr key={adm.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-foreground flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <span>{adm.full_name || "Platform Admin"}</span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        You
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                    {adm.email}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant="outline" className="capitalize text-xs font-medium border-amber-500/30 text-amber-400">
                      {adm.admin_role || "super_admin"}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">
                    {new Date(adm.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      disabled={isCurrent || isRevoking}
                      onClick={() => handleRevokeAdmin(adm)}
                      title={isCurrent ? "You cannot revoke your own account" : "Revoke Super Admin Access"}
                    >
                      {isRevoking ? (
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke Access
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Admin Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" /> Add Platform Administrator
            </DialogTitle>
            <DialogDescription>
              Grant Super Admin or specialized operational access to a team member.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email Address *</label>
              <Input
                type="email"
                placeholder="colleague@yourcompany.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Full Name</label>
              <Input
                placeholder="e.g. Priya Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Admin Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs"
              >
                <option value="super_admin">Super Admin (Full Platform Access)</option>
                <option value="operations_admin">Operations Admin (Tenants &amp; Automations)</option>
                <option value="billing_admin">Billing Admin (Custom Pricing &amp; Payments)</option>
                <option value="support_admin">Support Admin (Diagnostics &amp; Inspection)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Initial Password (optional)
              </label>
              <Input
                type="text"
                placeholder="Leave blank to auto-generate secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAdmin}
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {submitting ? <RotateCw className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Grant Admin Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Handover Dialog for New Admin */}
      <Dialog open={!!createdAdminResult} onOpenChange={() => setCreatedAdminResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-5 w-5" /> Administrator Created
            </DialogTitle>
            <DialogDescription>
              A new platform administrator account has been created. Save or send these credentials now.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2 text-xs font-mono select-all">
            <div><strong>Email:</strong> {createdAdminResult?.email}</div>
            <div><strong>Password:</strong> {createdAdminResult?.temporaryPassword}</div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={copyCredentials}
              className="gap-1.5 text-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
            <Button onClick={() => setCreatedAdminResult(null)} size="sm">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

