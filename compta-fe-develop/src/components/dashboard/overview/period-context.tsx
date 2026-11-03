"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type DashboardPeriod = "month" | "quarter" | "year";

const PeriodContext = createContext<{
  period: DashboardPeriod;
  setPeriod: (period: DashboardPeriod) => void;
}>({ period: "month", setPeriod: () => {} });

export function DashboardPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  return <PeriodContext value={{ period, setPeriod }}>{children}</PeriodContext>;
}

export function useDashboardPeriod() {
  return useContext(PeriodContext);
}
