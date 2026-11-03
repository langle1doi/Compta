import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import { HydrationGuard } from "@/components/hydration-guard";
import { routing, type AppLocale } from "@/i18n/routing";
import { compteSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/query-provider";

import "../globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={cn(compteSans.variable, "h-full w-full overflow-hidden antialiased")}
      suppressHydrationWarning
    >
      <body
        className={cn(compteSans.className, "m-0 h-full w-full overflow-hidden font-sans")}
        suppressHydrationWarning
      >
        {/* beforeInteractive is injected into <head> by Next regardless of placement */}
        <HydrationGuard />
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <div
              hidden
              suppressHydrationWarning
              dangerouslySetInnerHTML={{
                __html:
                  "<!-- THESIS: COMPTA opens inside the operating workspace, refusing a marketing shell and making cash, quotes, invoices, and approvals visible first. OWN-WORLD: restrained blue, white work surfaces, compact finance cards, status badges, tables, and tenant controls. STORY: the user sees what needs action, creates a quote, checks invoices, and keeps tenant boundaries visible. FIRST VIEWPORT: sidebar, topbar, priority rail, KPIs, and recent business tables. FORM: established operate screen derived from the DFM prototype. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->",
              }}
            />
            {children}
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
