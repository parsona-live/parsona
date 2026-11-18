import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell, type LegalSection } from '@/components/landing/legal-page-shell'

export const metadata: Metadata = {
  title: 'Privacy Policy | Parsona',
  description:
    'How Parsona collects, processes, protects, and deletes personal data in compliance with India’s Digital Personal Data Protection Act, 2023 (DPDP Act) and IT Act, 2000.',
}

const SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    title: 'Scope & Indian Legal Framework',
    content: (
      <>
        <p>
          This Privacy Policy explains how <strong>Parsona</strong> (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses, stores, shares, and protects
          personal data when you visit <strong>parsona.live</strong>, join our early-access
          waitlist, create a workspace, or use our omnichannel inbox, CRM, flow builder, and AI
          tools.
        </p>
        <p>
          This policy is published in compliance with applicable Indian data protection and
          information technology laws, including:
        </p>
        <ul>
          <li>
            <strong>The Digital Personal Data Protection Act, 2023 (DPDP Act)</strong> and rules
            notified thereunder;
          </li>
          <li>
            <strong>The Information Technology Act, 2000 (IT Act)</strong>, including Section 43A
            and Section 72A; and
          </li>
          <li>
            <strong>
              The Information Technology (Reasonable Security Practices and Procedures and Sensitive
              Personal Data or Information) Rules, 2011 (SPDI Rules)
            </strong>
            .
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'data-collected',
    title: 'Personal Data We Collect',
    content: (
      <>
        <p>We collect only the personal data strictly necessary to provide and improve Parsona:</p>
        <ul>
          <li>
            <strong>Waitlist &amp; Account Information:</strong> Your full name, work email address,
            phone / WhatsApp number, company name, role, and team member details when you join our
            waitlist or register an account.
          </li>
          <li>
            <strong>Connected Channel &amp; Customer Data:</strong> Messages, media attachments,
            phone numbers, profile names, order tags, and CRM fields processed on your behalf when
            you connect official Meta APIs (WhatsApp Business API, Instagram Messaging API, and
            Facebook Messenger) or upcoming Voice integrations.
          </li>
          <li>
            <strong>Billing &amp; Tax Records:</strong> Business billing address, GSTIN (where
            applicable), subscription tier, and payment transaction references processed via
            PCI-DSS compliant Indian payment gateways (we do not store full card numbers or UPI
            PINs).
          </li>
          <li>
            <strong>Technical &amp; Security Logs:</strong> IP address, browser type, device
            identifiers, audit timestamps, and diagnostic telemetry needed for reliability, abuse
            prevention, and CERT-In aligned security logging.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'purpose-and-ai',
    title: 'How We Use Data & AI Processing Commitments',
    content: (
      <>
        <p>We process personal data solely for clear, lawful purposes:</p>
        <ul>
          <li>
            Onboarding your business from the waitlist, verifying official WhatsApp Business API
            connectivity, and delivering real-time messaging, CRM, and automation workflows.
          </li>
          <li>
            Sending transactional notifications, workspace alerts, billing invoices, and support
            responses.
          </li>
          <li>
            Enforcing platform security, preventing spam or unauthorized access, and meeting
            statutory obligations under Indian law.
          </li>
        </ul>
        <p>
          <strong>Strict AI Isolation:</strong> When you enable Parsona AI agents or reply
          suggestions, your business knowledge base and customer messages are processed exclusively
          to generate responses for <em>your</em> workspace. We do <strong>not</strong> sell your
          data or use your private customer conversations to train public or third-party foundation
          models.
        </p>
      </>
    ),
  },
  {
    id: 'third-parties',
    title: 'Meta APIs, Sub-Processors & Sharing',
    content: (
      <>
        <p>
          We never sell personal data to data brokers or advertisers. We share data only with
          trusted infrastructure partners bound by confidentiality and data protection obligations:
        </p>
        <ul>
          <li>
            <strong>Meta Platforms, Inc.:</strong> Official WhatsApp Business, Instagram, and
            Facebook Messenger APIs strictly to transmit and receive messages you authorize.
          </li>
          <li>
            <strong>Cloud &amp; Database Infrastructure:</strong> Encrypted cloud hosting,
            PostgreSQL database storage, edge delivery (Cloudflare), and transactional email
            providers.
          </li>
          <li>
            <strong>Payment Processors:</strong> RBI-compliant payment gateways for INR/GST
            subscription billing.
          </li>
          <li>
            <strong>Legal Disclosures:</strong> Competent Indian law enforcement, courts, or
            regulatory authorities only when legally mandated by a valid order under applicable law.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'security-retention',
    title: 'Security Practices & Data Retention',
    content: (
      <>
        <p>
          We maintain reasonable security practices aligned with ISO/IEC 27001 principles and
          Section 43A of the IT Act, 2000:
        </p>
        <ul>
          <li>TLS 1.3 encryption for all data in transit and AES-256 encryption at rest.</li>
          <li>
            Strict multi-tenant database isolation (Row-Level Security), role-based access controls
            (RBAC), and signed webhook verification.
          </li>
          <li>
            <strong>Retention:</strong> Waitlist data is retained until you are onboarded or request
            removal. Active workspace data is retained while your subscription is active and deleted
            within 30 days of verified workspace termination (except statutory tax/GST records and
            security logs required by Indian law).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'cross-border',
    title: 'Cross-Border Data Transfers',
    content: (
      <p>
        Where cloud or API infrastructure operates outside India, personal data is transferred only
        to jurisdictions not restricted by the Central Government under Section 16 of the DPDP Act,
        2023, subject to contractual safeguards and encryption. Dedicated Indian regional hosting is
        available on Custom plans.
      </p>
    ),
  },
  {
    id: 'dpdp-rights',
    title: 'Your Rights as a Data Principal (DPDP Act, 2023)',
    content: (
      <>
        <p>Under the DPDP Act, 2023, you have the right to:</p>
        <ul>
          <li>
            <strong>Access &amp; Summary:</strong> Request confirmation and a summary of the
            personal data we hold about you and how it is processed.
          </li>
          <li>
            <strong>Correction &amp; Updating:</strong> Correct inaccurate or incomplete personal
            data.
          </li>
          <li>
            <strong>Erasure &amp; Withdrawal of Consent:</strong> Withdraw your consent or request
            deletion of your waitlist/account personal data at any time.
          </li>
          <li>
            <strong>Grievance Redressal &amp; Nomination:</strong> Raise complaints with our
            Grievance Officer and nominate another individual to exercise your rights in the event
            of death or incapacity.
          </li>
        </ul>
        <p>
          To exercise any right or request full data deletion, email{' '}
          <a href="mailto:hello@parsona.live" className="text-[#0B5F37] font-semibold underline">
            hello@parsona.live
          </a>{' '}
          or review our{' '}
          <Link href="/data-policy" className="text-[#0B5F37] font-semibold underline">
            Personal Data &amp; IT Law Compliance Policy
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children’s Data',
    content: (
      <p>
        Parsona is a B2B software platform built for businesses and adults aged 18 years or older.
        We do not knowingly collect personal data from individuals under 18 years of age without
        verifiable parental consent as required under Section 9 of the DPDP Act, 2023.
      </p>
    ),
  },
  {
    id: 'updates',
    title: 'Changes to This Policy',
    content: (
      <p>
        We may update this Privacy Policy as our platform evolves (for example, when Voice AI exits
        preview) or as new Indian DPDP rules are notified. Material updates will be communicated by
        updating the &ldquo;Last updated&rdquo; date above and notifying active workspace admins via
        email.
      </p>
    ),
  },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      activePath="/privacy"
      badgeLabel="Privacy Policy"
      badgeBgClass="bg-[#D4F5E3]"
      badgeDotClass="bg-[#1FD27A]"
      title="Privacy Policy"
      subtitle="Clear, plain-English privacy commitments built for Indian startups and modern businesses — aligned with the DPDP Act, 2023 and the IT Act, 2000."
      lastUpdated="November 2026"
      effectiveNote="Applies to parsona.live, Waitlist & Parsona Cloud"
      highlights={[
        { label: 'Core Law', value: 'DPDP Act, 2023 & IT Act, 2000 (India)' },
        { label: 'AI Privacy', value: 'Zero training on your private chats' },
        { label: 'Data Deletion', value: 'Completed within 30 days on request' },
      ]}
      sections={SECTIONS}
    />
  )
}

