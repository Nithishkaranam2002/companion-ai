import type { Source } from "@/lib/api";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  route?: "answer" | "refuse" | "escalate" | null;
  label?: string | null;
  sources: Source[];
  streaming?: boolean;
};

export const CRISIS_LABELS = new Set(["crisis", "medical_emergency"]);
