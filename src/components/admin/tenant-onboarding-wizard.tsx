"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  Workflow,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  Shield,
  LogIn,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

interface MasterTemplate {
  id: string;
  name: string;
  description: string | null;
}

interface TenantOnboardingWizardProps {
  templates: MasterTemplate[];
}

export function TenantOnboardingWizard({ templates }: TenantOnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Business Details
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [customPassword, setCustomPassword] = useState("");

  // Step 2: Commercial Terms
  const [negotiatedPrice, setNegotiatedPrice] = useState<number>(3500);
  const [billingCycleDay, setBillingCycleDay] = useState<number>(1);
  const [billingNotes, setBillingNotes] = useState("");

  // Step 3: Automations Setup
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(
    templates.map((t) => t.id)
  );

  // Step 4: AI Setup
  const [aiProvider, setAiProvider] = useState<string>("openrouter");
  const [aiModel, setAiModel] = useState<string>("deepseek/deepseek-chat");
  const [aiSystemPrompt, setAiSystemPrompt] = useState("");

  // Result / Handover
  const [createdData, setCreatedData] = useState<{
    account: { id: string; name: string };
    credentials: {
      email: string;
      password: string;
      businessName: string;
      ownerName: string;
      loginUrl: string;
    };
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!businessName.trim()) {
        setErrorMsg("Please enter the business name.");
        return;
      }
      if (!ownerEmail.trim() || !ownerEmail.includes("@")) {
        setErrorMsg("Please provide a valid owner email address.");
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await fetch("/api/admin/tenants/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          ownerName,
          ownerEmail,
          ownerPhone,
          password: customPassword.trim() || undefined,
          negotiatedPriceInr: Number(negotiatedPrice),
          billingCycleDay: Number(billingCycleDay),
          billingNotes,
          templateIds: selectedTemplates,
          aiProvider,
          aiModel,
          aiSystemPrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onboarding failed");

      setCreatedData(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to onboard client");
    } finally {
      setSubmitting(false);
    }
  };

  const getHandoverText = () => {
    if (!createdData) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://wapp.yourdomain.com";
    return `🎉 Welcome to WAPP Automation CRM!

Here are your account credentials for ${createdData.account.name}:

🔗 Login Portal: ${origin}/login
📧 Email: ${createdData.credentials.email}
🔑 Temporary Password: ${createdData.credentials.password}

Please log in and update your password under Settings. Reach out if you need any assistance!`;
  };

  const handleCopyHandover = () => {
    navigator.clipboard.writeText(getHandoverText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWorkspace = async () => {
    if (!createdData) return;
    try {
      setImpersonating(true);
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: createdData.account.id }),
      });
      if (!res.ok) throw new Error("Failed to start impersonation");
      window.location.href = "/dashboard";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to enter workspace");
      setImpersonating(false);
    }
  };

  // SUCCESS / HANDOVER SCREEN
  if (createdData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mb-2">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {createdData.account.name} Onboarded Successfully!
          </h1>
          <p className="text-sm text-muted-foreground">
            The tenant account is active, automations are cloned, and credentials have been generated.
          </p>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Client Credentials &amp; Handover Note</span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 gap-1.5"
                onClick={handleCopyHandover}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied to Clipboard!" : "Copy Handover Note"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <pre className="p-4 rounded-lg bg-muted/40 border border-border text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap select-all">
              {getHandoverText()}
            </pre>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/10 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/tenants/${createdData.account.id}`)}
              className="w-full sm:w-auto"
            >
              View in Tenant Control Center
            </Button>

            <Button
              onClick={handleOpenWorkspace}
              disabled={impersonating}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white font-semibold"
            >
              {impersonating ? (
                <RotateCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              Open Workspace &amp; Connect WhatsApp
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <Link
          href="/admin/tenants"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Onboard New Client</h1>
          <p className="text-xs text-muted-foreground">
            Set up a client business, assign automations, configure AI, and generate login credentials.
          </p>
        </div>
      </div>

      {/* Wizard Step Indicators */}
      <div className="grid grid-cols-4 gap-2 border-b border-border pb-4 text-xs font-medium">
        {[
          { num: 1, title: "1. Business Profile", icon: Building2 },
          { num: 2, title: "2. Negotiated Billing", icon: CreditCard },
          { num: 3, title: "3. Automations", icon: Workflow },
          { num: 4, title: "4. AI Engine", icon: Bot },
        ].map((s) => {
          const Icon = s.icon;
          const active = step === s.num;
          const passed = step > s.num;
          return (
            <div
              key={s.num}
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                active
                  ? "border-amber-500 bg-amber-500/10 text-amber-400 font-semibold"
                  : passed
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">{s.title}</span>
            </div>
          );
        })}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-400">
          {errorMsg}
        </div>
      )}

      {/* STEP 1: BUSINESS PROFILE */}
      {step === 1 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Business &amp; Owner Information
            </CardTitle>
            <CardDescription className="text-xs">
              Primary business identity and owner contact for login delivery
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Business Name *</label>
              <Input
                placeholder="e.g. Acme Properties or Urban Dental Care"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Client Owner Full Name</label>
                <Input
                  placeholder="e.g. Ramesh Patel"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Client Owner Email *</label>
                <Input
                  type="email"
                  placeholder="ramesh@acmeproperties.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">WhatsApp Phone Number</label>
                <Input
                  placeholder="e.g. +91 98765 43210"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Temporary Password (optional)
                </label>
                <Input
                  type="text"
                  placeholder="Leave blank to auto-generate secure password"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: NEGOTIATED BILLING */}
      {step === 2 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-400" /> Commercial &amp; Negotiated Pricing
            </CardTitle>
            <CardDescription className="text-xs">
              What this specific client has agreed to pay per month
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Negotiated Monthly Price (₹ INR) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="500"
                  value={negotiatedPrice}
                  onChange={(e) => setNegotiatedPrice(Number(e.target.value))}
                  className="font-mono text-base font-semibold"
                />
                <p className="text-[11px] text-muted-foreground">The client sees this single monthly bill.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Monthly Billing Cycle Day
                </label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={billingCycleDay}
                  onChange={(e) => setBillingCycleDay(Number(e.target.value))}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">Day of each month the charge recurs.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Agreed Scope / Deliverables</label>
              <Textarea
                placeholder="e.g. Includes lead generation flow, appointments bot, 2 WhatsApp agents, 5k monthly broadcasts."
                value={billingNotes}
                onChange={(e) => setBillingNotes(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: AUTOMATIONS SETUP */}
      {step === 3 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Workflow className="h-4 w-4 text-amber-400" /> Pre-Install Master Flow Templates
            </CardTitle>
            <CardDescription className="text-xs">
              Select which master templates will be cloned directly into this tenant account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.length > 0 ? (
              templates.map((tpl) => {
                const isSelected = selectedTemplates.includes(tpl.id);
                return (
                  <div
                    key={tpl.id}
                    onClick={() => toggleTemplate(tpl.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-amber-500/60 bg-amber-500/5 text-foreground"
                        : "border-border bg-card hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-amber-500 bg-amber-500 text-black"
                          : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-foreground">{tpl.name}</div>
                      {tpl.description && (
                        <div className="text-xs text-muted-foreground">{tpl.description}</div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                No master templates created yet. You can assign flows later.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: AI SETUP */}
      {step === 4 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> Tenant AI Configuration
            </CardTitle>
            <CardDescription className="text-xs">
              Pre-configure the AI chatbot engine for this client
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">AI Provider</label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs"
                >
                  <option value="openrouter">OpenRouter (DeepSeek, Claude, Llama)</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="anthropic">Anthropic (Claude Direct)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Model Identifier</label>
                <Input
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="e.g. deepseek/deepseek-chat or gpt-4o-mini"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Custom System Prompt / Business Persona
              </label>
              <Textarea
                placeholder={`You are the WhatsApp assistant for ${businessName || "this company"}. Greet visitors warmly and help answer their questions...`}
                value={aiSystemPrompt}
                onChange={(e) => setAiSystemPrompt(e.target.value)}
                rows={4}
                className="text-sm resize-none"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wizard Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1 || submitting}
          className="gap-1.5 text-xs"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {step < 4 ? (
          <Button
            onClick={handleNext}
            className="bg-amber-600 hover:bg-amber-500 text-white gap-1.5 text-xs"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 text-xs shadow-md"
          >
            {submitting ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" /> Provisioning Business...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Onboard &amp; Provision Business
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

