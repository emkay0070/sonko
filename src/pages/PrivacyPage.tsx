import React from 'react';
import { Link } from '../router';

export function PrivacyPage() {
  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="border-b border-[#FAF3E8]/12 pb-8 mb-10">
        <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
          Legal &amp; Data Transparency
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#FAF3E8] tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm text-[#E5D3BE]/70 mt-2">Last updated: November 2026</p>
      </header>

      <div className="flex flex-col gap-8 text-[#E5D3BE] leading-relaxed">
        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">1. Overview</h2>
          <p>
            <strong>Sonko — Ugandan Courtyard Hopscotch</strong> is committed to respecting your
            privacy while you browse our site or play our 3D courtyard hopscotch game on desktop and
            mobile browsers. This Privacy Policy explains what information is stored locally on your
            device, what temporary session data is used for multiplayer matches and global
            leaderboards, and how advertising partners such as Google AdSense and Google H5 Games Ads
            operate on this site.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            2. Google AdSense, H5 Games Ads &amp; Cookies
          </h2>
          <p>
            To keep Sonko free to play, we support <strong>Google AdSense</strong> and the{' '}
            <strong>Google H5 Games Ads Placement API</strong> for eligible display placements on
            content pages, optional rewarded video placements (such as doubling match Cowries,
            rerolling a daily mission, or opening a daily bonus chest), and frequency-capped
            intermission breaks between matches. Display advertisements are kept separate from the
            active gameplay interface and controls.
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-2">
            <li>
              Third-party vendors, including Google, may use cookies or similar local identifiers to
              serve ads based on a user&apos;s prior visits to this website or other websites on the
              internet.
            </li>
            <li>
              Google&apos;s use of advertising cookies enables it and its partners to serve ads to
              users based on their visit to Sonko and/or other sites on the Internet.
            </li>
            <li>
              Users may opt out of personalized advertising at any time by visiting{' '}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 hover:text-amber-200 underline underline-offset-4"
              >
                Google Ads Settings
              </a>
              . You can also opt out of third-party vendor use of cookies for personalized
              advertising by visiting{' '}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 hover:text-amber-200 underline underline-offset-4"
              >
                aboutads.info/choices
              </a>
              .
            </li>
            <li>
              Inside Sonko&apos;s game hub, you can also switch between{' '}
              <strong>Personalized Ads</strong> and <strong>Non-Personalized Ads</strong> at any time
              via the consent banner or inside <strong>Settings &rarr; Privacy &amp; Ad Preferences</strong>.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            3. Local Browser Storage &amp; Game Progress
          </h2>
          <p>
            Sonko stores gameplay preferences, sound settings, graphics quality, cookie and ad consent
            choices, Cowrie currency balances, unlocked outfits/stones/stencils, and daily streak
            progress locally in your browser via <code className="text-amber-200">localStorage</code>{' '}
            and <code className="text-amber-200">IndexedDB</code>. This data stays on your device
            unless you choose to join an online match or submit a score to the leaderboard.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            4. Leaderboards, Online Matches &amp; Contact Inquiries
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-2">
            <li>
              <strong>Global Leaderboard:</strong> When you complete a qualifying match, an anonymous
              generated player identifier and your chosen display nickname (along with score, venue,
              and wins) are saved on the game server so rankings remain accurate.
            </li>
            <li>
              <strong>Online 1v1 Rooms:</strong> WebSocket rooms relay real-time turn coordinates, wind
              state, and character cosmetics between active room participants and expire automatically
              after inactivity.
            </li>
            <li>
              <strong>Reward Verification:</strong> Server endpoints track anonymous player reward
              receipts and daily caps to prevent duplicate reward claims.
            </li>
            <li>
              <strong>Contact Form:</strong> Messages submitted via our{' '}
              <Link to="/contact" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
                Contact page
              </Link>{' '}
              (name, email, subject, and message) are used strictly to respond to your support,
              privacy, or copyright request.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            5. Children&apos;s Privacy
          </h2>
          <p>
            Sonko is designed as a family-friendly cultural sports game and does not knowingly collect
            personally identifiable information from children under 13 (or the applicable digital
            consent age in your region). If you believe personal information has been submitted in
            error, please contact us for prompt removal.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">
            6. Contact &amp; Data Requests
          </h2>
          <p>
            For privacy inquiries, ad preference questions, or data deletion requests, please email{' '}
            <a
              href="mailto:support@sonkogame.com"
              className="text-amber-300 hover:text-amber-200 underline underline-offset-4"
            >
              support@sonkogame.com
            </a>{' '}
            or use the{' '}
            <Link to="/contact" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
              Contact form
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
