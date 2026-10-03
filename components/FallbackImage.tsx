"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type FallbackImageProps = {
  src: string | null;
  alt: string;
  className?: string;
  /** Shown instead of the image when there is no src or it fails to load. */
  fallback: ReactNode;
};

/**
 * An <img> that swaps to `fallback` when the URL is empty or broken.
 *
 * A plain <img> is used on purpose: image URLs come from Supabase and can
 * point at any host, which next/image would need configuring for.
 */
export function FallbackImage({
  src,
  alt,
  className = "",
  fallback,
}: FallbackImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Catches images that already failed before React attached onError.
  useEffect(() => {
    const image = imageRef.current;
    if (image && image.complete && image.naturalWidth === 0) {
      setFailedSrc(src);
    }
  }, [src]);

  if (!src || failedSrc === src) {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
