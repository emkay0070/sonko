import React, { useState } from 'react';
import { Menu, Play, X } from 'lucide-react';
import { AppRoute, Link, useRouter } from '../router';

interface SiteLayoutProps {
  children: React.ReactNode;
}

const HEADER_NAV: Array<{ to: AppRoute; label: string }> = [
  { to: '/', label: 'Home' },
  { to: '/play', label: 'Play Sonko' },
  { to: '/how-to-play', label: 'How to Play' },
  { to: '/about', label: 'About' },
];

const FOOTER_LINKS: Array<{ to: AppRoute; label: string }> = [
  { to: '/about', label: 'About Sonko' },
  { to: '/how-to-play', label: 'How to Play' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Use' },
];

export function SiteLayout({ children }: SiteLayoutProps) {
  const { route } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#1F100B] text-[#FAF3E8]">
      {/* Sticky Top Navigation Bar (3-zone contract: Brand | Nav Links | Primary Action) */}
      <header className="sticky top-0 z-40 border-b border-[#FAF3E8]/12 bg-[#170B07]/95">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Clean single-line brand wordmark */}
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="font-display text-xl font-extrabold tracking-tight text-[#FAF3E8] hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2.5"
          >
            <svg
              viewBox="0 0 28 28"
              className="w-6 h-6 shrink-0"
              aria-hidden="true"
            >
              <rect
                x="4"
                y="15"
                width="20"
                height="11"
                rx="1.5"
                fill="none"
                stroke="#FAF3E8"
                strokeWidth="2"
                strokeOpacity="0.7"
              />
              <rect
                x="4"
                y="2"
                width="10"
                height="13"
                rx="1.5"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
              />
              <rect
                x="14"
                y="2"
                width="10"
                height="13"
                rx="1.5"
                fill="none"
                stroke="#FAF3E8"
                strokeWidth="2"
                strokeOpacity="0.7"
              />
              <circle cx="9" cy="8.5" r="2.6" fill="#F59E0B" />
            </svg>
            <span>SONKO</span>
          </Link>

          {/* Zone 2: Clean typographic navigation links */}
          <nav
            aria-label="Primary site navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {HEADER_NAV.map((item) => {
              const isActive = route === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    isActive
                      ? 'text-amber-300 border-amber-400 font-semibold'
                      : 'text-[#E5D3BE]/85 border-transparent hover:text-[#FAF3E8] hover:border-[#FAF3E8]/35'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action + mobile menu toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/play"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] text-sm font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Play Sonko</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[#FAF3E8]/15 bg-[#26130C] text-[#FAF3E8] hover:bg-[#341A11] cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-[#FAF3E8]/12 bg-[#1B0D08] px-4 py-3 flex flex-col gap-1"
          >
            {HEADER_NAV.map((item) => {
              const isActive = route === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 font-semibold'
                      : 'text-[#E5D3BE] hover:bg-white/5 hover:text-[#FAF3E8]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="border-t border-[#FAF3E8]/10 mt-2 pt-2 flex flex-wrap gap-x-4 gap-y-1 px-3 py-1 text-xs text-[#E5D3BE]/75">
              <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="hover:text-amber-300">
                Contact Us
              </Link>
              <Link to="/privacy" onClick={() => setMobileMenuOpen(false)} className="hover:text-amber-300">
                Privacy Policy
              </Link>
              <Link to="/terms" onClick={() => setMobileMenuOpen(false)} className="hover:text-amber-300">
                Terms of Use
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#FAF3E8]/12 bg-[#140906]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-md">
              <Link
                to="/"
                className="font-display text-lg font-extrabold tracking-tight text-[#FAF3E8] hover:text-amber-300 transition-colors"
              >
                SONKO
              </Link>
              <p className="text-sm text-[#E5D3BE]/75 mt-1.5 leading-relaxed">
                Traditional Ugandan courtyard hopscotch in 3D. Toss your Ejjinja, hold your balance,
                and claim your House on sunlit red murram earth.
              </p>
            </div>

            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm"
            >
              {FOOTER_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`transition-colors whitespace-nowrap ${
                    route === item.to
                      ? 'text-amber-300 font-semibold'
                      : 'text-[#E5D3BE]/85 hover:text-amber-300'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-t border-[#FAF3E8]/10 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#E5D3BE]/60">
            <span>&copy; {new Date().getFullYear()} Sonko — Ugandan Courtyard Hopscotch. All rights reserved.</span>
            <span>Kampala · Entebbe · Jinja · Ndere</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
