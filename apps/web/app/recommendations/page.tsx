import type { Metadata } from "next";

import { RecommendationsView } from "@/components/views/RecommendationsView";

export const metadata: Metadata = { title: "Recommendations" };

export default function RecommendationsPage() {
  return <RecommendationsView />;
}
