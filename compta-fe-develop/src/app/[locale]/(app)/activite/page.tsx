import { ActivityPanel } from "@/components/dashboard/activity/activity-panel";

export default function ActivityLogPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 xl:px-8">
        <ActivityPanel className="h-[max(480px,calc(100dvh-8.5rem))]" />
      </div>
    </div>
  );
}
