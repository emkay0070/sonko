import React from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { Link } from '../router';

const CONTROLS_ROWS = [
  {
    action: 'Aim & Charge Stone Toss',
    mouse: 'Hold & Release Canvas',
    keyboard: 'Hold & Release Space',
  },
  {
    action: 'Hop Forward / Return',
    mouse: 'Tap Highlighted Square',
    keyboard: 'Space, W, or Up Arrow',
  },
  {
    action: 'Steer Single-Foot Balance',
    mouse: 'On-Screen Tilt Buttons',
    keyboard: 'A / D or Left / Right Arrows',
  },
  {
    action: 'Scoop Stone (Ejjinja)',
    mouse: 'Tap Scoop Prompt / Tile',
    keyboard: 'E, Enter, or Space',
  },
  {
    action: 'Switch Camera / Orbit',
    mouse: 'Right-Drag Orbit',
    keyboard: 'C (Camera) · H (View Bar)',
  },
];

export function HowToPlayPage() {
  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="border-b border-[#FAF3E8]/12 pb-8 mb-10">
        <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
          Official Player Guide
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#FAF3E8] tracking-tight">
          How to Play Sonko
        </h1>
        <p className="text-base text-[#E5D3BE]/85 mt-3 leading-relaxed max-w-2xl">
          Learn the rules, throwing techniques, single-foot balance controls, House-claiming strategy,
          and weather hazards of traditional Ugandan courtyard hopscotch.
        </p>
        <div className="mt-6">
          <Link
            to="/play"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-display font-bold text-sm transition-colors whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Play Sonko Now</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-10 text-[#E5D3BE] leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-[#FDE68A]">
            1. Objective of the Game
          </h2>
          <p>
            Win the match by claiming the highest score and the most <strong>Houses</strong> across
            either a quick 5-square or classic 10-square Ugandan courtyard court. You can practice in{' '}
            <strong>Solo Mode</strong>, challenge AI courtyard rivals, share a screen in{' '}
            <strong>2-Player</strong> or <strong>2v2 Team</strong> modes, or compete live in{' '}
            <strong>Online 1v1</strong> rooms.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold text-[#FDE68A]">
            2. Step-by-Step Turn Loop
          </h2>
          <ol className="flex flex-col gap-4 list-decimal pl-5">
            <li>
              <strong className="text-[#FAF3E8]">Toss Your Stone (Ejjinja):</strong> Hold{' '}
              <em>Left-Click</em> or <em>Space</em> to aim and charge your throw into the highlighted
              target square, then release. Keep the stone inside the chalk borders—landing inside the
              inner ring earns a <strong>Bullseye</strong> bonus.
            </li>
            <li>
              <strong className="text-[#FAF3E8]">Hop the Court:</strong> Click the highlighted tile (or
              press <em>Space</em>, <em>W</em>, or <em>Up Arrow</em>) to hop along the court on one
              foot for single squares and two feet on straddle pairs, always <strong>skipping</strong>{' '}
              the square holding your stone and any opponent Houses.
            </li>
            <li>
              <strong className="text-[#FAF3E8]">Balance &amp; Wind:</strong> Watch the balance meter
              during single-foot hops. Use <em>A / D</em> or <em>Left / Right Arrows</em> (or mobile
              tilt buttons) to steady your posture, especially during gusty coastal winds.
            </li>
            <li>
              <strong className="text-[#FAF3E8]">Turn Around &amp; Scoop:</strong> Rest with both feet
              inside the Home arch at the top of the court, turn back, hop down, pause just before your
              stone&apos;s square, and press <em>E</em>, <em>Enter</em>, or <em>Space</em> to scoop
              your stone without losing balance.
            </li>
            <li>
              <strong className="text-[#FAF3E8]">Claim a House:</strong> After clearing key milestone
              rounds, stand at the baseline and perform a blind over-the-shoulder toss. If your stone
              lands cleanly on an unclaimed tile, that tile becomes your permanent{' '}
              <strong>House</strong>. You may rest on your own House, while rivals must skip over it.
            </li>
          </ol>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold text-[#FDE68A]">
            3. Controls Reference
          </h2>
          <div className="overflow-x-auto rounded-xl border border-[#FAF3E8]/14 bg-[#24120C]">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#FAF3E8]/14 bg-[#1B0D08] text-amber-300">
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Mouse / Touch</th>
                  <th className="px-4 py-3 font-semibold">Keyboard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FAF3E8]/10">
                {CONTROLS_ROWS.map((row) => (
                  <tr key={row.action}>
                    <td className="px-4 py-3 font-medium text-[#FAF3E8]">{row.action}</td>
                    <td className="px-4 py-3">{row.mouse}</td>
                    <td className="px-4 py-3 font-mono-num text-xs text-amber-200">{row.keyboard}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold text-[#FDE68A]">
            4. Weather, Cowries &amp; Fouls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-5">
              <h3 className="font-display text-lg font-bold text-[#FAF3E8] mb-2">
                Puddles &amp; Wind Gusts
              </h3>
              <p className="text-sm leading-relaxed">
                Rainy courts form reflective puddles that make single-foot landings slipperier, while
                Entebbe breezes nudge high stone tosses sideways. Compensate your aim slightly into
                the wind before releasing.
              </p>
            </div>
            <div className="rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-5">
              <h3 className="font-display text-lg font-bold text-[#FAF3E8] mb-2">
                What Counts as a Foul?
              </h3>
              <p className="text-sm leading-relaxed">
                Stepping on a chalk border line, tossing your stone outside the target square, stepping
                inside an opponent&apos;s House, or letting your balance meter drop to zero ends your
                turn and passes play to the next challenger.
              </p>
            </div>
          </div>
          <p className="text-sm">
            Looking to learn more about the venues and cultural heritage behind the game? Visit our{' '}
            <Link to="/about" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
              About Sonko
            </Link>{' '}
            page, or jump straight onto the court.
          </p>
        </section>

        <div className="border-t border-[#FAF3E8]/12 pt-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/play"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#1A0B07] font-display font-bold text-sm transition-colors"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Start a Match</span>
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 hover:text-amber-200"
          >
            <span>Explore the 5 Courtyard Worlds</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
