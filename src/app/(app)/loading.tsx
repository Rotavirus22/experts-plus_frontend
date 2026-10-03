/** Skeleton shown while a page's data loads (shimmer disabled for reduced motion). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border bg-card motion-reduce:animate-none" />
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
