import React, { useState } from 'react';

interface MediaFrameProps {
  src: string;
  alt: string;
  aspectClass?: string;
  className?: string;
  caption?: string;
}

export function MediaFrame({
  src,
  alt,
  aspectClass = 'aspect-video',
  className = '',
  caption,
}: MediaFrameProps) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className={`relative overflow-hidden rounded-xl border border-[#FAF3E8]/14 bg-[#170B07] ${className}`}>
      <div className={`relative w-full ${aspectClass} overflow-hidden`}>
        {!failed ? (
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover block"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#341A10] via-[#24120B] to-[#170A06]">
            <svg viewBox="0 0 64 64" className="w-12 h-12 text-amber-400/70 mb-2" aria-hidden="true">
              <rect x="14" y="34" width="36" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <rect x="14" y="10" width="18" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <rect x="32" y="10" width="18" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="23" cy="22" r="4.5" fill="currentColor" />
            </svg>
            <span className="text-xs font-medium text-[#E5D3BE]/80 max-w-xs">{alt}</span>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="px-4 py-2.5 text-xs text-[#E5D3BE]/80 border-t border-[#FAF3E8]/10 bg-[#180B07]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
