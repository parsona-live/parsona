import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import {
  MessageSquare,
  Workflow,
  Kanban,
  Bot,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

interface LandingPageViewProps {
  user?: User | null
}

export function LandingPageView({ user }: LandingPageViewProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* 1. Header / Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">
              WAPP <span className="text-xs font-normal text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">CRM</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#automations" className="hover:text-white transition">Automations</a>
            <a href="#security" className="hover:text-white transition">Security</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white transition"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium mb-6">
          <Zap className="h-3.5 w-3.5" />
          <span>Official Meta WhatsApp Cloud API Integration</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl text-white leading-tight">
          Scale your business on WhatsApp with a{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Shared Inbox & Automations
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl">
          Collaborate on a single number, manage visual sales pipelines, broadcast approved templates, and automate customer journeys with zero per-seat fees.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href={user ? "/dashboard" : "/signup"}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/20 transition"
          >
            {user ? "Open Your Workspace" : "Start Free Workspace"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-base font-medium transition"
          >
            Explore Platform
          </a>
        </div>

        {/* Feature Checkmarks */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Multi-Agent Inbox
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Visual Flow Builder
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> AI Reply & RAG Knowledge Base
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Complete Data Ownership
          </span>
        </div>
      </section>

      {/* 3. Core Features Grid */}
      <section id="features" className="py-20 border-t border-slate-900 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Engineered for Modern WhatsApp Teams
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Everything your sales, support, and marketing teams need in one self-hosted platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Shared Inbox</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Multi-agent collaboration on one WhatsApp number with chat assignment, tags, internal notes, and media mirroring.
              </p>
            </div>

            {/* Feature 2 */}
            <div id="automations" className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition">
              <div className="h-10 w-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4">
                <Workflow className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Visual Flows</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Design interactive customer journeys using visual nodes: interactive buttons, lists, conditional routing, and webhooks.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                <Kanban className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Sales Pipelines</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Drag-and-drop Kanban deal board linked directly to your active WhatsApp chats to track conversion from lead to deal close.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">AI Assistant & RAG</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Connect OpenAI or Anthropic keys to draft context-aware answers from your indexed documents with seamless human handoff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Security & Data Ownership */}
      <section id="security" className="py-16 border-t border-slate-900">
        <div className="max-w-5xl mx-auto px-6 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950 p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-6">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Enterprise Security & Zero Data Lock-In
          </h2>
          <p className="mt-4 text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
            Your tokens and credentials are encrypted using AES-256-GCM. Row Level Security guarantees data isolation between accounts, and all messages stream directly to your database.
          </p>
          <div className="mt-8">
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition"
            >
              Get Started Now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="mt-auto border-t border-slate-900 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} WAPP. Self-hostable WhatsApp CRM & Automations.</p>
      </footer>
    </div>
  )
}

