import type { Metadata } from "next";

import { HomeView } from "@/components/views/HomeView";

export const metadata: Metadata = { title: "Overview · Runway" };

export default function HomePage() {
  return <HomeView />;
}
