import Link from "next/link";

export function MenuModeTabs({ mode }: { mode: "pantry" | "diet" }) {
  const cls = (on: boolean) => (on ? "btn-primary px-4 py-2 text-sm" : "btn-secondary px-4 py-2 text-sm");
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Menu mode" data-testid="menu-mode-tabs">
      <Link href="/menu" className={cls(mode === "pantry")} data-testid="mode-pantry" aria-current={mode === "pantry" ? "page" : undefined}>Pantry menu</Link>
      <Link href="/menu?mode=diet" className={cls(mode === "diet")} data-testid="mode-diet" aria-current={mode === "diet" ? "page" : undefined}>Diet plan</Link>
    </nav>
  );
}
