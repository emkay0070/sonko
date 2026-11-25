import React from 'react';
import { Home, Play } from 'lucide-react';
import { Link } from '../router';

export function NotFoundPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center flex flex-col items-center gap-5">
      <p className="font-mono-num text-sm font-semibold text-amber-400">404</p>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#FAF3E8]">
        This courtyard square was not found
      </h1>
      <p className="text-base text-[#E5D3BE]/85 max-w-md">
        The page you requested does not exist or may have moved. Head back to the main courtyard or
        jump directly into the 3D game.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#2B160E] hover:bg-[#3A1E13] border border-[#FAF3E8]/18 text-[#FAF3E8] text-sm font-semibold transition-colors"
        >
          <Home className="w-4 h-4 text-amber-300" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
        <Link
          to="/play"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] text-sm font-bold transition-colors"
        >
          <Play className="w-4 h-4 fill-current" aria-hidden="true" />
          <span>Play Sonko</span>
        </Link>
      </div>
    </section>
  );
}
