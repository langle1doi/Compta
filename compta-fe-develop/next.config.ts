import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** IPv4 addresses of this machine: the LAN address can change with DHCP. */
function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry?.family === "IPv4")
    .map((entry) => entry?.address ?? "");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    ...new Set([
      "127.0.0.1",
      // <tenant>.<ip>.nip.io has several labels: "**" matches them, "*" only one.
      "**.nip.io",
      ...localAddresses(),
      ...(process.env.ALLOWED_DEV_ORIGINS?.split(",").map((origin) =>
        origin.trim(),
      ) ?? []),
    ]),
  ].filter(Boolean),
};

export default withNextIntl(nextConfig);
