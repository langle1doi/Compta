import { buildRecentQuotes } from "@/features/quotes/dashboard-source";
import { seedQuotes } from "@/features/quotes/seed";

export const recentQuotes = buildRecentQuotes(seedQuotes);
