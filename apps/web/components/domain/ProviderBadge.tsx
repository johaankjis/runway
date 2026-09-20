import type { ProviderMetadata } from "@runway/contracts";
import { AlertTriangle, Cpu, FlaskConical } from "lucide-react";

import { Pill } from "@/components/ui/Badge";
import { providerDescription, providerLabel, providerTone, type ProviderKind } from "@/lib/providers";

/**
 * Accurate provider/mode pill. Live, fixture and fallback are visually distinct
 * and carry an icon plus text so the state is never conveyed by color alone.
 */
export function ProviderBadge({
  meta,
  kind,
  className,
}: {
  meta: ProviderMetadata;
  kind: ProviderKind;
  className?: string;
}) {
  const Icon = meta.mode === "live" ? Cpu : meta.mode === "fallback" ? AlertTriangle : FlaskConical;
  return (
    <Pill
      tone={providerTone(meta)}
      icon={<Icon className="h-3 w-3" aria-hidden />}
      title={providerDescription(meta, kind)}
      className={className}
    >
      {providerLabel(meta, kind)}
    </Pill>
  );
}

/** Pill plus the explanatory sentence, for places with room to be explicit. */
export function ProviderNote({ meta, kind }: { meta: ProviderMetadata; kind: ProviderKind }) {
  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
      <ProviderBadge meta={meta} kind={kind} />
      <p className="text-[11.5px] leading-relaxed text-muted">{providerDescription(meta, kind)}</p>
    </div>
  );
}
