import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AdPersonalizationConsent } from '../game/settings';

interface ConsentBannerProps {
  onSelectConsent: (consent: Exclude<AdPersonalizationConsent, 'unset'>) => void;
}

export function ConsentBanner({ onSelectConsent }: ConsentBannerProps) {
  return (
    <aside
      aria-label="Cookies and ad preferences"
      className="pointer-events-auto fixed bottom-16 right-4 left-4 sm:left-auto sm:right-8 z-30 max-w-md bg-[#1D0F0A]/96 border border-amber-400/35 rounded-xl p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4 text-amber-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-[#FAF3E8]">Cookies &amp; Ad Preferences</h2>
          <p className="text-xs text-[#E5D3BE]/85 leading-relaxed mt-1">
            Sonko saves your progress locally and uses Google AdSense / H5 Games Ads to keep the courtyard free.
            Choose personalized ads or essential non-personalized ads. See our{' '}
            <a
              href="/privacy-policy"
              className="text-amber-300 underline hover:text-amber-200 font-medium"
            >
              Privacy Policy
            </a>
            .
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectConsent('personalized')}
              className="px-3.5 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] text-xs font-bold transition-colors cursor-pointer"
            >
              Accept &amp; Continue
            </button>
            <button
              type="button"
              onClick={() => onSelectConsent('non_personalized')}
              className="px-3 py-1.5 rounded-lg bg-[#2E1810] hover:bg-[#3E2116] border border-[#FAF3E8]/20 text-[#FAF3E8] text-xs font-medium transition-colors cursor-pointer"
            >
              Non-Personalized Only
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
