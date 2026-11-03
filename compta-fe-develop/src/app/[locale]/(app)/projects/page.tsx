import { Suspense } from "react";

import { ContentLoading } from "@/components/shell/content-loading";
import { RouteContentGate } from "@/components/shell/route-content-gate";
import { ProjectsWorkspace } from "@/features/projects/projects-workspace";

export default function ProjectsPage() {
  return (
    <RouteContentGate>
      <Suspense fallback={<ContentLoading />}>
        <ProjectsWorkspace />
      </Suspense>
    </RouteContentGate>
  );
}
