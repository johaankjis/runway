import type { Metadata } from "next";

import { VoiceView } from "@/components/views/VoiceView";

export const metadata: Metadata = { title: "Voice Assistant" };

export default function VoicePage() {
  return <VoiceView />;
}
