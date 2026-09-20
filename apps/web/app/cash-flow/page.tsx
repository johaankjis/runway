import type { Metadata } from "next";

import { CashFlowView } from "@/components/views/CashFlowView";

export const metadata: Metadata = { title: "Cash Flow" };

export default function CashFlowPage() {
  return <CashFlowView />;
}
