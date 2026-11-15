// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { useEffect } from "react";
// import { cn } from "@/lib/utils";
// import { useAuth } from "@/hooks/use-auth";
// import { useTotalUnread } from "@/hooks/use-total-unread";
// import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
// import {
//   Bell,
//   Bot,
//   Building2,
//   Crown,
//   GitBranch,
//   LayoutDashboard,
//   LogOut,
//   MessageSquare,
//   Radio,
//   Settings,
//   Shield,
//   ShieldAlert,
//   User,
//   UserCog,
//   Users,
//   UsersRound,
//   Workflow,
//   X,
//   Zap,
// } from "lucide-react";
// import type { AccountRole } from "@/lib/auth/roles";

// // Per-role chip metadata used in the sidebar's account strip + the
// // Members tab roster. Keeping this near both consumers in a single
// // place avoids drift between the two surfaces — when a designer
// // wants to recolour "agent" rows, this is the one diff.
// const ROLE_CHIP: Record<
//   AccountRole,
//   { icon: typeof Crown; labelKey: string; className: string }
// > = {
//   owner: {
//     icon: Crown,
//     labelKey: "roleOwner",
//     // Amber: scarce, immutable, "the boss" — gets visual emphasis.
//     className:
//       "border-amber-500/40 bg-amber-500/10 text-amber-300",
//   },
//   admin: {
//     icon: Shield,
//     labelKey: "roleAdmin",
//     // Primary-tinted: significant but not as scarce as owner.
//     className:
//       "border-primary/40 bg-primary/10 text-primary",
//   },
//   agent: {
//     icon: UserCog,
//     labelKey: "roleAgent",
//     // Neutral slate: the operational default.
//     className:
//       "border-border bg-muted text-foreground",
//   },
//   viewer: {
//     icon: User,
//     labelKey: "roleViewer",
//     // Muted slate: read-only role; visually quieter than agent.
//     className:
//       "border-border bg-card text-muted-foreground",
//   },
// };
// import {
//   Avatar,
//   AvatarFallback,
//   AvatarImage,
// } from "@/components/ui/avatar";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

// interface NavItem {
//   href: string;
//   labelKey: string;
//   icon: typeof LayoutDashboard;
//   /**
//    * When true, the nav row renders a small "Beta" chip after the label.
//    * Purely informational — doesn't affect routing or access.
//    */
//   beta?: boolean;
// }

// const navItems: NavItem[] = [
//   { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
//   { href: "/inbox", labelKey: "inbox", icon: MessageSquare },
//   { href: "/notifications", labelKey: "notifications", icon: Bell },
//   { href: "/contacts", labelKey: "contacts", icon: Users },
//   { href: "/pipelines", labelKey: "pipelines", icon: GitBranch },
//   { href: "/broadcasts", labelKey: "broadcasts", icon: Radio },
//   { href: "/automations", labelKey: "automations", icon: Zap },
//   { href: "/flows", labelKey: "flows", icon: Workflow, beta: true },
//   { href: "/business", labelKey: "businessProfile", icon: Building2 },
//   { href: "/agents", labelKey: "aiAgents", icon: Bot },
// ];

// const bottomNavItems = [
//   { href: "/settings", labelKey: "settings", icon: Settings },
// ];

// interface SidebarProps {
//   /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
//   open?: boolean;
//   onClose?: () => void;
// }

// import { useTranslations } from "next-intl";

// export function Sidebar({ open = false, onClose }: SidebarProps) {
//   const t = useTranslations("Sidebar");
//   const pathname = usePathname();
//   const { profile, profileLoading, account, accountRole, signOut, isSuperAdmin } = useAuth();
//   const totalUnread = useTotalUnread();
//   const unreadNotifications = useUnreadNotifications();
//   // Only surface the account-name strip when it actually carries
//   // information. A solo user's personal account is named after them
//   // (the 017 signup trigger seeds it from `full_name`), so showing it
//   // here would just duplicate the user name in the footer below. Once
//   // the account is renamed or the user joins a shared account, the
//   // name diverges and the strip becomes meaningful — that's the signal
//   // we gate on. Wait for the profile fetch to settle first, otherwise
//   // the strip flashes in once the row resolves (a layout jump).
//   const showAccountStrip =
//     !profileLoading &&
//     !!account?.name &&
//     account.name !== profile?.full_name;

//   // Lock body scroll and allow Escape to close while the drawer is open on
//   // mobile. No-ops on desktop because the sidebar isn't positioned there.
//   useEffect(() => {
//     if (!open) return;
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === "Escape") onClose?.();
//     };
//     window.addEventListener("keydown", onKey);
//     return () => {
//       document.body.style.overflow = prev;
//       window.removeEventListener("keydown", onKey);
//     };
//   }, [open, onClose]);

//   return (
//     <>
//       {/* Backdrop — only exists on mobile and only when open. Clicking
//           it closes the drawer. Hidden from lg+ since the sidebar is
//           part of the main flex row there. */}
//       <button
//         type="button"
//         aria-label={t("closeMenu")}
//         onClick={onClose}
//         className={cn(
//           "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
//           open
//             ? "pointer-events-auto opacity-100"
//             : "pointer-events-none opacity-0",
//         )}
//       />

//       <aside
//         className={cn(
//           // Mobile: fixed drawer that slides in from the left.
//           "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card",
//           "transition-transform duration-200 ease-out will-change-transform",
//           open ? "translate-x-0" : "-translate-x-full",
//           // Desktop: static, always visible — reset all the mobile framing.
//           "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
//         )}
//         aria-label={t("primaryNav")}
//       >
//         {/* Logo row. On mobile we put a close button here; on desktop the
//             close button is hidden since the sidebar is always-visible. */}
//         <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
//           <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2">
//             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
//               <MessageSquare className="h-4 w-4" />
//             </div>
//             <span className="text-sm font-semibold text-foreground">
//               {t("title")}
//             </span>
//           </Link>
//           <button
//             type="button"
//             onClick={onClose}
//             aria-label={t("closeMenu")}
//             className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
//           >
//             <X className="h-5 w-5" />
//           </button>
//         </div>

//         {/* Main navigation */}
//         <nav className="flex-1 overflow-y-auto px-3 py-4">
//           <ul className="flex flex-col gap-1">
//             {navItems.map((item) => {
//               const isActive =
//                 pathname === item.href ||
//                 (item.href !== "/dashboard" && pathname.startsWith(item.href));

//               const showUnreadDot =
//                 item.href === "/inbox" && totalUnread > 0 && !isActive;

//               // Unlike the inbox dot, the notifications count stays visible
//               // even while the page is active — it reflects unread state
//               // (cleared by marking notifications read), not "currently
//               // viewing this section".
//               const showNotificationBadge =
//                 item.href === "/notifications" && unreadNotifications > 0;

//               return (
//                 <li key={item.href}>
//                   <Link
//                     href={item.href}
//                     onClick={onClose}
//                     className={cn(
//                       // Taller on mobile so fingers can hit the row reliably (≥44px).
//                       "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
//                       isActive
//                         ? "bg-primary/10 text-primary"
//                         : "text-muted-foreground hover:bg-muted hover:text-foreground",
//                     )}
//                   >
//                     <item.icon className="h-4 w-4" />
//                     <span className="flex-1">{t(item.labelKey as string)}</span>
//                     {item.beta && (
//                       <span
//                         aria-label={t("beta")}
//                         className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300"
//                       >
//                         {t("beta")}
//                       </span>
//                     )}
//                     {showUnreadDot && (
//                       <span
//                         aria-label={t("unreadConversations", { count: totalUnread })}
//                         className="relative flex h-2 w-2"
//                       >
//                         <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
//                         <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
//                       </span>
//                     )}
//                     {showNotificationBadge && (
//                       <span
//                         aria-label={t("unreadNotifications", { count: unreadNotifications })}
//                         className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
//                       >
//                         {unreadNotifications > 9 ? "9+" : unreadNotifications}
//                       </span>
//                     )}
//                   </Link>
//                 </li>
//               );
//             })}
//           </ul>

//           <div className="my-4 border-t border-border" />

//           <ul className="flex flex-col gap-1">
//             {isSuperAdmin && (
//               <li>
//                 <Link
//                   href="/admin"
//                   onClick={onClose}
//                   className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 mb-1"
//                 >
//                   <ShieldAlert className="h-4 w-4 text-amber-400" />
//                   <span>Super Admin</span>
//                 </Link>
//               </li>
//             )}
//             {bottomNavItems.map((item) => {
//               const isActive = pathname.startsWith(item.href);
//               return (
//                 <li key={item.href}>
//                   <Link
//                     href={item.href}
//                     onClick={onClose}
//                     className={cn(
//                       "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
//                       isActive
//                         ? "bg-primary/10 text-primary"
//                         : "text-muted-foreground hover:bg-muted hover:text-foreground",
//                     )}
//                   >
//                     <item.icon className="h-4 w-4" />
//                     {t(item.labelKey as string)}
//                   </Link>
//                 </li>
//               );
//             })}
//           </ul>
//         </nav>

//         {/* User section */}
//         <div className="shrink-0 border-t border-border p-3">
//           {/* Account name display — surfaced only when the account
//               name differs from the user's own name (see
//               `showAccountStrip`). For a default solo account the two
//               match, so we hide it to avoid duplicating the user name
//               below; for renamed or shared accounts it tells the user
//               which account they're acting in. */}
//           {showAccountStrip && account?.name ? (
//             <div className="mb-2 flex items-center gap-2 px-3 text-xs text-muted-foreground">
//               <UsersRound className="size-3.5 shrink-0" />
//               {/* `title=` exposes the full name on hover when it
//                   gets truncated (long account names + narrow
//                   sidebars). Cheap a11y win. */}
//               <span className="truncate" title={account.name}>
//                 {account.name}
//               </span>
//               {accountRole ? (
//                 // Always render the chip — owners used to be
//                 // invisible here, which made them indistinguishable
//                 // from admins at a glance. Now everyone sees their
//                 // role (with a colour cue) regardless of tier.
//                 (() => {
//                   const meta = ROLE_CHIP[accountRole];
//                   const Icon = meta.icon;
//                   return (
//                     <span
//                       className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}
//                     >
//                       <Icon className="size-3" />
//                       {t(meta.labelKey as string)}
//                     </span>
//                   );
//                 })()
//               ) : null}
//             </div>
//           ) : null}
//           <DropdownMenu>
//             <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none data-popup-open:bg-muted/60">
//               <Avatar className="size-8 shrink-0">
//                 {profile?.avatar_url ? (
//                   <AvatarImage
//                     src={profile.avatar_url}
//                     alt={profile.full_name ?? t("defaultAvatar")}
//                   />
//                 ) : null}
//                 <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
//                   {profile?.full_name?.charAt(0)?.toUpperCase() ??
//                     profile?.email?.charAt(0)?.toUpperCase() ??
//                     "U"}
//                 </AvatarFallback>
//               </Avatar>
//               <span className="min-w-0 flex-1 block">
//                 <span className="truncate block text-sm font-medium text-foreground">
//                   {profile?.full_name ?? t("defaultUser")}
//                 </span>
//                 <span className="truncate block text-xs text-muted-foreground">
//                   {profile?.email ?? ""}
//                 </span>
//               </span>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent
//               align="end"
//               side="top"
//               sideOffset={6}
//               className="min-w-56 bg-popover text-popover-foreground ring-border"
//             >
//               <DropdownMenuItem
//                 render={
//                   <Link
//                     href="/settings?tab=profile"
//                     onClick={onClose}
//                     className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
//                   />
//                 }
//               >
//                 <User className="size-4" />
//                 {t("menuProfile")}
//               </DropdownMenuItem>
//               <DropdownMenuItem
//                 render={
//                   <Link
//                     href="/settings?tab=whatsapp"
//                     onClick={onClose}
//                     className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
//                   />
//                 }
//               >
//                 <Settings className="size-4" />
//                 {t("menuSettings")}
//               </DropdownMenuItem>
//               <DropdownMenuSeparator className="bg-border" />
//               <DropdownMenuItem
//                 onClick={signOut}
//                 className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
//               >
//                 <LogOut className="size-4" />
//                 {t("menuSignOut")}
//               </DropdownMenuItem>
//             </DropdownMenuContent>
//           </DropdownMenu>
//         </div>
//       </aside>
//     </>
//   );
// }










"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { useTranslations } from "next-intl";

import {
  Bell,
  Bot,
  Building2,
  ChevronDown,
  Coins,
  CreditCard,
  Crown,
  FileText,
  GitBranch,
  Grip,
  Inbox,
  KeyRound,
  LayoutGrid,
  LogOut,
  Mail,
  MessagesCircle,
  MessageSquare,
  ChevronRight,
  Menu,
  Megaphone,
  Palette,
  PlugZap,
  Blocks,
  Settings,
  Share2,
  Shield,
  ShieldAlert,
  Tags,
  User,
  UserCog,
  Contact,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";

import type { AccountRole } from "@/lib/auth/roles";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ======================================================
// ROLE CONFIGURATION
// ======================================================

const ROLE_CHIP: Record<
  AccountRole,
  {
    icon: typeof Crown;
    labelKey: string;
    className: string;
  }
> = {
  owner: {
    icon: Crown,
    labelKey: "roleOwner",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  admin: {
    icon: Shield,
    labelKey: "roleAdmin",
    className:
      "border-primary/30 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    labelKey: "roleAgent",
    className:
      "border-border bg-muted text-muted-foreground",
  },
  viewer: {
    icon: User,
    labelKey: "roleViewer",
    className:
      "border-border bg-card text-muted-foreground",
  },
};

// ======================================================
// ICON COLOR SYSTEM
// ======================================================

const ICON_COLORS = {
  dashboard: {
    icon: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  inbox: {
    icon: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  notifications: {
    icon: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/40",
  },
  contacts: {
    icon: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
  },
  pipelines: {
    icon: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  broadcasts: {
    icon: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  automations: {
    icon: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/40",
  },
  flows: {
    icon: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
  },
  business: {
    icon: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  agents: {
    icon: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
  },
  settings: {
    icon: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800/70",
  },
  settingsOverview: {
    icon: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800/70",
  },
  settingsBilling: {
    icon: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  settingsProfile: {
    icon: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  settingsSecurity: {
    icon: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
  },
  settingsAppearance: {
    icon: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
  },
  settingsWhatsapp: {
    icon: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
  },
  settingsChannels: {
    icon: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/40",
  },
  settingsTemplates: {
    icon: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  settingsQuickReplies: {
    icon: "text-yellow-600 dark:text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
  },
  settingsInbox: {
    icon: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/40",
  },
  settingsFields: {
    icon: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
  },
  settingsDeals: {
    icon: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  settingsEmail: {
    icon: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
  },
  settingsMembers: {
    icon: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
  },
  settingsApi: {
    icon: "text-zinc-600 dark:text-zinc-400",
    bg: "bg-zinc-100 dark:bg-zinc-800/70",
  },
} as const;

// ======================================================
// NAVIGATION TYPES
// ======================================================

interface NavItem {
  href: string;
  label?: string;
  labelKey?: string;
  icon: typeof Grip;
  colors: {
    icon: string;
    bg: string;
  };
  beta?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: typeof Grip;
  colors: {
    icon: string;
    bg: string;
  };
  children: NavItem[];
}

// ======================================================
// PRIMARY NAVIGATION
// Original routes are preserved
// ======================================================

const mainNavItems: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "dashboard",
    icon: Grip,
    colors: ICON_COLORS.dashboard,
  },
  {
    href: "/inbox",
    labelKey: "inbox",
    icon: MessagesCircle,
    colors: ICON_COLORS.inbox,
  },
  {
    href: "/notifications",
    labelKey: "notifications",
    icon: Bell,
    colors: ICON_COLORS.notifications,
  },
  {
    href: "/contacts",
    labelKey: "contacts",
    icon: Contact,
    colors: ICON_COLORS.contacts,
  },
  {
    href: "/pipelines",
    labelKey: "pipelines",
    icon: GitBranch,
    colors: ICON_COLORS.pipelines,
  },
  {
    href: "/broadcasts",
    labelKey: "broadcasts",
    icon: Megaphone,
    colors: ICON_COLORS.broadcasts,
  },
];

// ======================================================
// EXPANDABLE NAVIGATION
// ======================================================

const expandableGroups: NavGroup[] = [
  {
    id: "automation",
    label: "Automation",
    icon: Workflow,
    colors: ICON_COLORS.automations,
    children: [
      {
        href: "/automations",
        labelKey: "automations",
        icon: Zap,
        colors: ICON_COLORS.automations,
      },
      {
        href: "/flows",
        labelKey: "flows",
        icon: Workflow,
        colors: ICON_COLORS.flows,
        beta: true,
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Blocks,
    colors: ICON_COLORS.business,
    children: [
      {
        href: "/business",
        labelKey: "businessProfile",
        icon: Building2,
        colors: ICON_COLORS.business,
      },
      {
        href: "/agents",
        labelKey: "aiAgents",
        icon: Bot,
        colors: ICON_COLORS.agents,
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    colors: ICON_COLORS.settings,
    children: [
      {
        href: "/settings?tab=overview",
        label: "Overview",
        icon: LayoutGrid,
        colors: ICON_COLORS.settingsOverview,
      },
      {
        href: "/settings?tab=billing",
        label: "Plans & Billing",
        icon: CreditCard,
        colors: ICON_COLORS.settingsBilling,
      },
      {
        href: "/settings?tab=profile",
        label: "Your Profile",
        icon: User,
        colors: ICON_COLORS.settingsProfile,
      },
      {
        href: "/settings?tab=security",
        label: "Login & Security",
        icon: Shield,
        colors: ICON_COLORS.settingsSecurity,
      },
      {
        href: "/settings?tab=appearance",
        label: "Appearance",
        icon: Palette,
        colors: ICON_COLORS.settingsAppearance,
      },
      {
        href: "/settings?tab=whatsapp",
        label: "WhatsApp",
        icon: PlugZap,
        colors: ICON_COLORS.settingsWhatsapp,
      },
      {
        href: "/settings?tab=channels",
        label: "Meta Channels (IG & FB)",
        icon: Share2,
        colors: ICON_COLORS.settingsChannels,
      },
      {
        href: "/settings?tab=templates",
        label: "Templates",
        icon: FileText,
        colors: ICON_COLORS.settingsTemplates,
      },
      {
        href: "/settings?tab=quick-replies",
        label: "Quick Replies",
        icon: Zap,
        colors: ICON_COLORS.settingsQuickReplies,
      },
      {
        href: "/settings?tab=inbox",
        label: "Inbox",
        icon: Inbox,
        colors: ICON_COLORS.settingsInbox,
      },
      {
        href: "/settings?tab=fields",
        label: "Fields & Tags",
        icon: Tags,
        colors: ICON_COLORS.settingsFields,
      },
      {
        href: "/settings?tab=deals",
        label: "Deals & Currency",
        icon: Coins,
        colors: ICON_COLORS.settingsDeals,
      },
      {
        href: "/settings?tab=email",
        label: "Email (Brevo / SMTP)",
        icon: Mail,
        colors: ICON_COLORS.settingsEmail,
      },
      {
        href: "/settings?tab=members",
        label: "Team Members",
        icon: UsersRound,
        colors: ICON_COLORS.settingsMembers,
      },
      {
        href: "/settings?tab=api",
        label: "API Keys",
        icon: KeyRound,
        colors: ICON_COLORS.settingsApi,
      },
    ],
  },
];

// ======================================================
// BOTTOM NAVIGATION
// ======================================================

const bottomNavItems: NavItem[] = [];

// ======================================================
// SIDEBAR PROPS
// ======================================================

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

// ======================================================
// SIDEBAR COMPONENT
// ======================================================

export function Sidebar({
  open = false,
  onClose,
}: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get("tab");

  const {
    profile,
    profileLoading,
    account,
    accountRole,
    signOut,
    isSuperAdmin,
  } = useAuth();

  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();

  // Desktop collapse
  const [collapsed, setCollapsed] = useState(false);

  // Expandable navigation
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // ====================================================
  // ACCOUNT
  // ====================================================

  const showAccountStrip =
    !profileLoading &&
    !!account?.name &&
    account.name !== profile?.full_name;

  // ====================================================
  // ACTIVE ROUTE
  // ====================================================

  const getEffectiveTab = (raw: string | null) => {
    if (raw === "tags" || raw === "custom-fields") return "fields";
    if (raw === "smtp") return "email";
    return raw || "overview";
  };

  const isActive = (href: string) => {
    const [route, query] = href.split("?");

    if (route === "/settings") {
      if (pathname !== "/settings") return false;
      const targetTab = new URLSearchParams(query || "").get("tab");
      if (!targetTab) {
        return !currentTab || currentTab === "overview";
      }
      return getEffectiveTab(currentTab) === targetTab;
    }

    return (
      pathname === route ||
      (route !== "/dashboard" &&
        pathname.startsWith(route + "/"))
    );
  };

  // ====================================================
  // AUTO EXPAND ACTIVE GROUP
  // ====================================================

  useEffect(() => {
    const activeGroups = expandableGroups
      .filter((group) =>
        group.children.some((item) => isActive(item.href))
      )
      .map((group) => group.id);

    if (activeGroups.length) {
      setExpandedGroups((previous) =>
        Array.from(new Set([...previous, ...activeGroups]))
      );
    }
  }, [pathname, currentTab]);

  // ====================================================
  // MOBILE DRAWER
  // ====================================================

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // ====================================================
  // TOGGLE GROUP
  // ====================================================

  const toggleGroup = (id: string) => {
    setExpandedGroups((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  // ====================================================
  // TRANSLATION
  // ====================================================

  const getLabel = (item: NavItem) => {
    if (item.labelKey && t.has(item.labelKey as any)) {
      return t(item.labelKey as any);
    }
    return item.label ?? (item.labelKey || "");
  };

  // ====================================================
  // NAVIGATION ITEM
  // ====================================================

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    const showUnreadDot =
      item.href === "/inbox" &&
      totalUnread > 0 &&
      !active;

    const showNotificationBadge =
      item.href === "/notifications" &&
      unreadNotifications > 0;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          data-nav-active={active ? "true" : "false"}
          title={
            collapsed
              ? getLabel(item)
              : undefined
          }
          className={cn(
            "sidebar-nav-link",
            // Compact navigation row
            "group relative flex h-9 w-full items-center rounded-lg",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:focus-visible:ring-zinc-500/50",

            collapsed
              ? "justify-center px-0"
              : "gap-2.5 px-2",

            active
              ? "!bg-zinc-100 !text-zinc-900 dark:!bg-zinc-800 dark:!text-zinc-100"
              : "!text-foreground hover:!bg-zinc-50 dark:hover:!bg-zinc-800/50"
          )}
        >
          {/* Neutral active indicator */}
          {active && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-zinc-500 dark:bg-zinc-400" />
          )}

          {/* Colored icon tile */}
          <span
            className={cn(
              "relative flex size-[30px] shrink-0 items-center justify-center rounded-[8px]",
              "transition-colors",
              item.colors.bg
            )}
          >
            <Icon
              size={17}
              strokeWidth={1.9}
              className={item.colors.icon}
            />

            {/* Collapsed inbox dot */}
            {collapsed && showUnreadDot && (
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
            )}

            {/* Collapsed notification badge */}
            {collapsed && showNotificationBadge && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground ring-2 ring-card">
                {unreadNotifications > 9
                  ? "9+"
                  : unreadNotifications}
              </span>
            )}
          </span>

          {/* Label */}
          {!collapsed && (
            <span
              className={cn(
                "sidebar-nav-label min-w-0 flex-1 truncate text-[14px] tracking-[-0.15px]",
                active
                  ? "!font-semibold !text-zinc-900 dark:!text-zinc-100"
                  : "!font-medium !text-foreground"
              )}
            >
              {getLabel(item)}
            </span>
          )}

          {/* Beta badge */}
          {!collapsed && item.beta && (
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-400">
              {t("beta")}
            </span>
          )}

          {/* Expanded inbox indicator */}
          {!collapsed && showUnreadDot && (
            <span
              aria-label={t("unreadConversations", {
                count: totalUnread,
              })}
              className="relative flex size-2 shrink-0"
            >
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
              <span className="relative size-2 rounded-full bg-primary" />
            </span>
          )}

          {/* Expanded notification badge */}
          {!collapsed && showNotificationBadge && (
            <span
              aria-label={t("unreadNotifications", {
                count: unreadNotifications,
              })}
              className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-md bg-primary/10 px-1 text-[10px] font-semibold tabular-nums text-primary"
            >
              {unreadNotifications > 9
                ? "9+"
                : unreadNotifications}
            </span>
          )}
        </Link>
      </li>
    );
  };

  // ====================================================
  // EXPANDABLE GROUP
  // ====================================================


  const renderNavGroup = (group: NavGroup) => {
    const Icon = group.icon;
    const isExpanded = expandedGroups.includes(group.id);

    const groupActive = group.children.some((item) =>
      isActive(item.href)
    );

    return (
      <li key={group.id}>
        {/* Parent navigation */}
        <button
          type="button"
          onClick={() => {
            if (collapsed) {
              setCollapsed(false);
              setExpandedGroups((prev) =>
                prev.includes(group.id)
                  ? prev
                  : [...prev, group.id]
              );
            } else {
              toggleGroup(group.id);
            }
          }}
          aria-expanded={isExpanded}
          title={collapsed ? group.label : undefined}
          className={cn(
            "group flex h-9 w-full items-center rounded-lg",
            "transition-colors duration-150",
            "hover:bg-muted/70",
            collapsed
              ? "justify-center px-0"
              : "gap-2.5 px-2",
            groupActive &&
            "bg-zinc-100 dark:bg-zinc-800/70"
          )}
        >
          {/* Parent icon */}
          <span
            className={cn(
              "flex size-[30px] shrink-0 items-center justify-center rounded-[8px]",
              group.colors.bg
            )}
          >
            <Icon
              size={17}
              strokeWidth={1.9}
              className={group.colors.icon}
            />
          </span>

          {!collapsed && (
            <>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-[14px] font-medium",
                  "text-foreground"
                )}
              >
                {group.label}
              </span>

              <ChevronDown
                size={15}
                strokeWidth={1.8}
                className={cn(
                  "shrink-0 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180"
                )}
              />
            </>
          )}
        </button>

        {/* Submenu */}
        {!collapsed && (
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
              isExpanded
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <ul className="relative ml-[15px] mt-1.5 space-y-1 border-l border-border py-0.5 pl-3">
                {group.children.map((child) => {
                  const active = isActive(child.href);
                  const ChildIcon = child.icon;

                  return (
                    <li key={child.href} className="relative">
                      {/* Submenu item */}
                      <Link
                        href={child.href}
                        onClick={onClose}
                        data-active={active ? "true" : undefined}
                        className={cn(
                          "group/submenu relative flex h-9 w-full items-center",
                          "gap-2.5 rounded-lg px-2",
                          "transition-all duration-150",
                          active
                            ? "!border !border-zinc-200 !bg-zinc-100 !text-zinc-900 dark:!border-zinc-700 dark:!bg-zinc-800 dark:!text-zinc-100"
                            : "border border-transparent text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                        )}
                      >
                        {/* Icon tile */}
                        <span
                          className={cn(
                            "flex size-[30px] shrink-0 items-center justify-center",
                            "rounded-[8px] transition-colors",
                            child.colors.bg
                          )}
                        >
                          <ChildIcon
                            size={16}
                            strokeWidth={1.9}
                            className={child.colors.icon}
                          />
                        </span>

                        {/* Label */}
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-[13px]",
                            active
                              ? "!font-semibold !text-zinc-900 dark:!text-zinc-100"
                              : "font-medium text-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          {getLabel(child)}
                        </span>

                        {/* Beta badge */}
                        {child.beta && (
                          <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400">
                            {t("beta")}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </li>
    );
  };


  // ====================================================
  // ACCOUNT ROLE
  // ====================================================

  const renderAccountRole = () => {
    if (!accountRole) return null;

    const meta = ROLE_CHIP[accountRole];
    const Icon = meta.icon;

    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5",
          "text-[9px] font-semibold uppercase tracking-wide",
          meta.className
        )}
      >
        <Icon size={11} />
        {t(meta.labelKey as string)}
      </span>
    );
  };

  // ====================================================
  // SETTINGS ITEM
  // ====================================================

  const renderSettingsItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          data-nav-active={active ? "true" : "false"}
          title={
            collapsed
              ? getLabel(item)
              : undefined
          }
          className={cn(
            "sidebar-nav-link",
            "group relative flex h-9 w-full items-center rounded-lg",
            "transition-colors duration-150",
            collapsed
              ? "justify-center px-0"
              : "gap-2.5 px-2",
            active
              ? "!bg-zinc-100 !text-zinc-900 dark:!bg-zinc-800 dark:!text-zinc-100"
              : "!text-foreground hover:!bg-zinc-50 dark:hover:!bg-zinc-800/50"
          )}
        >
          <span
            className={cn(
              "flex size-[30px] shrink-0 items-center justify-center rounded-[8px]",
              item.colors.bg
            )}
          >
            <Icon
              size={17}
              strokeWidth={1.9}
              className={item.colors.icon}
            />
          </span>

          {!collapsed && (
            <span
              className={cn(
                "sidebar-nav-label text-[14px]",
                active
                  ? "!font-semibold !text-zinc-900 dark:!text-zinc-100"
                  : "!font-medium !text-foreground"
              )}
            >
              {getLabel(item)}
            </span>
          )}
        </Link>
      </li>
    );
  };

  // ====================================================
  // MAIN RENDER
  // ====================================================

  return (
    <>
      <style jsx global>{`
        /* Keep selected primary navigation neutral regardless of the account accent. */
        html[data-mode="light"] .sidebar-nav-link[data-nav-active="true"],
        html:not([data-mode="dark"]) .sidebar-nav-link[data-nav-active="true"] {
          background-color: #f4f4f5 !important;
          color: #18181b !important;
        }
        html[data-mode="dark"] .sidebar-nav-link[data-nav-active="true"] {
          background-color: #27272a !important;
          color: #f4f4f5 !important;
        }
        .sidebar-nav-link[data-nav-active="true"] .sidebar-nav-label {
          color: inherit !important;
          font-weight: 600 !important;
        }
      `}</style>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label={t("closeMenu")}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm",
          "transition-opacity duration-200 lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      />

      {/* Sidebar */}
      <aside
        aria-label={t("primaryNav")}
        data-collapsed={collapsed}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-dvh flex-col",
          "border-r border-border bg-card",
          "transition-[width,transform] duration-200 ease-in-out",

          // Mobile drawer stays full width
          "w-[248px]",
          open
            ? "translate-x-0"
            : "-translate-x-full",

          // Desktop sizing
          "lg:static lg:z-0 lg:h-full lg:translate-x-0",
          collapsed
            ? "lg:w-[72px]"
            : "lg:w-[248px]"
        )}
      >
        {/* ============================================
            BRAND HEADER
        ============================================ */}

        <div
          className={cn(
            "relative flex h-[56px] shrink-0 items-center border-b border-border",
            collapsed
              ? "justify-center px-2"
              : "justify-between px-3"
          )}
        >
          {/* Brand */}
          <Link
            href="/dashboard"
            onClick={onClose}
            title={collapsed ? t("title") : undefined}
            className="flex min-w-0 items-center gap-2.5"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare size={17} strokeWidth={2} />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold tracking-tight text-foreground">
                  {t("title")}
                </p>
                <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Workspace
                </p>
              </div>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={() =>
              setCollapsed((previous) => !previous)
            }
            aria-label={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            aria-expanded={!collapsed}
            title={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            className={cn(
              "hidden size-7 shrink-0 items-center justify-center",
              "rounded-md text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40",
              "lg:flex",
              collapsed &&
              "absolute -right-3.5 top-9 z-50 border rounded-full cursor-pointer border-border bg-card shadow-sm"
            )}
          >
            {collapsed ? (
              <ChevronRight size={15} />
            ) : (
                <Menu size={15} />
            )}
          </button>

          {/* Mobile close */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeMenu")}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X size={17} />
          </button>
        </div>

        {/* ============================================
            MAIN NAVIGATION
        ============================================ */}

        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
          <ul className="space-y-1.5">
            {/* Main navigation */}
            {mainNavItems.map(renderNavItem)}

            {/* Expandable groups */}
            <li className="pt-0.5">
              <ul className="space-y-1.5">
                {expandableGroups.map(renderNavGroup)}
              </ul>
            </li>
          </ul>

          {/* ==========================================
              SUPER ADMIN
          ========================================== */}

          {isSuperAdmin && (
            <div className="mt-3 border-t border-border pt-2">
              <Link
                href="/admin"
                onClick={onClose}
                title={collapsed ? "Super Admin" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-lg",
                  "border border-amber-500/20 bg-amber-500/10",
                  "text-amber-700 transition-colors hover:bg-amber-500/15",
                  "dark:text-amber-400",
                  collapsed
                    ? "justify-center"
                    : "gap-2.5 px-2"
                )}
              >
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-amber-500/10">
                  <ShieldAlert size={17} />
                </span>

                {!collapsed && (
                  <span className="text-[13px] font-semibold">
                    Super Admin
                  </span>
                )}
              </Link>
            </div>
          )}
        </nav>

        {/* ============================================
            BOTTOM SETTINGS
        ============================================ */}

        {bottomNavItems.length > 0 && (
          <div className="shrink-0 border-t border-border px-2 py-2">
            <ul className="space-y-1.5">
              {bottomNavItems.map(renderSettingsItem)}
            </ul>
          </div>
        )}

        {/* ============================================
            ACCOUNT FOOTER
        ============================================ */}

        <div className="shrink-0 border-t border-border p-2">
          {/* Account strip */}
          {showAccountStrip && account?.name && (
            <div
              className={cn(
                "mb-1.5 flex min-w-0 items-center gap-2 rounded-md",
                "bg-muted/60 px-2 py-1.5",
                collapsed && "lg:hidden"
              )}
            >
              <UsersRound
                size={13}
                className="shrink-0 text-muted-foreground"
              />

              <span
                className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground"
                title={account.name}
              >
                {account.name}
              </span>

              {renderAccountRole()}
            </div>
          )}

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              title={
                collapsed
                  ? profile?.full_name ?? t("defaultUser")
                  : undefined
              }
              className={cn(
                "group flex w-full items-center rounded-lg p-1.5",
                "border border-transparent transition-colors",
                "hover:border-border hover:bg-muted/60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "data-popup-open:bg-muted/60",
                collapsed
                  ? "justify-center"
                  : "gap-2"
              )}
            >
              <Avatar className="size-8 shrink-0 rounded-lg">
                {profile?.avatar_url && (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={
                      profile.full_name ??
                      t("defaultAvatar")
                    }
                  />
                )}

                <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                  {profile?.full_name
                    ?.charAt(0)
                    ?.toUpperCase() ??
                    profile?.email
                      ?.charAt(0)
                      ?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>

              {!collapsed && (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[12px] font-semibold text-foreground">
                    {profile?.full_name ??
                      t("defaultUser")}
                  </span>

                  <span className="block truncate text-[10px] text-muted-foreground">
                    {profile?.email ?? ""}
                  </span>
                </span>
              )}

              {!collapsed && (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-popup-open:rotate-180" />
              )}
            </DropdownMenuTrigger>

            {/* Profile dropdown menu */}
            <DropdownMenuContent
              align={collapsed ? "start" : "end"}
              side="top"
              sideOffset={6}
              className="min-w-56 bg-popover text-popover-foreground ring-border"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-popover-foreground"
                  />
                }
              >
                <User className="size-4" />
                {t("menuProfile")}
              </DropdownMenuItem>

              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=whatsapp"
                    onClick={onClose}
                    className="text-popover-foreground"
                  />
                }
              >
                <Settings className="size-4" />
                {t("menuSettings")}
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-border" />

              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="size-4" />
                {t("menuSignOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
