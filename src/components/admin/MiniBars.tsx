import clsx from "clsx";

/** Tiny bar chart (server-renderable). Last bar is highlighted. */
export function MiniBars({
  values,
  labels,
  className,
  heightClass = "h-10",
}: {
  values: number[];
  labels?: string[];
  className?: string;
  heightClass?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className={clsx("flex items-end gap-1", heightClass, className)} role="img" aria-label={values.join(", ")}>
      {values.map((v, i) => (
        <span
          key={i}
          title={labels?.[i] ? `${labels[i]}: ${v}` : String(v)}
          className={clsx(
            "flex-1 rounded-t-[4px] rounded-b-[1px]",
            i === values.length - 1 ? "bg-ember-600" : "bg-ember-200"
          )}
          style={{ height: `${Math.max(6, Math.round((v / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}
