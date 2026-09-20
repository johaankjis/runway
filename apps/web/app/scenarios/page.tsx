import type { Metadata } from "next";

import { ScenariosView } from "@/components/views/ScenariosView";

export const metadata: Metadata = { title: "Scenarios" };

export default function ScenariosPage() {
  return <ScenariosView />;
}
