import React from 'react';
import { Link } from '../router';

export function TermsPage() {
  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="border-b border-[#FAF3E8]/12 pb-8 mb-10">
        <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
          Rules &amp; Guidelines
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#FAF3E8] tracking-tight">
          Terms of Use
        </h1>
        <p className="text-sm text-[#E5D3BE]/70 mt-2">Last updated: November 2026</p>
      </header>

      <div className="flex flex-col gap-8 text-[#E5D3BE] leading-relaxed">
        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">1. Acceptance of Terms</h2>
          <p>
            By accessing or playing <strong>Sonko — Ugandan Courtyard Hopscotch</strong>, you agree to
            abide by these Terms of Use and all applicable laws. If you do not agree with any part of
            these terms, please discontinue use of the game and website.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            2. License &amp; Fair Gameplay
          </h2>
          <p>
            We grant you a personal, non-exclusive, revocable license to play Sonko in a standard web
            browser. You agree not to automate, tamper with, exploit, or reverse-engineer server
            reward endpoints, leaderboard submissions, or live 1v1 multiplayer WebSocket rooms.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            3. Virtual Currency (Cowries)
          </h2>
          <p>
            Sonko features an in-game virtual reward currency called <strong>Cowries</strong> used
            exclusively at the Courtyard Stall to unlock cosmetics such as stones, outfits,
            hairstyles, and chalk stencils. Cowries have <strong>no real-world monetary value</strong>,
            cannot be purchased for cash, cannot be redeemed for money or real goods, and are
            non-transferable between accounts or devices.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            4. Creator Studio &amp; Custom 3D Assets
          </h2>
          <p>
            Players who upload custom 3D <code className="text-amber-200">.glb</code> models through
            the Creator Studio certify that they own the rights or hold a valid license to use and
            display those assets. Uploading infringing, malicious, or inappropriate content is
            strictly prohibited, and operators reserve the right to remove uploaded assets at any
            time.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            5. Advertisements &amp; Third-Party Services
          </h2>
          <p>
            Sonko integrates Google AdSense and Google H5 Games Ads to support free access. Ad
            availability is governed by Google&apos;s publisher policies and your consent selection.
            Optional rewarded ads never charge fees; if an ad is dismissed early or unavailable, no
            bonus reward is granted.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            6. Disclaimer of Warranty &amp; Contact
          </h2>
          <p>
            Sonko is provided &ldquo;as is&rdquo; without warranties of uninterrupted uptime or
            device compatibility. For questions regarding these Terms, please contact{' '}
            <a
              href="mailto:support@sonkogame.com"
              className="text-amber-300 hover:text-amber-200 underline underline-offset-4"
            >
              support@sonkogame.com
            </a>{' '}
            or visit our{' '}
            <Link to="/contact" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
              Contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
