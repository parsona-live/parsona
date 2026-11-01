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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Business Profile & Knowledge
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your business identity, appointment booking links, working hours, and knowledge documentation for WhatsApp Flows and AI.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Details
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knowledge Docs & FAQs
          </TabsTrigger>
          <TabsTrigger value="integration" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Flows & AI Guide
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile Form */}
        <TabsContent value="profile" className="space-y-4">
          <BusinessProfileForm />
        </TabsContent>

        {/* Tab 2: Knowledge Docs (RAG) */}
        <TabsContent value="docs" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle>Business Knowledge Base</CardTitle>
              </div>
              <CardDescription>
                Add documentation, pricing lists, services, and FAQs. The AI assistant uses these documents to answer customer inquiries on WhatsApp with exact facts.
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
        <TabsContent value="integration" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-primary" />
                  <CardTitle>Using with WhatsApp Flows</CardTitle>
                </div>
                <CardDescription>
                  How your business profile connects to interactive flow automations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  1. <strong>Appointment Booking</strong>: When building flows in{' '}
                  <Link href="/flows" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                    Flows <ExternalLink className="h-3 w-3" />
                  </Link>
                  , use interactive buttons to offer your Cal.com / Calendly booking link configured in your Company Details.
                </p>
                <p>
                  2. <strong>Lead Qualification</strong>: Use <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">Collect Input</code> nodes to ask for name, email, and preferred service before sending the booking confirmation.
                </p>
                <p>
                  3. <strong>Automatic Handoff</strong>: When a customer needs human assistance, the flow automatically changes status to <strong>Pending</strong> in your shared Inbox.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle>Using with AI Auto-Reply</CardTitle>
                </div>
                <CardDescription>
                  How the AI uses your profile and documentation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  1. <strong>Zero-Guessing Answers</strong>: When customers ask questions like <em>"What are your prices?"</em> or <em>"What are your hours?"</em>, the AI auto-retrieves excerpts from the <strong>Knowledge Docs</strong> tab.
                </p>
                <p>
                  2. <strong>Autonomous Booking Guidance</strong>: The AI knows your booking URL and will direct clients to schedule an appointment when they ask to book.
                </p>
                <p>
                  3. <strong>Test in Playground</strong>: Test your AI agent with your new business knowledge in the{' '}
                  <Link href="/agents" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                    AI Playground <ExternalLink className="h-3 w-3" />
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

