# WAPP — WhatsApp CRM & Automation Platform

> A modern, self-hostable CRM and automation platform for WhatsApp® built with **Next.js 16** and **Supabase**. Manage a shared team inbox, visual sales pipelines, contact lists, broadcasts, and no-code automations—with complete ownership of your data.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ecf8e?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)

---

## Overview

**WAPP** is an open, flexible CRM solution designed for businesses operating on WhatsApp. Built on the official Meta WhatsApp Cloud API, WAPP allows teams to collaborate over a single phone number, automate repetitive workflows, and streamline customer interactions without per-seat SaaS costs or vendor lock-in.

---

## Key Features

- **💬 Shared Team Inbox**  
  Multi-agent inbox powered by the official WhatsApp Business API. Assign conversations to agents, set statuses, leave internal notes, and organize chats with tags.

- **👥 Contact Management & CRM**  
  Rich contact profiles with custom attributes, tagging, contact deduplication, and bulk CSV import/export.

- **📊 Visual Sales Pipelines**  
  Kanban-style deal stages linked directly to WhatsApp conversations for tracking customer journeys from lead to close.

- **📢 Broadcasts & Campaigns**  
  Send broadcast messages using Meta-approved templates with variable substitution, tracking delivery and read rates in real time.

- **⚡ Visual No-Code Automations**  
  Interactive workflow builder (powered by React Flow). Trigger actions on inbound messages, new contacts, keywords, or schedules with conditional branches, delays, tags, and webhooks.

- **🤖 AI Reply Assistant & Knowledge Base**  
  Bring your own OpenAI or Anthropic API key (stored encrypted via AES-256-GCM). Generate one-click reply drafts, run auto-reply bots with seamless human handoff, and index FAQs or documentation with hybrid search (Postgres full-text + pgvector).

- **📈 Real-Time Analytics Dashboard**  
  Monitor customer response times, incoming message volume, pipeline conversion rates, and cross-team activity feeds.

- **🛡️ Team Roles & Permissions**  
  Invite teammates via secure links with role-based access control (`Owner`, `Admin`, `Agent`, `Viewer`) and account-scoped data isolation.

- **🔌 Developer-First Extensibility**  
  - **REST API (`/api/v1`)**: Scoped, revocable API keys for custom integrations. See [docs/public-api.md](./docs/public-api.md).
  - **Model Context Protocol (MCP)**: Server support to drive WAPP through Claude, Cursor, and other AI agents. See [docs/mcp.md](./docs/mcp.md).
  - **Webhooks**: Secure, HMAC-verified webhook processing.

- **🌐 Multi-Language Support**  
  Ships ready with localizations for English (`en`), Spanish (`es`), Brazilian Portuguese (`pt`), and Korean (`ko`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, Server Actions) |
| **Frontend** | [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), [Base UI](https://base-ui.com) |
| **Database & Auth** | [Supabase](https://supabase.com) (PostgreSQL, Row Level Security, Storage, Auth) |
| **Messaging** | Meta WhatsApp Business Cloud API |
| **Workflow Builder** | [@xyflow/react](https://reactflow.dev) |
| **Security** | AES-256-GCM credential encryption, HMAC webhook verification, RLS policies |

---

## Quick Start

### Prerequisites

- **Node.js**: `>= 22.12.0`
- **npm**: `>= 10.9.0`
- A [Supabase](https://supabase.com) project
- A [Meta for Developers](https://developers.facebook.com) account with WhatsApp Business Cloud API configured

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/wapp.git
cd wapp
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

Fill in your project credentials:

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption Key (32-byte hex for AES-256-GCM token storage)
ENCRYPTION_KEY=your-32-byte-hex-key

# Meta / WhatsApp Business API
META_APP_SECRET=your-meta-app-secret
META_WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token

# App Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_LOCALE=en # en | es | pt | ko
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You will be redirected to `/login` (or `/dashboard` if authenticated).

---

## Docker Deployment

WAPP includes a production-ready multi-stage `Dockerfile` and `docker-compose.yml`:

```bash
# Build and run with Docker Compose
docker compose --env-file .env.local up --build -d
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

For full container configuration, port mappings, and environment guidelines, see [docs/docker.md](./docs/docker.md).

---

## Documentation & Guides

Detailed operational guides and configuration docs:

- 📖 **[Public REST API Reference](./docs/public-api.md)** — Endpoints, authentication, and schemas for `/api/v1`.
- 🤖 **[MCP Server Guide](./docs/mcp.md)** — Setting up Model Context Protocol for AI coding assistants and agents.
- 🐳 **[Docker Deployment Guide](./docs/docker.md)** — Container build parameters and production deployment tips.
- ⚙️ **[WhatsApp Troubleshooting](./docs/whatsapp-connection-troubleshooting.md)** — Resolving Meta Business API setup and webhook errors.
- 📱 **[Multi-WABA Configuration](./docs/multi-waba.md)** — Managing multiple WhatsApp Business Accounts on one deployment.
- ✉️ **[Auth & Custom Email Setup](./docs/auth-emails.md)** — Supabase email confirmation, password resets, and redirect URLs.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts local Next.js development server |
| `npm run build` | Builds production application bundle |
| `npm run start` | Starts production server |
| `npm run lint` | Runs ESLint code style and quality checks |
| `npm run typecheck` | Validates TypeScript types with `tsc --noEmit` |
| `npm run test` | Runs test suite using Vitest |
| `npm run format` | Formats codebase using Prettier |
