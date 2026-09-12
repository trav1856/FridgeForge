import type { HowToBadgeDTO } from "@/lib/howto";

type Props = {
  badge: Pick<HowToBadgeDTO, "title" | "emoji" | "description" | "imageUrl">;
  className?: string;
  compact?: boolean;
};

/** Shared badge pill: optional photo + emoji + title. */
export function BadgeChip({ badge, className = "", compact }: Props) {
  return (
    <li
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-full bg-ember-50 px-3 py-1.5 text-sm font-medium text-ember-900 ring-1 ring-ember-200"
      }
      title={badge.description ?? undefined}
    >
      {badge.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={badge.imageUrl}
          alt=""
          className={
            compact
              ? "h-4 w-4 rounded-full object-cover"
              : "h-5 w-5 rounded-full object-cover"
          }
        />
      ) : (
        <span aria-hidden>{badge.emoji}</span>
      )}
      <span className={compact ? "hidden sm:inline" : undefined}>
        {badge.title}
      </span>
    </li>
  );
}
