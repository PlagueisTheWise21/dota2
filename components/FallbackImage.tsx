"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type FallbackImageProps = {
  src: string | null;
  /** Tried when `src` fails, before showing the fallback. */
  retrySrc?: string | null;
  alt: string;
  className?: string;
  /** Shown instead of the image when there is no src or every source fails. */
  fallback: ReactNode;
};

/**
 * An <img> that tries `src`, then `retrySrc`, then shows `fallback`.
 *
 * A plain <img> is used on purpose: image URLs come from Supabase and can
 * point at any host, which next/image would need configuring for.
 */
export function FallbackImage({
  src,
  retrySrc = null,
  alt,
  className = "",
  fallback,
}: FallbackImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState<string[]>([]);

  const current =
    [src, retrySrc].find(
      (source): source is string => Boolean(source) && !failed.includes(source!),
    ) ?? null;

  function markFailed(source: string) {
    setFailed((list) => (list.includes(source) ? list : [...list, source]));
  }

  // Catches images that already failed before React attached onError.
  useEffect(() => {
    const image = imageRef.current;
    if (current && image && image.complete && image.naturalWidth === 0) {
      markFailed(current);
    }
  }, [current]);

  if (!current) {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={current}
      ref={imageRef}
      src={current}
      alt={alt}
      draggable={false}
      onError={() => markFailed(current)}
      className={className}
    />
  );
}
