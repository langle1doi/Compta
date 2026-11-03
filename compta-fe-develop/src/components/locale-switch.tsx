"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

const localeMeta: Record<AppLocale, { nameKey: "nameFr" | "nameEn"; hintKey: "hintFr" | "hintEn" }> = {
  fr: { nameKey: "nameFr", hintKey: "hintFr" },
  en: { nameKey: "nameEn", hintKey: "hintEn" },
};

export function LocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("settings");

  function selectLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("languageTitle")}>
      {routing.locales.map((code) => {
        const selected = code === locale;
        const meta = localeMeta[code];

        return (
          <button
            aria-checked={selected}
            className={`flex min-h-[72px] items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors duration-150 ${
              selected
                ? "border-[#b9d0fb] bg-[#f2f6ff]"
                : "border-[#dfe6f1] bg-white hover:border-[#b9d0fb]"
            }`}
            key={code}
            role="radio"
            type="button"
            onClick={() => selectLocale(code)}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#063586]">{t(meta.nameKey)}</span>
              <span className="mt-1 block text-xs leading-5 text-[#66758d]">{t(meta.hintKey)}</span>
            </span>
            {selected ? (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e7efff] text-[#044ce2]">
                <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
            ) : (
              <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-[#dfe6f1]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
