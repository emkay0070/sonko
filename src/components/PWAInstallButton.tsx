import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'title' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'title' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Suppress button only when already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '/';

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={
          variant === 'compact'
            ? 'w-full py-3 px-4 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-amber-400/35 text-amber-200 font-medium text-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400'
            : 'inline-flex items-center gap-2 px-4 py-3.5 rounded-lg bg-[#2E170F]/90 hover:bg-[#3F2015] border border-amber-400/35 text-sm font-semibold text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400'
        }
      >
        {isIOS ? (
          <Smartphone className="w-4 h-4 text-amber-300" aria-hidden="true" />
        ) : (
          <Download className="w-4 h-4 text-amber-300" aria-hidden="true" />
        )}
        <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install Sonko App"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-md bg-[#24120C] border border-[#FAF3E8]/20 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-bold text-[#FAF3E8]">
                  Install Sonko App
                </h3>
                <p className="text-xs text-[#E5D3BE]/75 mt-0.5">
                  Add Sonko to your home screen for offline Solo, vs Bot &amp; 2P Local play
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="p-1.5 rounded-lg text-[#E5D3BE]/75 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe && (
              <div className="rounded-lg bg-[#1A0B07]/90 border border-amber-400/30 p-3.5 flex flex-col gap-2.5 text-xs text-[#F3E6D6]/90">
                <p>
                  Browsers block direct app installation inside embedded preview frames. Open Sonko
                  in its own browser tab first to trigger the native install prompt:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-semibold text-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Open Standalone Tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#381E14] hover:bg-[#49281B] border border-[#FAF3E8]/15 text-[#FAF3E8] font-medium text-xs transition-colors cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                        <span>Copied Link</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copy App Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {isIOS ? (
              <ol className="flex flex-col gap-3 text-sm text-[#F3E6D6]/90">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-num text-xs font-semibold text-amber-400 pt-0.5 shrink-0">
                    01.
                  </span>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <span>Tap</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1A0B07] border border-[#FAF3E8]/15 text-amber-200 text-xs font-medium">
                      <Share className="w-3 h-3" aria-hidden="true" />
                      Share
                    </span>
                    <span>in Safari&apos;s toolbar.</span>
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-num text-xs font-semibold text-amber-400 pt-0.5 shrink-0">
                    02.
                  </span>
                  <span>
                    Scroll down and tap{' '}
                    <strong className="text-[#FAF3E8]">Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="flex flex-col gap-2.5 text-sm text-[#F3E6D6]/90">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-num text-xs font-semibold text-amber-400 pt-0.5 shrink-0">
                    01.
                  </span>
                  <span>
                    {isAndroid
                      ? 'Open Chrome’s 3-dot menu in the top-right corner.'
                      : 'In Chrome or Edge, look for the Install icon on the right side of the address bar (or open the browser menu).'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-num text-xs font-semibold text-amber-400 pt-0.5 shrink-0">
                    02.
                  </span>
                  <span>
                    Select <strong className="text-[#FAF3E8]">Install Sonko</strong> or{' '}
                    <strong className="text-[#FAF3E8]">Add to Home screen</strong>.
                  </span>
                </li>
              </ol>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              {isInstallable && (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-semibold text-sm transition-colors cursor-pointer"
                >
                  Install Now
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className={`${
                  isInstallable ? 'px-5 bg-[#381E14] text-[#FAF3E8]' : 'w-full bg-[#F59E0B] text-[#1A0B07]'
                } py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors cursor-pointer`}
              >
                {isInstallable ? 'Close' : 'Got It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
