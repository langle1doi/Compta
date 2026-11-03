import { headers } from "next/headers";
import { Suspense } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/features/settings/components/login-form";
import { resolveHost } from "@/lib/api/host";

export default async function LoginPage() {
  const context = resolveHost((await headers()).get("host"));

  return (
    <main className="dashboard-canvas flex h-dvh min-w-0 flex-col items-center overflow-x-hidden overflow-y-auto bg-[#f3f4f6] px-4 py-8 sm:px-6">
      <div className="my-auto flex w-full max-w-[400px] min-w-0 flex-col items-center gap-6">
        <BrandLogo className="h-10 w-auto" />
        <Suspense>
          <LoginForm
            platform={context.kind === "platform"}
            tenant={context.kind === "tenant" ? context.tenant : null}
          />
        </Suspense>
      </div>
    </main>
  );
}
