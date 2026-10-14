import Link from "next/link";

/** "Featured Chef" credit on a recipe. Pass href only where a link isn't nested in another link. */
export function ChefBadge({ href, name }: { href?: string; name?: string | null }) {
  const inner = (
    <>
      <span aria-hidden>👩‍🍳</span> Featured Chef{name ? ` · ${name}` : ""}
    </>
  );
  const cls = "badge gap-1 bg-amber-100 font-semibold text-amber-900 ring-1 ring-amber-300";
  return href ? (
    <Link href={href} className={`${cls} hover:underline`} data-testid="chef-badge">
      {inner}
    </Link>
  ) : (
    <span className={cls} data-testid="chef-badge">
      {inner}
    </span>
  );
}
