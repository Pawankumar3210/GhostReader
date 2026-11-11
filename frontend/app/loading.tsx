import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-editorial py-16">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-5 h-16 w-full max-w-2xl" />
      <Skeleton className="mt-3 h-16 w-3/4 max-w-xl" />
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}
