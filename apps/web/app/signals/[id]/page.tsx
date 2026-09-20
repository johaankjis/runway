import type { Metadata } from "next";

import { SignalDetailView } from "@/components/views/SignalDetailView";

export const metadata: Metadata = { title: "Signal detail" };

export default async function SignalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SignalDetailView id={id} />;
}
