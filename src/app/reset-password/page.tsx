import Link from "next/link";
import { prisma } from "@/lib/db";
import { hashResetToken, isResetTokenUsable, looksLikeResetToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reset password — FridgeForge",
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  let state: "ok" | "invalid" | "expired" = "invalid";
  if (looksLikeResetToken(token)) {
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      select: { expiresAt: true, usedAt: true },
    });
    if (row) state = isResetTokenUsable(row) ? "ok" : row.usedAt ? "invalid" : "expired";
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="card p-6">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ember-700">Account</p>
        <h1 className="font-display text-2xl font-bold text-sage-900">Set a new password</h1>
        {state === "ok" ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="mt-3 space-y-3 text-sm text-sage-700" data-testid="reset-invalid">
            <p>
              {state === "expired"
                ? "This reset link has expired. Links work for one hour."
                : "This reset link is invalid or has already been used."}
            </p>
            <p>Ask a FridgeForge admin for a new link.</p>
            <Link href="/account" className="btn-secondary">
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
