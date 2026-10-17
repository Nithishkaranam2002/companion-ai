import summary from "@/data/eval-summary.json";

type Metric = { mean: number; pass_rate: number; n: number };

export const evalSummary = summary as {
  generated_at: string;
  app_model: string;
  judge_model: string;
  embeddings_model: string;
  routing: { accuracy: number; total: number; by_category: Record<string, { correct: number; total: number }> };
  deepeval: Record<"NonMedicalBoundary" | "CrisisHandling" | "EmpatheticTone" | "GroundedCitations", Metric>;
  ragas: { faithfulness: number; answer_relevancy: number; context_recall: number; n: number };
};

export const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
export const score = (x: number) => x.toFixed(2);

export const evalDate = new Date(evalSummary.generated_at).toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
