import { getRequestConfig } from "next-intl/server";

import { routing, type AppLocale } from "./routing";

function isLocale(value: string | undefined): value is AppLocale {
  return routing.locales.some((locale) => locale === value);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
