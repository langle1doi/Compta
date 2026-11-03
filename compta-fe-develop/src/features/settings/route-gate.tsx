"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

import { canOpenRoute, firstOpenRoute } from "./route-permissions";
import { useSession } from "./session-provider";

/** Page content only mounts, and so only fetches, once the user is known to have access. */
export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, permissions } = useSession();

  const allowed = status === "ready" && canOpenRoute(pathname, permissions);
  // "/" is the landing page rather than a page someone asked for: send them where they can work.
  const landingRoute =
    status === "ready" && pathname === "/" && !allowed
      ? firstOpenRoute(permissions)
      : null;

  useEffect(() => {
    if (landingRoute) router.replace(landingRoute);
  }, [landingRoute, router]);

  if (status === "error") return <ForbiddenState variant="error" />;
  if (status === "loading" || landingRoute) return <ContentLoading />;
  if (!allowed) return <ForbiddenState />;
  return children;
}

export function ForbiddenState({
  variant = "forbidden",
}: {
  variant?: "forbidden" | "error";
}) {
  const t = useTranslations("access");
  const { permissions } = useSession();
  const back = variant === "forbidden" ? firstOpenRoute(permissions) : null;

  return (
    <main className="dashboard-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="dashboard-page flex min-h-0 min-w-0 flex-1 items-center justify-center">
        <section className="dashboard-card flex w-full max-w-[440px] flex-col items-center gap-2 px-6 py-10 text-center">
          <ShieldAlert aria-hidden="true" className="h-8 w-8 text-[#b7c3d6]" />
          <h2 className="text-sm font-semibold text-[#24334c]">
            {t(`${variant}.title`)}
          </h2>
          <p className="max-w-[42ch] text-xs leading-5 text-[#7d8aa0]">
            {t(`${variant}.body`)}
          </p>
          {back ? (
            <Link
              className="action-motion soft-button mt-2 inline-flex min-h-10 items-center rounded-[10px] px-3 text-sm font-semibold text-[#405069]"
              href={back}
            >
              {t("back")}
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
