import Link from "next/link";
import { EmptyState } from "@/components/Notice";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md">
      <EmptyState emoji="🔍" title="That account does not exist">
        <Link href="/" className="underline">
          Back to all accounts
        </Link>
      </EmptyState>
    </div>
  );
}
