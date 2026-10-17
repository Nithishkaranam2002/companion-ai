import type { Metadata } from "next";

import { MoodTracker } from "@/components/mood/mood-tracker";

export const metadata: Metadata = { title: "Mood tracker" };

export default function MoodPage() {
  return <MoodTracker />;
}
