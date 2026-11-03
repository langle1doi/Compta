"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { SoftDatePicker } from "@/components/compte/soft-date-picker";

export function HeaderCalendar({ initialDate }: { initialDate: string }) {
  const t = useTranslations("header");
  const locale = useLocale();
  const [selectedDate, setSelectedDate] = useState(initialDate);

  return (
    <SoftDatePicker
      className="shrink-0"
      clearable={false}
      displayFormat={locale.startsWith("fr") ? "d MMM yyyy" : "MMM d, yyyy"}
      hideLabel
      label={t("chooseDate")}
      triggerClassName="action-motion soft-button !h-10 !w-10 justify-center gap-0 !rounded-[10px] !px-0 [&>span]:hidden [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-[#044ce2] lg:!w-auto lg:justify-between lg:gap-2 lg:!px-3 lg:[&>span]:block"
      value={selectedDate}
      onChange={setSelectedDate}
    />
  );
}
