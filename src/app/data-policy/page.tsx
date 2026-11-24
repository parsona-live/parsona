import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell, type LegalSection } from '@/components/landing/legal-page-shell'

export const metadata: Metadata = {
  title: 'Personal Data Protection & Indian IT Law Compliance | Parsona',
  description:
    'Parsona’s Personal Data Processing framework, DPDP Act 2023 compliance, IT Act 2000 & CERT-In security standards, and Meta Data Deletion instructions.',
}

const SECTIONS: LegalSection[] = [
  {
    id: 'roles',
    title: 'Data Fiduciary & Data Processor Roles (DPDP Act, 2023)',
    content: (
      <>
        <p>
          Under India’s <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>,
          responsibility for personal data depends on the context of processing:
        </p>
        <ul>
          <li>
            <strong>Parsona as Data Fiduciary:</strong> For personal data you submit directly to
            us — such as waitlist sign-ups, workspace admin accounts, billing contacts, and support
            tickets — Parsona determines the purpose and means of processing.
          </li>
          <li>
            <strong>Parsona as Data Processor (on your behalf):</strong> When your business connects
            WhatsApp, Instagram, Facebook, or uploads customer lists into Parsona’s CRM and inbox,{' '}
            <strong>your business is the Data Fiduciary</strong> and Parsona acts strictly as your
            Data Processor following your documented workspace instructions.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'indian-it-laws',
    title: 'Indian IT & Startup Software Compliance Framework',
    content: (
      <>
        <p>
          Parsona is architected to help Indian startups, clinics, agencies, and D2C brands operate
          confidently under core Indian technology and privacy statutes:
        </p>
        <ul>
          <li>
            <strong>Information Technology Act, 2000 (Sections 43A, 72 &amp; 72A):</strong>{' '}
            Mandates reasonable security practices and procedures to prevent wrongful loss or
            unauthorized disclosure of personal and sensitive personal data.
          </li>
          <li>
            <strong>Digital Personal Data Protection Act, 2023 (DPDP Act):</strong> Enforces clear
            notice and purpose-specific consent (Sections 5–6), Data Principal rights to access,
            correction, erasure, and grievance redressal (Sections 11–14), and mandatory breach
            reporting to the Data Protection Board of India and affected users (Section 8(6)).
          </li>
          <li>
            <strong>IT (SPDI) Rules, 2011:</strong> Governs collection, disclosure, transfer, and
            security standards for Sensitive Personal Data or Information (passwords, financial
            instrument info, and medical/health data where clinics use Parsona).
          </li>
          <li>
            <strong>
              IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021:
            </strong>{' '}
            Requires appointment of a dedicated Grievance Officer, transparent user terms, and
            lawful due diligence against spam, impersonation, and prohibited content.
          </li>
          <li>
            <strong>CERT-In Cybersecurity Directions (28 April 2022):</strong> Guides our
            synchronized NTP system logging, 180-day security log retention inside compliant cloud
            environments, and 6-hour incident triage readiness for reportable cyber incidents.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'data-matrix',
    title: 'Personal Data Categories & Purpose Matrix',
    content: (
      <div className="overflow-x-auto rounded-[14px] border border-[#D9E1DB]">
        <table className="w-full text-left border-collapse text-[14px]">
          <thead>
            <tr className="bg-[#F3F5F0] border-b border-[#D9E1DB] text-[#0B3B2E]">
              <th className="py-3 px-4 font-semibold">Category</th>
              <th className="py-3 px-4 font-semibold">Examples</th>
              <th className="py-3 px-4 font-semibold">Purpose &amp; Retention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4EAE6]">
            <tr>
              <td className="py-3 px-4 font-semibold text-[#0E1512]">Waitlist &amp; Identity</td>
              <td className="py-3 px-4">Name, email, phone number</td>
              <td className="py-3 px-4">Early-access invites &amp; onboarding; deleted on request</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-[#0E1512]">End-Customer Messaging</td>
              <td className="py-3 px-4">WhatsApp/IG/FB messages, contact tags, order notes</td>
              <td className="py-3 px-4">
                Workspace inbox, CRM &amp; flows; purged within 30 days of workspace deletion
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-[#0E1512]">Billing &amp; GST</td>
              <td className="py-3 px-4">Company name, GSTIN, invoice logs</td>
              <td className="py-3 px-4">
                Statutory GST invoicing; retained per Indian tax law (up to 8 years)
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-[#0E1512]">Security &amp; Audit</td>
              <td className="py-3 px-4">Login timestamps, IP, webhook logs</td>
              <td className="py-3 px-4">
                Abuse prevention &amp; CERT-In readiness; rolling 180-day retention
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'security-controls',
    title: 'Technical & Organizational Security Controls',
    content: (
      <ul>
        <li>
          <strong>Encryption Everywhere:</strong> TLS 1.3 in transit for all API, dashboard, and
          webhook traffic; AES-256 encryption at rest for databases and media buckets.
        </li>
        <li>
          <strong>Tenant Isolation:</strong> Every workspace is logically isolated via database
          Row-Level Security (RLS) so one organization can never read another’s contacts or chats.
        </li>
        <li>
          <strong>Access Governance:</strong> Granular role-based access control (Admin, Manager,
          Agent), least-privilege internal engineering access, and immutable audit trails.
        </li>
        <li>
          <strong>Webhook Integrity:</strong> HMAC-SHA256 cryptographic signature verification on
          incoming Meta webhooks and payment gateway callbacks.
        </li>
      </ul>
    ),
  },
  {
    id: 'data-deletion',
    title: 'Personal Data Deletion & Meta User Data Deletion Policy',
    content: (
      <>
        <p>
          In compliance with both the <strong>DPDP Act, 2023 (Right to Erasure)</strong> and{' '}
          <strong>Meta Platform Developer Policies</strong>, any waitlist subscriber, workspace
          admin, or end user may request deletion of their personal data at any time:
        </p>
        <ul>
          <li>
            <strong>Option 1 — Email Request:</strong> Send an email from your registered address
            to{' '}
            <a href="mailto:hello@parsona.live" className="text-[#0B5F37] font-semibold underline">
              hello@parsona.live
            </a>{' '}
            with the subject line <strong>&ldquo;Data Deletion Request&rdquo;</strong> and include
            your phone number or workspace name.
          </li>
          <li>
            <strong>Option 2 — Direct Support:</strong> Call or message our compliance desk at{' '}
            <a href="tel:+919111951752" className="text-[#0B5F37] font-semibold underline">
              +91 91119 51752
            </a>
            .
          </li>
          <li>
            <strong>Option 3 — Disconnect Meta Integration:</strong> Workspace admins can revoke
            WhatsApp, Instagram, or Facebook app permissions directly from Meta Business Settings
            and trigger workspace purge from settings.
          </li>
        </ul>
        <p>
          Verified deletion requests are acknowledged within <strong>24 hours</strong> and
          permanently erased from primary databases within <strong>30 calendar days</strong> (with
          encrypted backups rotating out automatically on schedule).
        </p>
      </>
    ),
  },
  {
    id: 'breach-response',
    title: 'Personal Data Breach Notification Protocol',
    content: (
      <p>
        In the unlikely event of a confirmed personal data breach affecting customer records,
        Parsona will promptly contain and investigate the incident, notify affected workspace
        administrators without undue delay with actionable remediation details, and fulfill
        statutory notification obligations to CERT-In and the Data Protection Board of India as
        required under Indian law.
      </p>
    ),
  },
  {
    id: 'related-policies',
    title: 'Related Policies',
    content: (
      <p>
        This policy should be read alongside our{' '}
        <Link href="/privacy" className="text-[#0B5F37] font-semibold underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="text-[#0B5F37] font-semibold underline">
          Terms &amp; Conditions
        </Link>
        . For enterprise custom Data Processing Agreements (DPAs) or security questionnaires, reach
        out to{' '}
        <a href="mailto:hello@parsona.live" className="text-[#0B5F37] font-semibold underline">
          hello@parsona.live
        </a>
        .
      </p>
    ),
  },
]

export default function DataPolicyPage() {
  return (
    <LegalPageShell
      activePath="/data-policy"
      badgeLabel="Personal Data & Indian IT Law"
      badgeBgClass="bg-white"
      badgeDotClass="bg-[var(--brand-primary)]"
      title="Personal Data Protection & Indian IT Compliance"
      subtitle="How Parsona processes personal data, protects multi-tenant workspaces, and aligns with India’s IT Act 2000, DPDP Act 2023, CERT-In directions, and Meta’s data deletion standards."
      lastUpdated="November 2026"
      effectiveNote="DPDP Act 2023 · IT Act 2000 · CERT-In Aligned"
      highlights={[
        { label: 'Statutes Covered', value: 'IT Act 2000, DPDP Act 2023, CERT-In' },
        { label: 'Encryption', value: 'TLS 1.3 in transit · AES-256 at rest' },
        { label: 'Erasure SLA', value: '24h ack · Full purge within 30 days' },
      ]}
      sections={SECTIONS}
    />
  )
}

