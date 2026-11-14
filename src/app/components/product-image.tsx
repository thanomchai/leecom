"use client";

import Image from "next/image";
import { useState } from "react";

const FALLBACK_IMAGE = "/products/placeholder.svg";

export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const [imageSource, setImageSource] = useState(src);

  return (
    <Image
      alt={alt}
      fill
      onError={() => setImageSource(FALLBACK_IMAGE)}
      priority={priority}
      sizes={sizes}
      src={imageSource}
      unoptimized={imageSource.endsWith(".svg")}
    />
  );
}
