import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
