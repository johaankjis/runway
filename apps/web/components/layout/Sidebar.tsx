"use client";

import {
  ArrowLeftRight,
  Bell,
  FileText,
  Home,
  Lightbulb,
  Mic,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CountBadge } from "@/components/ui/Badge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "signals";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/signals", label: "Signals", icon: Bell, badge: "signals" },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/cash-flow", label: "Cash Flow", icon: ArrowLeftRight },
  { href: "/scenarios", label: "Scenarios", icon: SlidersHorizontal },
  { href: "/voice", label: "Voice Assistant", icon: Mic },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
];

const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function RunwayLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden>
          <path
            d="M4 18 L11 6 L15 13 L20 6"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="6" r="2" fill="#F97316" />
        </svg>
      </span>
      <span className="text-[19px] font-bold tracking-tight">Runway</span>
    </span>
  );
}

function NavLink({ item, active, badgeCount }: { item: NavItem; active: boolean; badgeCount?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
        active
          ? "bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          : "text-slate-300/85 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-white")}
        aria-hidden
      />
      <span className="flex-1 truncate">{item.label}</span>
      {badgeCount ? (
        <>
          <CountBadge count={badgeCount} />
          <span className="sr-only">{badgeCount} high-impact signals</span>
        </>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const signals = useApi("signals", api.getSignals);
  const urgentCount =
    signals.data?.filter((signal) => signal.impact_level === "critical" || signal.impact_level === "high")
      .length ?? 0;

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col bg-navy-900 text-white">
      <div className="px-5 pb-4 pt-6">
        <Link href="/" className="inline-flex rounded-md">
          <RunwayLogo />
        </Link>
        <p className="mt-2 text-[11.5px] leading-snug text-slate-400">
          See what&apos;s coming.
          <br />
          Stay in control.
        </p>
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                active={isActive(pathname, item.href)}
                badgeCount={item.badge === "signals" ? urgentCount : undefined}
              />
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-white/10 pt-2">
          <NavLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} />
        </div>
      </nav>

      <div className="p-3">
        <div className="rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
          <p className="text-[13px] font-semibold leading-snug text-white">
            A stronger tomorrow for small businesses.
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
            Every warning traces back to a source you can read.
          </p>
        </div>
      </div>
    </aside>
  );
}
