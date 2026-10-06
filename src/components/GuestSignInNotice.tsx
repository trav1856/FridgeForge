"use client";

import Link from "next/link";
import { useViewer } from "@/lib/viewer-client";

/** Friendly banner for guests on pages whose actions need an account. */
export function GuestSignInNotice({
  title,
  body,
  testId = "guest-signin-notice",
}: {
  title: string;
  body?: string;
  testId?: string;
}) {
  const viewer = useViewer();
  if (viewer?.kind !== "guest") return null;
  return (
    <div
      role="status"
      data-testid={testId}
      className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-amber-800">
        {body ? `${body} ` : ""}
        <Link href="/account" className="font-semibold underline">
          Sign in or create an account
        </Link>
      </p>
    </div>
  );
}
