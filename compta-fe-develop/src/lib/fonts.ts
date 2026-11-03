import localFont from "next/font/local";

/**
 * COMPTE UI typeface — Inter (self-hosted).
 *
 * Source: official rsms/inter repository release v4.1
 * https://github.com/rsms/inter
 *
 * License: SIL Open Font License 1.1 (see public/fonts/inter/LICENSE.txt)
 *
 * Self-hosted: YES — files live in public/fonts/inter/ and are loaded via
 * next/font/local. No Google Fonts, fonts.gstatic, or remote CDN at runtime.
 */
export const compteSans = localFont({
  src: [
    {
      path: "../../public/fonts/inter/InterVariable.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter/InterVariable-Italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-compte-sans",
  display: "swap",
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "sans-serif",
  ],
});
