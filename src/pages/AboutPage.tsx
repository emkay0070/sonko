import React from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { Link } from '../router';
import { MediaFrame } from '../components/MediaFrame';
import courtyardBackdropImg from '../assets/images/sonko_courtyard_backdrop_1794906695971.jpg';

const WORLDS = [
  {
    name: 'Primary Schoolyard',
    detail:
      'Red-brick classrooms, open shaded verandas, dusty courtyard chalk, assembly flagpole, and lush mango tree shade.',
  },
  {
    name: 'Kampala Compound',
    detail:
      'Sun-baked red murram soil framed by banana groves, mango shade, boundary walls, and warm veranda roofs.',
  },
  {
    name: 'Entebbe Lakeshore',
    detail:
      'Coastal breeze, warm shoreline sand, swaying palm canopies, and Lake Victoria waters nearby.',
  },
  {
    name: 'Jinja Rain Garden',
    detail:
      'Lush river mist, wet reflective puddles across court tiles, and drifting tropical rain showers.',
  },
  {
    name: 'Ndere Night Pavilion',
    detail:
      'Warm amber lantern glow, evening drums, firelight ambiance, and celebratory festival rounds.',
  },
];

export function AboutPage() {
  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="border-b border-[#FAF3E8]/12 pb-8 mb-10">
        <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
          Our Story &amp; Heritage
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#FAF3E8] tracking-tight">
          About Sonko
        </h1>
        <p className="text-base text-[#E5D3BE]/85 mt-3 leading-relaxed max-w-2xl">
          Cultural heritage, tactile 3D environments, and browser-native multiplayer inspired by
          Uganda&apos;s timeless courtyard hopscotch tradition.
        </p>
      </header>

      <div className="flex flex-col gap-10 text-[#E5D3BE] leading-relaxed">
        <MediaFrame
          src={courtyardBackdropImg}
          alt="Illustrated Ugandan compound courtyard with banana trees, thatch hut, and chalk hopscotch court on red earth"
          aspectClass="aspect-video"
          caption="Traditional red murram courtyard inspiration behind Sonko"
        />

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-[#FDE68A]">
            Preserving Ugandan Courtyard Hopscotch in 3D
          </h2>
          <p>
            <strong>Sonko</strong> brings the beloved Ugandan schoolyard and home-compound hopscotch
            game into a sunlit, tactile 3D web experience. Known across generations for lively
            afternoon matches drawn in chalk on warm red murram earth, Sonko blends precision stone
            tossing (<em>Ejjinja</em>), rhythmic single-foot hopping, balance control, and the
            thrilling blind back-toss used to claim a square as your own <em>House</em>.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold text-[#FDE68A]">
            Five Hand-Crafted Worlds &amp; Venues
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {WORLDS.map((w) => (
              <div
                key={w.name}
                className="rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-5 flex flex-col gap-1.5"
              >
                <h3 className="font-display text-lg font-bold text-[#FAF3E8]">{w.name}</h3>
                <p className="text-sm text-[#E5D3BE]/85 leading-relaxed">{w.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-[#FDE68A]">
            Dynamic Weather &amp; Living Courtyards
          </h2>
          <p>
            Every venue responds to time-of-day presets and real-time weather conditions. When wind
            picks up or tropical rain sweeps across Jinja, canopy leaves sway organically in synced
            wind gusts, puddles shimmer across court tiles, and rain and mist intensity adapts smoothly
            while maintaining responsive browser performance.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-[#FDE68A]">
            Browser-First &amp; Offline Ready
          </h2>
          <p>
            Sonko runs directly in modern desktop and mobile browsers with zero downloads required. It
            supports offline Progressive Web App (PWA) caching for Solo, VS Bot, 2-Player Local, and
            2v2 Teams, alongside real-time WebSocket rooms for Online 1v1 duels and a persistent Global
            Leaderboard. Have feedback or partnership questions? Reach us on our{' '}
            <Link to="/contact" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
              Contact page
            </Link>
            .
          </p>
        </section>

        <div className="border-t border-[#FAF3E8]/12 pt-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/play"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-display font-bold text-sm transition-colors"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Play Sonko</span>
          </Link>
          <Link
            to="/how-to-play"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 hover:text-amber-200"
          >
            <span>Read How to Play</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
