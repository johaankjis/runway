"use client";

import type { Business } from "@runway/contracts";
import { Bell, Building2, CreditCard, Database, Mic, Shield, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

type Section = "profile" | "sources" | "notifications" | "voice" | "security" | "billing";

const SECTIONS: Array<{ key: Section; label: string; icon: LucideIcon }> = [
  { key: "profile", label: "Business Profile", icon: Building2 },
  { key: "sources", label: "Data Sources", icon: Database },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "voice", label: "Voice Settings", icon: Mic },
  { key: "security", label: "Security", icon: Shield },
  { key: "billing", label: "Billing", icon: CreditCard },
];

const INDUSTRIES = ["Catering and events", "Food & Beverage", "Retail", "Professional services", "Construction", "Other"];
const SIZES = ["1–10 employees", "11–50 employees", "51–200 employees"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];

interface ProfileForm {
  name: string;
  industry: string;
  owner_name: string;
  timezone: string;
  size: string;
}

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-[13px] text-ink focus:border-info-500";

function Toggle({ label, description, defaultOn = true }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="text-[12px] text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn(!on)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-navy-900" : "bg-slate-300",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            on ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

function ProfileSection({ business }: { business: Business }) {
  const [form, setForm] = useState<ProfileForm>({
    name: business.name,
    industry: INDUSTRIES.includes(business.industry) ? business.industry : INDUSTRIES[0],
    owner_name: business.owner_name,
    timezone: business.timezone,
    size: SIZES[0],
  });
  const [saved, setSaved] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  const update = (patch: Partial<ProfileForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  return (
    <Card>
      <CardHeader title="Business Profile" subtitle="Seeded from the Runway API. Edits are kept locally in this milestone." />
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setDirty(false);
          setSaved("Profile saved for this session. A write endpoint is not part of Milestone 1.");
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="business-name" className="text-[12.5px] font-medium text-ink">Business name</label>
            <input id="business-name" required value={form.name} onChange={(e) => update({ name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="industry" className="text-[12.5px] font-medium text-ink">Industry</label>
            <select id="industry" value={form.industry} onChange={(e) => update({ industry: e.target.value })} className={inputClass}>
              {INDUSTRIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="owner-name" className="text-[12.5px] font-medium text-ink">Owner</label>
            <input id="owner-name" required value={form.owner_name} onChange={(e) => update({ owner_name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="size" className="text-[12.5px] font-medium text-ink">Business size</label>
            <select id="size" value={form.size} onChange={(e) => update({ size: e.target.value })} className={inputClass}>
              {SIZES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="timezone" className="text-[12.5px] font-medium text-ink">Time zone</label>
            <select id="timezone" value={form.timezone} onChange={(e) => update({ timezone: e.target.value })} className={inputClass}>
              {TIMEZONES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="currency" className="text-[12.5px] font-medium text-ink">Currency</label>
            <input id="currency" value={business.currency} readOnly aria-readonly className={cn(inputClass, "bg-slate-50 text-muted")} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
          <p role="status" aria-live="polite" className="text-[12px] text-success-600">{saved ?? ""}</p>
          <Button type="submit" disabled={!dirty}>Save changes</Button>
        </div>
      </form>
    </Card>
  );
}

export function SettingsView() {
  const business = useApi("business", api.getBusiness);
  const [section, setSection] = useState<Section>("profile");

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your business profile and preferences." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Settings sections">
          <ul className="space-y-0.5">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = item.key === section;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setSection(item.key)}
                    className={cn(
                      "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
                      active ? "bg-info-50 text-info-600" : "text-ink-soft hover:bg-white hover:text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div>
          {section === "profile" ? (
            business.error ? (
              <ErrorState title="Could not load business" error={business.error} onRetry={business.refetch} />
            ) : business.data ? (
              <ProfileSection business={business.data} />
            ) : (
              <Card>
                <LoadingState lines={5} />
              </Card>
            )
          ) : null}

          {section === "sources" ? (
            <Card>
              <CardHeader title="Data Sources" subtitle="Where Runway reads financial activity and business signals." />
              <ul className="divide-y divide-line">
                {[
                  { name: "Deterministic demo fixture", detail: "data/synthetic/demo.json", status: "Connected", tone: "success" as const },
                  { name: "Source documents", detail: "5 synthetic documents", status: "Connected", tone: "success" as const },
                  { name: "Bank feed", detail: "Not part of this milestone", status: "Not connected", tone: "neutral" as const },
                  { name: "Accounting software", detail: "Not part of this milestone", status: "Not connected", tone: "neutral" as const },
                ].map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-ink">{item.name}</p>
                      <p className="text-[12px] text-muted">{item.detail}</p>
                    </div>
                    <Pill tone={item.tone} dot>{item.status}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {section === "notifications" ? (
            <Card>
              <CardHeader title="Notifications" subtitle="Choose which early warnings reach you." />
              <div className="divide-y divide-line">
                <Toggle label="Critical cash alerts" description="Projected shortfalls and runway under 30 days." />
                <Toggle label="New high-impact signals" description="Supplier, receivable, and payroll changes." />
                <Toggle label="Daily summary" description="A short morning digest of what changed." defaultOn={false} />
              </div>
            </Card>
          ) : null}

          {section === "voice" ? (
            <Card>
              <CardHeader title="Voice Settings" subtitle="Preferences for the voice assistant." />
              <div className="divide-y divide-line">
                <Toggle label="Enable voice assistant" description="Show the microphone on the Voice page." />
                <Toggle label="Shorten responses for demo" description="Keep spoken answers under 20 seconds." />
                <Toggle label="Read alerts aloud" description="Speak critical alerts when the app opens." defaultOn={false} />
              </div>
              <p className="mt-3 text-[12px] text-muted">
                Speech is produced by the Runway API. Set RUNWAY_VOICE_PROVIDER=elevenlabs with an ElevenLabs key and voice ID
                for live audio; the default fixture mode is text-only.
              </p>
            </Card>
          ) : null}

          {section === "security" ? (
            <Card>
              <CardHeader title="Security" subtitle="Account protection settings." />
              <div className="divide-y divide-line">
                <Toggle label="Two-factor authentication" description="Require a code when signing in." defaultOn={false} />
                <Toggle label="Session timeout" description="Sign out after 30 minutes of inactivity." />
              </div>
              <p className="mt-3 text-[12px] text-muted">Authentication is not part of this milestone; these are preferences only.</p>
            </Card>
          ) : null}

          {section === "billing" ? (
            <Card>
              <CardHeader title="Billing" subtitle="Plan and payment details." />
              <div className="flex items-center justify-between rounded-xl bg-canvas p-4">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Hackathon plan</p>
                  <p className="text-[12px] text-muted">All features enabled for the demo.</p>
                </div>
                <Pill tone="success" dot>Active</Pill>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
