import type { Metadata } from "next";

import { SignalsView } from "@/components/views/SignalsView";

export const metadata: Metadata = { title: "Signals" };

export default function SignalsPage() {
  return <SignalsView />;
}
