import { useState } from 'react';

// Falls back to a neutral placeholder if the image is missing or fails to load.
export default function BikeImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed || !src ? '/images/bikes/placeholder.svg' : src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-neutral-200 object-cover ${className}`}
    />
  );
}
