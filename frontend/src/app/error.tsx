"use client";

import { ErrorNotice } from "@/components/Notice";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <ErrorNotice error={error} />
      <Button variant="ghost" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
