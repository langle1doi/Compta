export function ActivitySkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="activity-desk" role="status">
      <div className="activity-desk__header border-b border-[#edf1f6] px-5 py-4">
        <div className="loading-shimmer h-4 w-28 rounded" />
        <div className="loading-shimmer mt-3 h-3 w-64 max-w-full rounded" />
        <div className="loading-shimmer mt-4 h-9 w-full max-w-sm rounded-[10px]" />
      </div>
      <div className="activity-desk__timeline py-2">
        <div className="px-5 pt-4">
          <div className="loading-shimmer h-3 w-16 rounded" />
        </div>
        {["a", "b", "c", "d"].map((key) => (
          <div className="grid grid-cols-[3.25rem_2rem_minmax(0,1fr)] items-start gap-x-3 px-5 py-3" key={key}>
            <div className="loading-shimmer mt-1 h-3 w-10 rounded" />
            <div className="loading-shimmer h-8 w-8 rounded-[11px]" />
            <div>
              <div className="loading-shimmer h-3 w-4/5 rounded" />
              <div className="loading-shimmer mt-2 h-3 w-3/5 rounded" />
              <div className="loading-shimmer mt-3 h-6 w-20 rounded-[7px]" />
            </div>
          </div>
        ))}
      </div>
      <div className="activity-rail">
        <div className="px-4 py-4">
          <div className="loading-shimmer h-3 w-24 rounded" />
          <div className="loading-shimmer mt-4 h-3 w-full rounded" />
          <div className="loading-shimmer mt-2 h-3 w-4/5 rounded" />
          <div className="loading-shimmer mt-4 h-10 w-full rounded-[10px]" />
        </div>
        <div className="border-t border-[#edf1f6] px-4 py-4">
          <div className="loading-shimmer h-3 w-28 rounded" />
          <div className="loading-shimmer mt-4 h-10 w-full rounded" />
          <div className="loading-shimmer mt-3 h-10 w-full rounded" />
        </div>
      </div>
    </div>
  );
}
