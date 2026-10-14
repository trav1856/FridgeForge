"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jsonFetch } from "./api";

export function NewPostButton({ label = "New post" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn-primary"
        disabled={busy}
        data-testid="new-post"
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const { post } = await jsonFetch<{ post: { id: string } }>("/api/content/posts", "POST", { title: "Untitled post" });
            router.push(`/studio/posts/${post.id}`);
          } catch (e) {
            setErr((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {label}
      </button>
      {err && <span role="alert" className="text-sm text-red-700">{err}</span>}
    </>
  );
}
