'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  BookOpen,
  Workflow,
  Sparkles,
  ExternalLink,
  Bot,
  Zap,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BusinessProfileForm } from '@/components/business/business-profile-form'
import { AiKnowledgeCard } from '@/components/settings/ai-knowledge'
import { useAuth } from '@/hooks/use-auth'
import { canEditSettings } from '@/lib/auth/roles'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'

export default function BusinessProfilePage() {
  const { accountId, accountRole } = useAuth()
  const canEdit = accountRole ? canEditSettings(accountRole) : false
  const [hasEmbeddingsKey, setHasEmbeddingsKey] = useState(false)

  useEffect(() => {
    async function checkAi() {
      try {
        const res = await fetch('/api/ai/config')
        const data = await res.json()
        if (data?.has_embeddings_key) {
          setHasEmbeddingsKey(true)
        }
      } catch {
        // silent
      }
    }
    checkAi()
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Business Profile & Knowledge
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your business identity, appointment booking links, working hours, and knowledge documentation for Flows and AI.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-5">
        <TabsList className="h-9 rounded-md border border-border bg-muted/40 p-0.5">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 rounded-sm px-3 text-xs font-medium">
            <Building2 className="h-3.5 w-3.5" />
            Company Details
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-1.5 rounded-sm px-3 text-xs font-medium">
            <BookOpen className="h-3.5 w-3.5" />
            Knowledge Docs & FAQs
          </TabsTrigger>
          <TabsTrigger value="integration" className="flex items-center gap-1.5 rounded-sm px-3 text-xs font-medium">
            <Workflow className="h-3.5 w-3.5" />
            Flows & AI Guide
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile Form */}
        <TabsContent value="profile" className="space-y-4">
          <BusinessProfileForm />
        </TabsContent>

        {/* Tab 2: Knowledge Docs (RAG) */}
        <TabsContent value="docs" className="space-y-4">
          <Card className="rounded-lg border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Business Knowledge Base</CardTitle>
              </div>
              <CardDescription>
                Add documentation, pricing lists, services, and FAQs. The AI assistant uses these documents to answer customer inquiries with exact facts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiKnowledgeCard
                accountId={accountId}
                canEdit={canEdit}
                hasEmbeddingsKey={hasEmbeddingsKey}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Integration Guide */}
        <TabsContent value="integration" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-lg border-border">
              <CardHeader className="border-b border-border/60 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/12 text-blue-500">
                      <Workflow className="h-3.5 w-3.5" />
                    </span>
                    <CardTitle className="text-sm font-semibold">Using with Flows</CardTitle>
                  </div>
                  <Link
                    href="/flows"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Open Flows <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <CardDescription className="text-xs">
                  How your business profile connects to interactive flow automations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-xs leading-relaxed text-muted-foreground">
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-muted/50 font-mono text-[11px] font-semibold text-foreground">1</span>
                  <p>
                    <strong className="text-foreground">Appointment Booking</strong> — Use interactive buttons in Flows to offer your Cal.com / Calendly booking link configured in Company Details.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-muted/50 font-mono text-[11px] font-semibold text-foreground">2</span>
                  <p>
                    <strong className="text-foreground">Lead Qualification</strong> — Use <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">Collect Input</code> nodes to ask for name, email, and preferred service before sending booking confirmation.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-muted/50 font-mono text-[11px] font-semibold text-foreground">3</span>
                  <p>
                    <strong className="text-foreground">Automatic Handoff</strong> — When a customer needs human assistance, the flow automatically sets conversation status to <strong className="text-foreground">Pending</strong> in your shared Inbox.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-border">
              <CardHeader className="border-b border-border/60 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/12 text-emerald-500">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <CardTitle className="text-sm font-semibold">Using with AI Auto-Reply</CardTitle>
                  </div>
                  <Link
                    href="/agents"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    AI Playground <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <CardDescription className="text-xs">
                  How the AI assistant uses your profile and knowledge docs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-xs leading-relaxed text-muted-foreground">
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-muted/50 font-mono text-[11px] font-semibold text-foreground">1</span>
                  <p>
                    <strong className="text-foreground">Zero-Guessing Answers</strong> — When customers ask about pricing or hours, the AI retrieves exact excerpts from the <strong className="text-foreground">Knowledge Docs</strong> tab.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-muted/50 font-mono text-[11px] font-semibold text-foreground">2</span>
                  <p>
                    <strong className="text-foreground">Autonomous Booking Guidance</strong> — The AI knows your booking URL and directs clients to schedule when they ask to book.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-muted/50 font-mono text-[11px] font-semibold text-foreground">3</span>
                  <p>
                    <strong className="text-foreground">Test in Playground</strong> — Verify your AI agent responses with your updated business knowledge in the AI Playground.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

