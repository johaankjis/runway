"use client";

import { Bell, ChevronDown, Search } from "lucide-react";

import { Pill } from "@/components/ui/Badge";
import { useApi, useDataSourceStatus } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/States";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TopBar() {
  const business = useApi("business", api.getBusiness);
  const status = useDataSourceStatus();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-white px-6">
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-ink hover:bg-slate-100"
        aria-haspopup="listbox"
        aria-label="Switch business"
      >
        <span aria-hidden className="grid h-5 w-5 place-items-center rounded bg-navy-900 text-[10px] text-white">
          {business.data ? initials(business.data.name).slice(0, 1) : "•"}
        </span>
        {business.data ? business.data.name : <Skeleton className="h-3.5 w-32" />}
        <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      </button>

      <label className="relative ml-2 hidden flex-1 max-w-xl md:block">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-light" aria-hidden />
        <input
          type="search"
          placeholder="Search for transactions, documents, or signals…"
          className="h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-[13px] text-ink placeholder:text-muted-light focus:border-info-500 focus:bg-white"
        />
      </label>

      <div className="ml-auto flex items-center gap-3">
        {status === "fixture" ? (
          <Pill tone="warning" dot title="The Runway API is unreachable; showing the captured demo snapshot.">
            Demo data
          </Pill>
        ) : status === "live" ? (
          <Pill tone="success" dot title="Connected to the Runway API">
            Live API
          </Pill>
        ) : null}
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-slate-100"
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger-500" />
        </button>
        <div className="flex items-center gap-2.5 border-l border-line pl-3">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-full bg-navy-900 text-[12px] font-semibold text-white"
          >
            {business.data ? initials(business.data.owner_name) : "…"}
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-[12.5px] font-semibold text-ink">
              {business.data ? business.data.owner_name : <Skeleton className="h-3 w-20" />}
            </p>
            <p className="text-[11px] text-muted">Owner</p>
          </div>
        </div>
      </div>
    </header>
  );
}
