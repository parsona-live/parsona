import { AuthCardSkeleton } from "@/components/skeletons/page-skeletons"

export default function JoinLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AuthCardSkeleton />
    </div>
  )
}

