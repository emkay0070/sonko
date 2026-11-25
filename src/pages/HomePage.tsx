import React from 'react';
import { ArrowRight, Compass, Globe, Play, ShieldCheck, ShoppingBag, Sparkles, Trophy, Users } from 'lucide-react';
import { Link } from '../router';
import { MediaFrame } from '../components/MediaFrame';
import heroPreviewImg from '../assets/images/hero_sonko_courtyard_play_1795599933272.jpg';
import entebbeImg from '../assets/images/world_entebbe_lakeshore_1795599934486.jpg';
import ndereImg from '../assets/images/world_ndere_lanterns_1795599935013.jpg';
import backdropImg from '../assets/images/sonko_courtyard_backdrop_1794906695971.jpg';
import stoneEmblemImg from '../assets/images/sonko_emblem_stone_1794906695885.jpg';

const GAME_MODES = [
  {
    index: '01',
    title: 'Solo Practice & Mastery',
    description:
      'Hone your Ejjinja stone aim, master single-foot balance in crosswinds, and clear full 10-square rounds at your own pace.',
    icon: Sparkles,
  },
  {
    index: '02',
    title: 'VS AI Courtyard Rivals',
    description:
      'Challenge Amina and courtyard regulars across Easy, Normal, and Hard difficulties with dynamic turn banter.',
    icon: Trophy,
  },
  {
    index: '03',
    title: '2-Player Local & 2v2 Teams',
    description:
      'Pass-and-play on one device or team up in Cranes vs Waves 2v2 matches where partners defend shared Houses.',
    icon: Users,
  },
  {
    index: '04',
    title: 'Online 1v1 Live Rooms',
    description:
      'Create private invite codes or join quick public duels with real-time turn synchronization, wind states, and custom loadouts.',
    icon: Globe,
  },
];

const HOW_TO_PLAY_STEPS = [
  {
    step: '01.',
    title: 'Toss the Ejjinja',
    detail:
      'Hold Click or Space to charge your river stone throw and land cleanly inside the highlighted chalk square. Dead-center hits score a Bullseye.',
  },
  {
    step: '02.',
    title: 'Hop Across the Court',
    detail:
      'Hop on one foot across single squares and land with two feet on straddle pairs, skipping your stone square and any opponent Houses.',
  },
  {
    step: '03.',
    title: 'Balance Through Breeze',
    detail:
      'Keep your posture steady with A / D or Left / Right arrows—especially when coastal winds or wet Jinja puddles test your footing.',
  },
  {
    step: '04.',
    title: 'Scoop & Claim Your House',
    detail:
      'Turn around in the Home arch, scoop your stone on the return hop, and complete a blind over-the-shoulder toss to own a permanent House.',
  },
];

export function HomePage() {
  return (
    <div>
      {/* 1. Hero Section */}
      <section className="border-b border-[#FAF3E8]/10 bg-gradient-to-b from-[#2A150D] via-[#1F100B] to-[#1F100B]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Hero Copy */}
            <div className="lg:col-span-5 flex flex-col justify-center gap-6">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-300/95">
                <span>Ugandan Courtyard Hopscotch</span>
                <span aria-hidden="true" className="text-[#FAF3E8]/35">
                  ·
                </span>
                <span>3D Browser &amp; PWA</span>
              </div>

              <h1
                className="font-display font-extrabold tracking-tight text-[#FAF3E8] leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.4rem)', textWrap: 'balance' }}
              >
                Toss your stone, hold your balance, claim the court.
              </h1>

              <p className="text-base text-[#E5D3BE] leading-relaxed max-w-xl">
                Sonko brings Uganda&apos;s beloved afternoon courtyard game into an interactive 3D world.
                Draw chalk lines across red murram earth, toss your <em>Ejjinja</em> river stone, hop
                through wind and rain puddles, and earn Cowries across five East African venues.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Link
                  to="/play"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-display font-extrabold text-base transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Play Sonko</span>
                </Link>

                <Link
                  to="/how-to-play"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg bg-[#2B160E] hover:bg-[#3A1E13] border border-[#FAF3E8]/18 text-[#FAF3E8] font-semibold text-sm transition-colors whitespace-nowrap"
                >
                  <span>How to Play</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" aria-hidden="true" />
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#E5D3BE]/75 pt-2 border-t border-[#FAF3E8]/10">
                <span>Free in Browser</span>
                <span aria-hidden="true">·</span>
                <span>5 Playable Venues</span>
                <span aria-hidden="true">·</span>
                <span>Solo, Local &amp; Online 1v1</span>
              </div>
            </div>

            {/* Hero Preview Media */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <MediaFrame
                src={heroPreviewImg}
                alt="Players tossing a river stone onto a chalk 10-square Sonko hopscotch court on red murram earth in a Kampala compound"
                aspectClass="aspect-video"
                className="lg:h-full"
                caption="Kampala Compound — 10-square chalk court with Ejjinja stone placement and Kitenge outfits"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Game Modes & Highlights */}
      <section className="py-14 sm:py-16 border-b border-[#FAF3E8]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
                Game Modes &amp; Features
              </p>
              <h2
                className="font-display text-2xl sm:text-3xl font-bold text-[#FAF3E8]"
                style={{ textWrap: 'balance' }}
              >
                Four ways to play, from quiet practice to live courtyard duels
              </h2>
            </div>
            <Link
              to="/play"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap"
            >
              <span>Launch 3D Courtyard</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {GAME_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <div
                  key={mode.index}
                  className="rounded-xl border border-[#FAF3E8]/12 bg-[#26140D]/80 p-6 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-num text-xs font-semibold text-amber-400">
                      {mode.index}
                    </span>
                    <Icon className="w-4 h-4 text-amber-300/90" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#FAF3E8]">{mode.title}</h3>
                  <p className="text-sm text-[#E5D3BE]/85 leading-relaxed">{mode.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Five Worlds & Living Courtyards (Asymmetric Bento Grid) */}
      <section className="py-14 sm:py-16 border-b border-[#FAF3E8]/10 bg-[#190C08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
              Uganda Tour &amp; Environments
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold text-[#FAF3E8]"
              style={{ textWrap: 'balance' }}
            >
              Five courts shaped by soil, coastal breeze, and evening lantern light
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            <div className="md:col-span-7 flex flex-col gap-5 rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-6">
              <MediaFrame
                src={backdropImg}
                alt="Sunlit Kampala home compound with banana grove, thatch shelter, and red murram hopscotch court"
                aspectClass="aspect-video"
              />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Primary Schoolyard · Kampala Compound · Jinja Rain Garden</span>
                </div>
                <h3 className="font-display text-xl font-bold text-[#FAF3E8]">
                  Dynamic weather and real courtyard physics
                </h3>
                <p className="text-sm text-[#E5D3BE]/85 leading-relaxed">
                  Every venue reacts to daylight presets and changing weather. Tropical showers leave
                  reflective puddles on the court, while coastal gusts sway trees and bend high stone
                  tosses mid-flight.
                </p>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col gap-6">
              <div className="rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-5 flex flex-col gap-3.5">
                <MediaFrame
                  src={entebbeImg}
                  alt="Entebbe Lake Victoria sandy lakeshore hopscotch court with palm trees and wooden fishing boat"
                  aspectClass="aspect-[4/3]"
                />
                <div>
                  <h3 className="font-display text-lg font-bold text-[#FAF3E8]">
                    Entebbe Lakeshore
                  </h3>
                  <p className="text-sm text-[#E5D3BE]/80 mt-1">
                    Warm coastal sand beside Lake Victoria where shifting lake breezes test every toss.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-5 flex flex-col gap-3.5">
                <MediaFrame
                  src={ndereImg}
                  alt="Ndere evening festival courtyard lit by warm amber lanterns and firelight"
                  aspectClass="aspect-[4/3]"
                />
                <div>
                  <h3 className="font-display text-lg font-bold text-[#FAF3E8]">
                    Ndere Night Pavilion
                  </h3>
                  <p className="text-sm text-[#E5D3BE]/80 mt-1">
                    Amber festival lanterns, drums, and twilight rounds with bonus Cowrie multipliers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Progression, Cowries & Courtyard Stall */}
      <section className="py-14 sm:py-16 border-b border-[#FAF3E8]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5">
              <MediaFrame
                src={stoneEmblemImg}
                alt="Hand-carved Ejjinja playing stone with chalk sunburst pattern resting on red murram earth"
                aspectClass="aspect-square"
                caption="Carved Ejjinja river stone — collect stones, Kitenge outfits, and court stencils"
              />
            </div>

            <div className="lg:col-span-7 flex flex-col gap-6">
              <div>
                <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
                  Courtyard Progression
                </p>
                <h2
                  className="font-display text-2xl sm:text-3xl font-bold text-[#FAF3E8]"
                  style={{ textWrap: 'balance' }}
                >
                  Earn Cowries through skill, daily quests, and courtyard streaks
                </h2>
              </div>

              <p className="text-base text-[#E5D3BE] leading-relaxed">
                Every clean round, Bullseye throw, and claimed House earns Cowries. Complete Daily
                Missions, crack open the Daily Treasure Quest chest, and visit the Courtyard Stall to
                customize your stone, Kitenge outfit, hairstyle, and House chalk stencil.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#FAF3E8]/10">
                <div className="flex items-start gap-3">
                  <ShoppingBag className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#FAF3E8]">
                      Courtyard Stall &amp; Wardrobe
                    </h3>
                    <p className="text-xs text-[#E5D3BE]/80 mt-1 leading-relaxed">
                      Unlock Kisii Soapstone, Entebbe Basalt, Barkcloth Royal, and Crested Crown
                      stencils using earned Cowries.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#FAF3E8]">
                      Global Leaderboard &amp; Badges
                    </h3>
                    <p className="text-xs text-[#E5D3BE]/80 mt-1 leading-relaxed">
                      Track your clean wins, best streaks, and career achievements across every venue.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How to Play Summary Section */}
      <section className="py-14 sm:py-16 border-b border-[#FAF3E8]/10 bg-[#190C08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
                Core Rules
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF3E8]">
                How a round of Sonko unfolds
              </h2>
            </div>
            <Link
              to="/how-to-play"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap"
            >
              <span>Read Full Player Guide</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW_TO_PLAY_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-6 flex flex-col gap-2.5"
              >
                <span className="font-mono-num text-sm font-bold text-amber-400">{item.step}</span>
                <h3 className="font-display text-lg font-bold text-[#FAF3E8]">{item.title}</h3>
                <p className="text-sm text-[#E5D3BE]/85 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. About & Site Links / Final Conversion */}
      <section className="py-14 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#FAF3E8]/14 bg-gradient-to-br from-[#2B160E] to-[#1B0D08] p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Ready to step onto the red earth?</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF3E8]">
                Play Sonko directly in your browser
              </h2>
              <p className="text-sm sm:text-base text-[#E5D3BE]/85 leading-relaxed">
                No downloads required. Play on desktop or mobile, install as an offline-ready PWA,
                or read about our cultural inspiration and site policies.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-sm">
                <Link to="/about" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
                  About Sonko
                </Link>
                <Link to="/contact" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
                  Contact Us
                </Link>
                <Link to="/privacy" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
                  Privacy Policy
                </Link>
                <Link to="/terms" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
                  Terms of Use
                </Link>
              </div>
            </div>

            <div className="shrink-0">
              <Link
                to="/play"
                className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-display font-extrabold text-base transition-colors whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Play Sonko Now</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
