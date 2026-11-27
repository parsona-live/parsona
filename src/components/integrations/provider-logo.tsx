import type { ProviderKey } from '@/lib/integrations/catalog';

interface ProviderLogoProps {
  providerKey: ProviderKey;
  size?: 'sm' | 'md';
}

export function ProviderLogo({ providerKey, size = 'sm' }: ProviderLogoProps) {
  const boxClass =
    size === 'md'
      ? 'w-11 h-11 rounded-lg flex items-center justify-center shrink-0 overflow-hidden'
      : 'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden';

  switch (providerKey) {
    case 'cal_com':
      return (
        <div className={`${boxClass} bg-[#111827] border border-white/15`}>
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
            <rect x="4" y="6" width="24" height="20" rx="4" stroke="#ffffff" strokeWidth="2.2" />
            <path d="M4 12.5H28" stroke="#ffffff" strokeWidth="2" />
            <path d="M10.5 4V8M21.5 4V8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <text
              x="16"
              y="22.5"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="7.5"
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
            >
              Cal
            </text>
          </svg>
        </div>
      );

    case 'calendly':
      return (
        <div className={`${boxClass} bg-[#006BFF]`}>
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="10" stroke="#ffffff" strokeWidth="2.6" strokeDasharray="46 16" strokeLinecap="round" />
            <circle cx="16" cy="16" r="4.5" fill="#ffffff" />
          </svg>
        </div>
      );

    case 'google_calendar':
      return (
        <div className={`${boxClass} bg-white border border-border shadow-2xs`}>
          <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden="true">
            <rect x="4" y="4" width="24" height="24" rx="4" fill="#FFFFFF" />
            <path d="M8 4h16a4 4 0 0 1 4 4v3H4V8a4 4 0 0 1 4-4z" fill="#4285F4" />
            <path d="M28 11v13l-4 4V11h4z" fill="#FBBC04" />
            <path d="M4 24l4 4h16v-4H4z" fill="#34A853" />
            <path d="M24 24l4-4v4l-4 4v-4z" fill="#EA4335" />
            <text
              x="15.5"
              y="21.5"
              textAnchor="middle"
              fill="#1F2937"
              fontSize="10.5"
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
            >
              31
            </text>
          </svg>
        </div>
      );

    case 'google_sheets':
      return (
        <div className={`${boxClass} bg-[#0F9D58]/15 border border-[#0F9D58]/30`}>
          <svg viewBox="0 0 32 32" className="w-6 h-6" aria-hidden="true">
            <path
              d="M8 4h11l7 7v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
              fill="#0F9D58"
            />
            <path d="M19 4l7 7h-5a2 2 0 0 1-2-2V4z" fill="#87CEAC" />
            <rect x="9.5" y="14.5" width="13" height="9" rx="1" fill="none" stroke="#ffffff" strokeWidth="1.5" />
            <path d="M9.5 19h13M16 14.5v9" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        </div>
      );

    case 'razorpay':
      return (
        <div className={`${boxClass} bg-[#072654]`}>
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
            <path d="M18.5 5L11 19h6.2l-2.7 8L23 13h-6.4L18.5 5z" fill="#3395FF" />
            <path d="M13 13l-4 14h4.2l2.5-8.5L13 13z" fill="#ffffff" />
          </svg>
        </div>
      );

    case 'slack':
      return (
        <div className={`${boxClass} bg-white dark:bg-zinc-900 border border-border`}>
          <svg viewBox="0 0 32 32" className="w-6 h-6" aria-hidden="true">
            <rect x="13" y="4" width="3.2" height="9" rx="1.6" fill="#36C5F0" />
            <rect x="7" y="9.8" width="3.2" height="3.2" rx="1.6" fill="#36C5F0" />
            <rect x="18.8" y="13" width="9" height="3.2" rx="1.6" fill="#2EB67D" />
            <rect x="18.8" y="7" width="3.2" height="3.2" rx="1.6" fill="#2EB67D" />
            <rect x="15.8" y="19" width="3.2" height="9" rx="1.6" fill="#ECB22E" />
            <rect x="21.8" y="19" width="3.2" height="3.2" rx="1.6" fill="#ECB22E" />
            <rect x="4.2" y="15.8" width="9" height="3.2" rx="1.6" fill="#E01E5A" />
            <rect x="10" y="21.8" width="3.2" height="3.2" rx="1.6" fill="#E01E5A" />
          </svg>
        </div>
      );

    case 'webhook_bridge':
      return (
        <div className={`${boxClass} bg-[#FF4F00]`}>
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
            <path
              d="M16 5v22M6.5 10.5l19 11M25.5 10.5l-19 11"
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );

    case 'custom_api':
    default:
      return (
        <div className={`${boxClass} bg-primary text-primary-foreground`}>
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
            <path
              d="M11 10L6 16l5 6M21 10l5 6-5 6M18 8l-4 16"
              stroke="#ffffff"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
  }
}
