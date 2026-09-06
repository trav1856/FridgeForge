"use client";

import { useEffect, useState } from "react";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  /** taller hero on detail pages */
  variant?: "card" | "hero";
};

const PLACEHOLDER = "/recipe-images/placeholder.svg";

/**
 * Recipe photo with hard fallback to the branded SVG so broken/weird remotes
 * (expired CDNs, Lorem Flickr junk, etc.) never stick on screen.
 */
export function RecipeImage({
  src,
  alt,
  className = "",
  variant = "card",
}: Props) {
  const [failed, setFailed] = useState(false);
  const height = variant === "hero" ? "h-48 sm:h-64" : "h-36";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const remoteOk = Boolean(src) && !failed;
  const displaySrc = remoteOk ? src! : PLACEHOLDER;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      className={`w-full object-cover ${height} rounded-xl bg-cream-100 ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (remoteOk) setFailed(true);
      }}
    />
  );
}
