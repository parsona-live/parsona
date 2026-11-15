# WAPP (WhatsApp CRM & Automation Platform) — Comprehensive Codebase Review & Reference

**File Version:** 1.0.0  
**Project Name:** `wacrm` (Publicly known as **WAPP**)  
**Current Release:** v0.8.0  
**Repository:** [https://github.com/ArnasDon/wacrm](https://github.com/ArnasDon/wacrm)  
**License:** MIT  
**Primary Target Platform:** Meta WhatsApp Business Cloud API (Graph API v21.0)  

---

## 1. Executive Summary & Purpose

**WAPP** is an open-source, enterprise-ready, self-hostable Customer Relationship Management (CRM) and automation engine designed exclusively for businesses operating on WhatsApp. 

It solves high per-seat SaaS fees and vendor lock-in by providing a modern multi-tenant application that interfaces directly with Meta's official WhatsApp Business Cloud API. Teams can collaborate on a single WhatsApp Business phone number with granular role-based access control, manage contacts and sales pipelines, send template broadcasts, visually design no-code automations and conversational flows, and harness AI assistance (OpenAI, Anthropic, or OpenAI-compatible models) backed by a pgvector knowledge base.

---

## 2. Technology Stack & Architectural Standards

### 2.1 Core Stack

| Layer | Technologies & Libraries | Purpose |
|---|---|---|
| **Web Framework** | **Next.js 16.3.8** (React Server Components, App Router, Route Handlers, Server Actions, Middleware) | Fullstack application foundation, hybrid rendering, and API layer. |
| **Frontend UI** | **React 19.2.4**, **Base UI** (`@base-ui/react` ^1.9.0), **Shadcn UI**, **Tailwind CSS v4** (`@tailwindcss/postcss`, `tw-animate-css`) | Component library, headless primitives, accessible UI, and modern styling. |
| **Icons & Media** | **Lucide React** (`lucide-react` ^1.55.0), **Sonner** (Toasts), **Opus Recorder** (Voice note recording) | Modern iconography, accessible notifications, audio encoding for WhatsApp voice notes. |
| **Workflow Canvas** | **@xyflow/react** (^12.12.0 / React Flow), **@dagrejs/dagre** (^3.1.1) | Visual drag-and-drop conversational flow editor and automatic graph layouting. |
| **Kanban & DnD** | **@dnd-kit/core**, **@dnd-kit/sortable**, **@dnd-kit/utilities** | Fluid, accessible drag-and-drop interactions for deals across pipeline stages. |
| **Charts & Analytics**| **Recharts** (^3.10.1) | Data visualization for message volumes, response times, and conversion funnels. |
| **Database & Auth** | **Supabase** (`@supabase/supabase-js` ^2.118.0, `@supabase/ssr` ^0.12.7, PostgreSQL 15+) | Authentication, Row Level Security (RLS), Realtime subscriptions, pgvector, and S3-compatible Storage buckets. |
| **Internationalization** | **next-intl** (^4.14.9) | Multi-locale support (`en`, `es`, `pt`, `ko`) across UI and validation strings. |
| **Security & Crypto** | Node.js `crypto` (AES-256-GCM, HMAC-SHA256, timingSafeEqual) | Secure encryption for Meta API tokens, AI credentials, and webhook validation. |
| **Developer API & MCP**| REST (`/api/v1`) with SHA-256 hashed keys, **Model Context Protocol** (`@modelcontextprotocol/sdk` ^1.31.0) | Third-party integrations and native AI coding assistant tool calling. |
| **Testing & Quality** | **Vitest** (^5.0.5), **TypeScript 6**, **ESLint 9**, **Prettier 3** | High test coverage (unit/integration tests adjacent to code files), strict type safety. |
| **Runtime & Container**| **Node.js >= 22.12.0**, **Docker** (multi-stage), **Docker Compose** | Production deployment and reproducible local runtime. |

---

## 3. High-Level Architecture & Tenancy Model

```
                    +-------------------------------------------------------+
                    |                      End Users                        |
                    |           (Web Dashboard / Next.js 16 Client)         |
                    +---------------------------+---------------------------+
                                                |
                                                v
                    +-------------------------------------------------------+
                    |              Next.js Middleware                       |
                    |     (Token Rotation Preservation & Route Guards)      |
                    +---------------------------+---------------------------+
                                                |
            +-----------------------------------+-----------------------------------+
            |                                   |                                   |
            v                                   v                                   v
+-----------------------+           +-----------------------+           +-----------------------+
| App Router (UI Pages) |           | Internal API Handlers |           | Public REST API (/v1) |
| - Inbox & Live Chat   |           | - WhatsApp Webhook In |           | - Scoped API Keys     |
| - Contacts & Pipeline |           | - Automations & Flows |           | - Contacts & Messages |
| - Broadcast Campaigns |           | - AI Reply & Indexing |           | - Broadcasts & Hooks  |
| - Settings & Members  |           | - Media Mirrors       |           | - MCP Server Bridge   |
+-----------+-----------+           +-----------+-----------+           +-----------+-----------+
            |                                   |                                   |
            +-----------------------------------+-----------------------------------+
                                                |
                                                v
            +-----------------------------------------------------------------------+
            |                  Service Layer & Engine Utilities                     |
            |   - Meta Cloud API Client (Named parameter interfaces)                |
            |   - AES-256-GCM Crypto Vault (WABA tokens, BYOK AI keys)              |
            |   - SSRF-Guarded Outbound Webhook Dispatcher                          |
            |   - Deduplication Engine (Normalized Phone / BSUID / Usernames)       |
            |   - Flow & Automation State Machines                                  |
            |   - AI RAG Engine (Hybrid Keyword + pgvector Search)                  |
            +-----------------------------------+-----------------------------------+
                                                |
                                                v
            +-----------------------------------------------------------------------+
            |                      Supabase / PostgreSQL                            |
            |   - 59 Schema Migrations with Strict Foreign Keys                     |
            |   - Row Level Security (RLS) scoped to `account_id`                   |
            |   - Role Evaluation: is_account_member(account_id, min_role)          |
            |   - pgvector extension for AI embeddings                              |
            |   - Storage Buckets: `avatars`, `chat-media`, `flow-media`            |
            +-----------------------------------+-----------------------------------+
                                                |
                                                v
                    +-------------------------------------------------------+
                    |             Meta WhatsApp Cloud API (v21.0)           |
                    |           (Messages, Media, Templates, Health)        |
                    +-------------------------------------------------------+
```

### 3.1 Multi-Tenancy & Role-Based Access Control (RBAC)

Tenancy is structured strictly by **Account** (`017_account_sharing.sql`):
- All operational data (`contacts`, `conversations`, `messages`, `pipelines`, `deals`, `broadcasts`, `automations`, `flows`, `quick_replies`, `api_keys`, `webhook_endpoints`) belongs to an `account_id`.
- Users authenticate via Supabase Auth and link to an account via `account_members` and their `profiles` row.
- **Role Hierarchy (Ordinal Rank):**
  1. **Owner (`4`)**: Complete governance, billing, account deletion, transferring ownership.
  2. **Admin (`3`)**: Full settings management, member invites, WhatsApp config, AI settings, template creation.
  3. **Agent (`2`)**: Operational agent — send messages, resolve conversations, create contacts, manage deals, trigger broadcasts.
  4. **Viewer (`1`)**: Read-only oversight — can inspect inbox, contacts, and reports without write capability.
- **Security Check Mechanism:**
  - TypeScript predicates located in [`src/lib/auth/roles.ts`](file:///d:/All%20Projects/Company%20Projects/parsona/src/lib/auth/roles.ts) (`canManageMembers`, `canEditSettings`, `canSendMessages`, `canViewOnly`).
  - Database RLS function `is_account_member(account_id, min_role)` mirroring the same ordinal rank.

---

## 4. Directory Structure & Codebase Map

```
parsona/
├── .github/                       # GitHub Actions workflows & CI scripts
├── docs/                          # Developer & operational guides
│   ├── auth-emails.md             # Custom email redirection and Supabase auth setup
│   ├── docker.md                  # Docker build and multi-stage container guide
│   ├── fix-full-reload.md         # Hot reload and development environment notes
│   ├── mcp.md                     # Model Context Protocol setup and usage
│   ├── multi-waba.md              # Multiple WhatsApp Business Accounts guide
│   ├── public-api.md              # Public REST API v1 reference and schemas
│   └── whatsapp-connection-troubleshooting.md # Meta API setup and webhook debugging
├── mcp-server/                    # Standalone Model Context Protocol (MCP) server
│   ├── src/
│   │   ├── tools/                 # Read, write, and broadcast tools for AI agents
│   │   ├── client.ts              # API client wrapper
│   │   ├── config.ts              # Configuration loader
│   │   └── index.ts               # MCP server startup and handler registration
│   ├── package.json
│   └── tsconfig.json
├── messages/                      # Translation catalogs (next-intl)
│   ├── en.json                    # English translations
│   ├── es.json                    # Spanish translations
│   ├── ko.json                    # Korean translations
│   └── pt.json                    # Portuguese (BR) translations
├── public/                        # Static web assets, logos, and icons
├── src/
│   ├── app/                       # Next.js App Router root
│   │   ├── (auth)/                # Unauthenticated authentication routes
│   │   │   ├── forgot-password/
│   │   │   ├── login/
│   │   │   ├── reset-password/
│   │   │   ├── signup/
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/           # Authenticated application workspace
│   │   │   ├── agents/            # Team members overview
│   │   │   ├── automations/       # Trigger-action automations builder & history
│   │   │   ├── broadcasts/        # Outbound bulk template campaigns
│   │   │   ├── contacts/          # Contact CRM directory, custom fields & notes
│   │   │   ├── dashboard/         # Real-time analytics, charts & KPIs
│   │   │   ├── flows/             # React Flow visual conversation builder
│   │   │   ├── inbox/             # Multi-agent shared WhatsApp conversation inbox
│   │   │   ├── notifications/     # Notifications center (assignment alerts)
│   │   │   ├── pipelines/         # Kanban sales pipeline & deal management
│   │   │   ├── settings/          # Account, WhatsApp, AI, Template & API settings
│   │   │   ├── dashboard-shell.tsx
│   │   │   └── layout.tsx
│   │   ├── api/                   # Server API route handlers
│   │   │   ├── account/           # Account management, invitations, membership
│   │   │   ├── ai/                # AI draft, auto-reply, indexing, playground
│   │   │   ├── automations/       # Automations execution engine & cron
│   │   │   ├── contacts/          # Tagging and contact mutations
│   │   │   ├── flows/             # Flow execution engine, triggers & cron
│   │   │   ├── invitations/       # Invite token peeking & redemption
│   │   │   ├── quick-replies/     # Quick reply snippet management
│   │   │   ├── v1/                # Public Developer REST API
│   │   │   └── whatsapp/          # Meta webhook ingestion, send API, media proxy
│   │   ├── join/                  # Public invite acceptance route
│   │   ├── globals.css            # Tailwind CSS v4 directives & theme variables
│   │   ├── layout.tsx             # Root HTML layout with next-intl & providers
│   │   ├── middleware.ts          # Auth gate & cookie-preserving session middleware
│   │   └── page.tsx               # Root redirect to /dashboard or /login
│   ├── components/                # Modular React 19 UI components
│   │   ├── agents/                # Agent lists and invitation dialogs
│   │   ├── auth/                  # Login, registration, password forms
│   │   ├── automations/           # Automation rule editor & run history
│   │   ├── broadcasts/            # Broadcast wizard, audience picker, campaign metrics
│   │   ├── contacts/              # Contact list, filter bar, CSV import/export dialog
│   │   ├── dashboard/             # Analytics cards, charts, activity feeds
│   │   ├── flows/                 # React Flow node palette, edge renderer, inspector
│   │   ├── inbox/                 # Chat bubbles, composer, interactive menu builders
│   │   ├── interactive/           # WhatsApp button and list row preview cards
│   │   ├── layout/                # Sidebar, header, navigation, presence badge
│   │   ├── notifications/         # In-app notification center drawer
│   │   ├── pipelines/             # Drag-and-drop Kanban columns & deal modals
│   │   ├── presence/              # Live user avatar indicators
│   │   ├── settings/              # WABA config, AI keys, templates, webhooks
│   │   ├── tremor/                # Tailored analytical cards & metric widgets
│   │   ├── ui/                    # Shadcn / Base UI headless primitives
│   │   └── themed-toaster.tsx     # Sonner alert toaster wrapper
│   ├── hooks/                     # Custom React hooks
│   │   ├── use-auth.tsx           # Authentication state context
│   │   ├── use-broadcast-sending.ts # Polling & progress of live broadcasts
│   │   ├── use-browser-notifications.ts # Web Push & audio notification triggers
│   │   ├── use-can.ts             # Capability & role checks in client components
│   │   ├── use-media-blob-url.ts  # Cached authenticated media fetcher
│   │   ├── use-presence.ts        # Realtime presence broadcasting & heartbeat
│   │   ├── use-realtime.ts        # Supabase postgres_changes subscription manager
│   │   ├── use-theme.tsx          # Light/dark mode toggle
│   │   ├── use-total-unread.ts    # Unread counter computation
│   │   └── use-unread-notifications.ts # Badge count manager
│   ├── i18n/                      # Internationalization setup (request & routing)
│   ├── lib/                       # Core business logic & backend services
│   │   ├── account/               # Account CRUD and transfer RPCs
│   │   ├── ai/                    # LLM engine, RAG search, embeddings, usage limits
│   │   ├── api/                   # Standardized JSON response helpers
│   │   ├── api-keys/              # API key hashing (SHA-256) and permission scopes
│   │   ├── auth/                  # RBAC definitions and predicate guards
│   │   ├── automations/           # Automations trigger matcher and execution runner
│   │   ├── contacts/              # Phone deduplication, normalizer, CSV tools
│   │   ├── conversations/         # Thread lifecycle, reopening, assignment
│   │   ├── dashboard/             # Aggregation queries for dashboard statistics
│   │   ├── flows/                 # Graph parsing, Dagre layout, runtime engine
│   │   ├── inbox/                 # Message status transitions and read markers
│   │   ├── media/                 # Supabase Storage mirroring & signed URLs
│   │   ├── notifications/         # Notification generator for team members
│   │   ├── pipelines/             # Pipeline stages and deal transition logic
│   │   ├── quick-replies/         # Text and interactive button templates
│   │   ├── settings/              # Settings validation and persistence
│   │   ├── storage/               # Supabase storage helpers
│   │   ├── supabase/              # Supabase server, client, admin, and SSR setups
│   │   ├── webhooks/              # Outbound webhook delivery with SSRF guards
│   │   └── whatsapp/              # Meta Cloud API, encryption, templates, signatures
│   └── types/                     # TypeScript definitions
│       ├── index.ts               # Complete domain types, DB interfaces & enums
│       └── opus-recorder.d.ts     # Voice recording type declarations
├── supabase/
│   ├── ci/                        # Schema verification SQL for CI
│   ├── migrations/                # 59 incremental SQL migrations
│   └── config.toml                # Supabase local environment configuration
├── .editorconfig
├── .gitignore
├── .prettierrc
├── docker-compose.yml             # Container orchestration
├── Dockerfile                     # Multi-stage production container build
├── eslint.config.mjs
├── next.config.ts                 # Next.js 16 configuration
├── package.json
├── tsconfig.json
└── vitest.config.ts               # Unit & integration testing config
```

---

## 5. Detailed Breakdown of Major Features

### 5.1 Shared Team Inbox (`src/app/(dashboard)/inbox`)
- **Multi-Agent Collaboration:** Conversations are assigned to individual agents or round-robin queued.
- **Rich Message Types:** Supports text, images, videos, audio/voice notes (recorded directly via browser with `opus-recorder`), documents, locations, template messages, and interactive buttons/lists.
- **Inbound Media Mirroring (`src/lib/whatsapp/mirror-inbound-media.ts`):** Inbound media from Meta links is automatically copied into Supabase Storage (`chat-media` bucket) to prevent media expiration after Meta's 30-day retention window.
- **Interactive Message Support:** Native support for WhatsApp Interactive Reply Buttons (up to 3 buttons) and Sectioned Lists (up to 10 options). Customer taps return structured payload IDs (`interactive_reply_id`) for deterministic automation routing.
- **Real-Time Presence:** Agents broadcast online status and current conversation viewing via Supabase Realtime channels.
- **Message Reactions:** Send and receive emoji reactions on WhatsApp messages.
- **AI Assist in Composer:** One-click reply drafting using context from the current conversation and indexed knowledge documents.

### 5.2 Contact Management & CRM (`src/app/(dashboard)/contacts`)
- **Multi-Identity Deduplication:** Solves the modern WhatsApp identity dilemma where users may appear with standard E.164 phone numbers, normalized digits (`phone_normalized`), or Meta's newer Business-Scoped User IDs (`wa_user_id` / BSUID) and usernames (`wa_username`).
- **Custom Fields & Values:** Extensible contact schema (`contact_custom_values`) with dynamic custom fields.
- **Contact Tagging:** Color-coded tags with high-performance tag filtering (`025_filter_contacts_by_tags.sql`).
- **Internal Notes:** Timestamped internal notes per contact for team audit.
- **Bulk CSV Import & Export:** Client-side CSV parser and validator with deduplication conflict handling.

### 5.3 Visual Sales Pipelines & Deals (`src/app/(dashboard)/pipelines`)
- **Kanban Board:** Multi-stage drag-and-drop deal board powered by `@dnd-kit`.
- **Linked Context:** Deals link directly to WhatsApp contacts and open conversations.
- **Stage Metrics & Currencies:** Stage summary values, probability weighting, and account-level default currency settings (`021_account_default_currency.sql`).
- **Data Integrity:** Cascading deletes protect historic deals when contacts are removed (`ON DELETE SET NULL`).

### 5.4 Broadcasts & Campaigns (`src/app/(dashboard)/broadcasts`)
- **Meta-Approved Templates:** Direct integration with Meta's Template API (Utility, Marketing, Authentication).
- **Variable Interpolation:** Dynamic replacement of `{{1}}`, `{{2}}` variables from contact fields.
- **Reliable Fan-Out & Resume Engine (`038_broadcast_resume.sql`):** 
  - Uses atomic delivery lease locks (`delivery_locked_at`, `delivery_lease_until`) to prevent double-sends.
  - Automatically captures rate limits and resumes sending stalled broadcasts.
- **Real-Time Delivery Tracking:** Webhook updates mirror status directly onto `broadcast_recipients` (`pending` -> `sent` -> `delivered` -> `read` -> `replied` -> `failed`).

### 5.5 Visual No-Code Automations & Flows
The platform provides two complementary workflow engines:

1. **Trigger-Action Automations (`src/app/(dashboard)/automations`)**:
   - **Triggers:** `new_message_received`, `first_inbound_message`, `keyword_match` (exact, contains, boundary-aware whole word), `new_contact_created`, `conversation_assigned`, `tag_added`, `interactive_reply`, `time_based` (cron).
   - **Actions:** Send message, send interactive buttons/lists, send template, add/remove tags, assign conversation (specific or round-robin), update contact/custom field, create deal, wait delay, conditional branch, dispatch outbound webhook, close conversation.
   - **Execution Logging:** Structured step-by-step logs with execution status (`success`, `partial`, `failed`).

2. **Flows Visual Canvas (`src/app/(dashboard)/flows`)**:
   - Interactive flowchart builder using `@xyflow/react`.
   - Node types: Message, Interactive Buttons, List, Media, Condition, Webhook, Wait delay.
   - Dynamic auto-layout powered by `@dagrejs/dagre`.
   - State machine handles asynchronous user replies and flow run timeouts.

### 5.6 AI Reply Assistant & Knowledge Base (`src/lib/ai`)
- **Bring Your Own Key (BYOK):** Multi-provider support for:
  - **OpenAI** (GPT-4o, GPT-4o-mini, text-embedding-3-small)
  - **Anthropic** (Claude 3.5 Sonnet, Claude 3.5 Haiku)
  - **OpenAI-Compatible Providers** (Local models, Ollama, Groq, Together, DeepSeek)
- **Zero Plaintext Storage:** Keys are encrypted on insertion using AES-256-GCM with `ENCRYPTION_KEY`.
- **Knowledge Base RAG (Retrieval-Augmented Generation):**
  - Document chunking (`src/lib/ai/chunk.ts`).
  - Embeddings generation stored in PostgreSQL with `pgvector` (`030_ai_knowledge.sql`).
  - Hybrid search combines Postgres Full-Text Search (tsvector) with semantic cosine distance vector matching.
- **Autonomous Auto-Reply & Human Handoff:**
  - Automatic reply bot triggers on inbound messages when enabled.
  - Safety caps: Maximum reply count per conversation to prevent loops.
  - Smart Handoff: Model evaluates when human intervention is requested, writes an internal handoff summary, pauses the bot on the thread, and notifies an agent.
  - Token and cost tracking dashboard (`053_ai_reply_integrity.sql`).

### 5.7 Security, Encryption & Network Defenses
- **AES-256-GCM Credential Vault (`src/lib/whatsapp/encryption.ts`):** 32-byte master key with random 12-byte IV and 16-byte authentication tag per encrypted row.
- **HMAC-SHA256 Webhook Verification:** Validates `X-Hub-Signature-256` on every incoming Meta payload using `META_APP_SECRET`.
- **SSRF Protection (`src/lib/webhooks/ssrf.ts`):** Outbound webhook delivery parses destinations through DNS resolution checks, rejecting RFC1918 private IPs, loopback (`127.0.0.1`), link-local (`169.254.0.0/16`), and AWS/cloud metadata endpoints.
- **Next.js Session Token Preservation (`src/middleware.ts`):** Prevents session wedging during Supabase access token rotation by transferring newly issued refresh cookies onto redirect and response headers.

---

## 6. Developer APIs & Extensibility

### 6.1 Public REST API (`/api/v1`)
Authenticated using Bearer tokens generated in **Settings → API Keys**. Keys are prefixed with `wapp_live_` or `wapp_test_` and stored only as SHA-256 hashes.

| Endpoint | Method | Required Scope | Description |
|---|---|---|---|
| `/api/v1/me` | `GET` | `read` | Retrieve current account and API key profile |
| `/api/v1/contacts` | `GET`, `POST` | `contacts:read`, `contacts:write` | List, search, filter, or create contacts |
| `/api/v1/contacts/[id]` | `GET`, `PATCH`, `DELETE` | `contacts:read`, `contacts:write` | Fetch, update, or remove a contact |
| `/api/v1/conversations` | `GET` | `conversations:read` | List conversations with status and unread filters |
| `/api/v1/conversations/[id]` | `GET`, `PATCH` | `conversations:read`, `conversations:write` | Inspect conversation or reassign status/agent |
| `/api/v1/conversations/[id]/messages`| `GET` | `messages:read` | Retrieve chronological message history |
| `/api/v1/messages` | `POST` | `messages:write` | Send text, template, or media message |
| `/api/v1/broadcasts` | `GET`, `POST` | `broadcasts:read`, `broadcasts:write` | List campaigns or launch a new broadcast |
| `/api/v1/broadcasts/[id]` | `GET` | `broadcasts:read` | Get broadcast delivery statistics |
| `/api/v1/webhooks` | `GET`, `POST` | `webhooks:read`, `webhooks:write` | Register and manage outbound webhook endpoints |
| `/api/v1/webhooks/[id]` | `GET`, `DELETE` | `webhooks:read`, `webhooks:write` | Inspect or delete an outbound webhook |

### 6.2 Model Context Protocol (MCP) Server (`mcp-server/`)
The repository contains an independent, standards-compliant MCP server (`@modelcontextprotocol/sdk`) enabling AI agents (e.g., Cursor, Claude Desktop, Antigravity) to manage the WhatsApp CRM directly:
- **Read Tools (`src/tools/read.ts`):** `search_contacts`, `get_conversation`, `get_contact_history`, `list_templates`, `get_pipeline_deals`.
- **Write Tools (`src/tools/write.ts`):** `send_whatsapp_message`, `create_contact`, `update_deal_stage`, `assign_conversation`.
- **Broadcast Tools (`src/tools/broadcast.ts`):** `create_template_broadcast`, `get_broadcast_status`.

---

## 7. Database Architecture & Migration Evolution

The database schema is managed via **59 sequential PostgreSQL migrations** located in [`supabase/migrations/`](file:///d:/All%20Projects/Company%20Projects/parsona/supabase/migrations):

```
001_initial_schema.sql                      -> Core tables: profiles, contacts, conversations, messages, templates
002_pipelines_enhancements.sql              -> Pipelines, stages, deals
003_broadcast_recipient_wamid.sql           -> WhatsApp Message ID mapping for broadcast status
004_contact_delete_set_null.sql             -> Historical data retention on contact deletion
005_broadcast_counts_incremental.sql        -> Atomic counters for broadcast deliveries
006_automations.sql                         -> Automations engine rules, steps, logs
007_automations_increment_counter.sql       -> Atomic automation run count incrementation
008_profile_avatars_storage.sql             -> Avatars Supabase Storage bucket & policies
009_message_actions.sql                     -> Message replies, reactions, notes
010_flows.sql                               -> Visual Flow canvas entities & edge schemas
011_profile_beta_features.sql               -> Opt-in beta feature toggles
012_flows_increment_counter.sql             -> Atomic flow run increments
013_whatsapp_config_phone_number_id_unique  -> Multi-tenant phone ID constraints
014_message_templates_meta_integration.sql  -> Meta Template syncing, categories & status
015_whatsapp_config_registration.sql        -> Meta WABA two-step registration tracking
016_flow_media.sql                          -> Media assets storage for visual flow nodes
017_account_sharing.sql                     -> Multi-tenant account sharing & account_role enum
018_account_member_rpcs.sql                 -> RPCs for member listing and role elevation
019_invitation_rpcs.sql                     -> Invite token generation, hashing, and acceptance
020_account_sharing_followups.sql           -> RLS hardening across shared accounts
021_account_default_currency.sql            -> Currency settings per account for deals
022_contact_phone_dedup.sql                 -> Normalized digits phone indexing & uniqueness
023_chat_media.sql                          -> Chat media storage bucket configuration
024_member_presence.sql                     -> Presence heartbeats & online indicators
025_filter_contacts_by_tags.sql             -> Optimized tag intersection query function
026_api_keys.sql                            -> Developer API keys table with SHA-256 hashes
027_notifications.sql                       -> In-app notification center table & triggers
028_webhook_endpoints.sql                   -> Outbound webhook endpoints & delivery log tables
029_ai_reply.sql                            -> AI configuration & thread auto-reply metadata
030_ai_knowledge.sql                        -> pgvector knowledge docs & embedding tables
031_ai_reply_slot_grant.sql                 -> Grants for AI worker functions
032_fix_ai_knowledge_membership.sql         -> Knowledge base tenant RLS isolation
033_ai_reply_polish.sql                     -> AI generated message flags & thread counters
034_fix_profiles_update_rls.sql             -> User profile update policy corrections
035_interactive_messages.sql                -> Interactive button & list JSON payloads
036_conversation_contact_dedup.sql          -> Single conversation per contact constraint
037_webhook_broadcast_reliability.sql       -> Webhook failure handling & retry states
038_broadcast_resume.sql                    -> Broadcast delivery locking leases & resume engine
039_inbound_media_mirror.sql                -> Media mirror flags & MIME tracking
040_contact_business_scoped_user_id.sql     -> WhatsApp BSUID and username support
041_fix_broadcast_contact_id_ambiguity.sql  -> Query join ambiguity resolution
042_message_failure_reason.sql              -> Meta error code, title & details logging
043_storage_scoped_select.sql               -> Storage bucket RLS policies scoped to account
044_internal_definer_grants.sql             -> Security definer function permission grants
045_automation_wait_for_reply.sql           -> Automation wait-for-reply state machine
046_ai_openai_compatible.sql                -> Custom base URL & models for OpenAI-compatible
047_account_membership_integrity.sql        -> Constraint checking for valid account members
048_quick_reply_content_matches_kind.sql    -> Data integrity check for quick replies
049_broadcast_params_jsonb.sql              -> Positional template parameters serialization
051_automation_pending_integrity.sql        -> Integrity checks for pending automation steps
052_flow_run_integrity.sql                  -> Flow run execution state constraints
053_ai_reply_integrity.sql                  -> AI token consumption & daily usage tables
054_webhook_status_integrity.sql            -> Webhook delivery status check constraints
055_authz_membership_holes.sql              -> Security audit patching membership edge cases
057_message_templates_account_unique.sql    -> Template name uniqueness scoped per account
058_engine_race_gaps.sql                    -> Concurrency race condition guards in engines
059_dashboard_overview.sql                  -> Materialized aggregation RPCs for dashboard
```

---

## 8. Configuration & Environment Variables

| Variable Name | Required | Default / Format | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | `https://*.supabase.co` | Supabase API URL endpoint. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | `ey...` JWT | Public Supabase anonymous client key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `ey...` JWT | Privileged Supabase secret key for server-side operations and background jobs. |
| `ENCRYPTION_KEY` | **Yes** | 64-character hex (32 bytes) | Master cryptographic key used for AES-256-GCM encryption of WABA tokens & AI keys. |
| `META_APP_SECRET` | **Yes** | 32-character hex | Meta Developer App Secret for HMAC-SHA256 inbound webhook signature validation. |
| `META_WEBHOOK_VERIFY_TOKEN` | **Yes** | String | Secret token configured in Meta App Dashboard for webhook challenge handshake. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `http://localhost:3000` | Canonical application base URL for auth redirects, media links, and invites. |
| `NEXT_PUBLIC_APP_LOCALE` | No | `en` (`en`, `es`, `pt`, `ko`) | Default UI fallback locale. |
| `CRON_SECRET` | Recommended | String | Bearer authorization token guarding scheduled `/api/*/cron` endpoints. |

---

## 9. Development & Operational Scripts

From `package.json`:

| Command | Action | Notes |
|---|---|---|
| `npm run dev` | Runs Next.js development server | Accessible at `http://localhost:3000` |
| `npm run build` | Compiles Next.js for production | Validates server actions, pages, and static routes |
| `npm run start` | Starts production server | Used inside Docker containers |
| `npm run typecheck` | Executes `tsc --noEmit` | Strict full-codebase TypeScript compiler check |
| `npm run test` | Executes `vitest run` | Runs unit, integration, and security test suites |
| `npm run test:watch` | Executes `vitest` | Interactive test runner for TDD |
| `npm run lint` | Executes `eslint` | Validates Next.js & TypeScript rules |
| `npm run format` | Executes `prettier --write .` | Enforces uniform formatting and Tailwind class ordering |
| `npm run format:check`| Executes `prettier --check .`| CI check for code formatting compliance |

---

## 10. Summary Assessment & Health Check

- **Type Safety:** 100% clean TypeScript compilation (`tsc --noEmit` exits with code 0).
- **Security Posture:** 
  - Zero plaintext third-party credentials.
  - SSRF protection on outbound webhooks.
  - Strict RLS on all database tables.
  - HMAC verification on all inbound Meta webhook payloads.
- **Modularity:** Clear separation of concerns between presentation components (`src/components/`), API routing (`src/app/api/`), background engines (`src/lib/`), and database schema (`supabase/migrations/`).
- **Production Readiness:** Full Docker containerization, multi-language internationalization, comprehensive unit test suite, and resilient background job execution with lease locking.

