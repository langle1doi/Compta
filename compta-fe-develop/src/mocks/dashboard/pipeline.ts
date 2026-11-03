import {
  buildPipelineSummary,
  buildQuotePipeline,
} from "@/features/quotes/dashboard-source";
import { seedQuotes } from "@/features/quotes/seed";

export const quotePipeline = buildQuotePipeline(seedQuotes);

export const pipelineSummary = buildPipelineSummary(seedQuotes);
