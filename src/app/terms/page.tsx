import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell, type LegalSection } from '@/components/landing/legal-page-shell'

export const metadata: Metadata = {
  title: 'Terms & Conditions | Parsona',
  description:
    'Terms of Service and Conditions governing the Parsona waitlist, SaaS platform, WhatsApp/Instagram/Facebook messaging compliance, INR billing, and Indian governing law.',
}

const SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Acceptance of Terms & Pre-Launch Waitlist',
    content: (
      <>
        <p>
          These Terms &amp; Conditions (&ldquo;Terms&rdquo;) form a binding electronic contract
          under the <strong>Indian Contract Act, 1872</strong> and the{' '}
          <strong>Information Technology Act, 2000</strong> between you (or the business entity you
          represent) and <strong>Parsona</strong>.
        </p>
        <p>
          <strong>Waitlist &amp; Early Access:</strong> Joining the Parsona waitlist is free and
          non-binding. Waitlist invitations are issued in batches; joining does not obligate you to
          purchase a subscription, nor does it guarantee a fixed public launch date or specific
          beta feature (including upcoming Voice AI previews).
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility & Workspace Accounts',
    content: (
      <ul>
        <li>
          You confirm that you are at least 18 years old and legally authorized to bind your
          company, clinic, agency, or business to these Terms.
        </li>
        <li>
          You are responsible for safeguarding workspace credentials, team role assignments, API
          keys, and webhook tokens, and for all activity conducted under your workspace.
        </li>
        <li>
          You must provide accurate business details during onboarding, including valid contact
          information for Meta Business verification and GST billing.
        </li>
      </ul>
    ),
  },
  {
    id: 'messaging-compliance',
    title: 'Messaging Compliance, Anti-Spam & TRAI / Meta Rules',
    content: (
      <>
        <p>
          Parsona integrates exclusively with official APIs. When sending broadcasts, templates,
          DMs, or automated messages through Parsona, you agree to strictly comply with:
        </p>
        <ul>
          <li>
            <strong>Meta WhatsApp Business Policy &amp; Commerce Policy</strong>, Instagram
            Messaging Terms, and Facebook Platform Terms — including capturing clear, verifiable
            recipient opt-in before sending promotional broadcasts or notifications.
          </li>
          <li>
            <strong>
              TRAI Telecom Commercial Communications Customer Preference Regulations (TCCCPR)
            </strong>{' '}
            and applicable DND/consent rules in India for commercial communications and future voice
            calling workflows.
          </li>
          <li>
            <strong>
              IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021
            </strong>{' '}
            and Sections 66C, 66D, and 67 of the IT Act, 2000: you must not transmit unlawful,
            deceptive, fraudulent, infringing, harassing, obscene, or unsolicited bulk spam content.
          </li>
        </ul>
        <p>
          Meta or Parsona may throttle, suspend, or terminate messaging access if your account
          triggers high block/spam rates or violates Meta or Indian telecom policies.
        </p>
      </>
    ),
  },
  {
    id: 'ai-oversight',
    title: 'AI Agents, Automation & Human Oversight',
    content: (
      <>
        <p>
          Parsona provides configurable AI agents, reply suggestions, and no-code automation flows
          to accelerate customer conversations. Because AI outputs are probabilistic:
        </p>
        <ul>
          <li>
            You are responsible for configuring your knowledge base, handoff rules, and approval
            modes (draft-only vs. auto-reply) appropriately for your industry.
          </li>
          <li>
            Parsona AI is not a substitute for licensed medical, legal, financial, or real-estate
            regulatory advice. You remain solely responsible for pricing quotes, appointments,
            offers, and commitments communicated to your customers.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'billing-gst',
    title: 'Pricing, INR Billing, GST & Cancellations',
    content: (
      <ul>
        <li>
          Subscription plans are quoted in Indian Rupees (<strong>INR</strong>) on Monthly or
          Annual billing cycles. Applicable Goods and Services Tax (<strong>GST</strong>) is
          invoiced separately as per Indian tax law.
        </li>
        <li>
          <strong>Meta Conversation Charges:</strong> Official Meta WhatsApp Business API
          per-conversation/template fees charged by Meta (if applicable to your volume) are billed
          transparently at actuals or directly via your Meta Business Manager.
        </li>
        <li>
          <strong>Cancellation &amp; Refunds:</strong> You may upgrade, downgrade, or cancel your
          plan before your next billing renewal date. Fees already paid for an active billing cycle
          are non-refundable except where required by applicable consumer law or in case of verified
          duplicate billing errors.
        </li>
      </ul>
    ),
  },
  {
    id: 'ip-ownership',
    title: 'Intellectual Property & Your Data Ownership',
    content: (
      <ul>
        <li>
          <strong>Your Data Stays Yours:</strong> You retain 100% ownership of your contact lists,
          chat histories, catalogues, templates, and CRM records. You grant Parsona a limited
          license strictly to host, transmit, and process this data to deliver the service.
        </li>
        <li>
          <strong>Parsona Platform IP:</strong> All software code, user interface designs, flow
          engines, trademarks, logos, and documentation remain the exclusive intellectual property
          of Parsona. Reverse engineering, reselling without an agency/partner agreement, or
          scraping the platform is prohibited.
        </li>
      </ul>
    ),
  },
  {
    id: 'liability',
    title: 'Availability, Warranties & Limitation of Liability',
    content: (
      <>
        <p>
          We work hard to maintain high uptime and reliable webhook delivery, however third-party
          dependencies (including Meta APIs, telecom networks, and payment gateways) can experience
          outages outside our control.
        </p>
        <p>
          To the maximum extent permitted by Indian law, Parsona is provided on an
          &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis. Neither party shall be liable
          for indirect, incidental, special, or consequential damages (including lost profits or
          lost leads). Parsona’s total aggregate liability arising out of or relating to these Terms
          shall not exceed the total subscription fees paid by you to Parsona in the{' '}
          <strong>twelve (12) months</strong> preceding the claim.
        </p>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension, Termination & Data Export',
    content: (
      <p>
        Either party may terminate an active subscription upon notice for material breach not cured
        within 15 days. Upon cancellation or termination, you may export your contacts and records
        for up to <strong>30 days</strong>, after which workspace personal data will be securely
        erased in accordance with our{' '}
        <Link href="/data-policy" className="text-[#0B5F37] font-semibold underline">
          Personal Data &amp; IT Compliance Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: 'governing-law',
    title: 'Governing Law, Arbitration & Jurisdiction',
    content: (
      <>
        <p>
          These Terms are governed by and construed in accordance with the{' '}
          <strong>laws of the Republic of India</strong>, without regard to conflict-of-law
          principles.
        </p>
        <p>
          Any dispute arising out of or relating to these Terms that cannot be resolved amicably
          within 30 days through our Grievance Desk shall be referred to and finally resolved by
          arbitration in accordance with the <strong>Arbitration and Conciliation Act, 1996</strong>{' '}
          by a sole arbitrator mutually appointed by the parties, conducted in English. Subject to
          arbitration, courts of competent jurisdiction in India shall have exclusive jurisdiction.
        </p>
      </>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPageShell
      activePath="/terms"
      badgeLabel="Terms & Conditions"
      badgeBgClass="bg-white"
      badgeDotClass="bg-[var(--brand-primary)]"
      title="Terms & Conditions"
      subtitle="Clear, fair software terms for startups and businesses using Parsona — covering pre-launch waitlist access, Meta & TRAI messaging rules, INR/GST billing, and Indian law."
      lastUpdated="November 2026"
      effectiveNote="Electronic record under IT Act, 2000 (India)"
      highlights={[
        { label: 'Waitlist', value: 'Free, non-binding early access' },
        { label: 'Data Ownership', value: 'You own 100% of contacts & chats' },
        { label: 'Governing Law', value: 'Laws of India & Arbitration Act, 1996' },
      ]}
      sections={SECTIONS}
    />
  )
}

