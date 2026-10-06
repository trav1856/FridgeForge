import { NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse } from "@/lib/admin";
import { AdminActionError } from "@/lib/admin-users";

export function adminActionErrorResponse(err: unknown, label: string) {
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: err.flatten() }, { status: 400 });
  }
  if (err instanceof AdminActionError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const res = adminErrorResponse(err);
  if (res) return res;
  console.error(label, err);
  return NextResponse.json({ error: "Failed" }, { status: 500 });
}
