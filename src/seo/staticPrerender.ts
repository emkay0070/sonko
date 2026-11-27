import { AppRoute, ROUTE_META, SITE_NAME, SITE_ORIGIN } from './routeMeta';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderShell(options: {
  activeRoute: AppRoute;
  eyebrow: string;
  heading: string;
  intro: string;
  bodyHtml: string;
}): string {
  const navLinks: Array<{ href: string; label: string }> = [
    { href: '/', label: 'Home' },
    { href: '/play', label: 'Play Sonko' },
    { href: '/how-to-play', label: 'How to Play' },
    { href: '/about', label: 'About' },
  ];

  const footerLinks: Array<{ href: string; label: string }> = [
    { href: '/about', label: 'About Sonko' },
    { href: '/how-to-play', label: 'How to Play' },
    { href: '/contact', label: 'Contact Us' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Use' },
  ];

  const navHtml = navLinks
    .map(
      (item) =>
        `<a href="${item.href}" style="color:${
          options.activeRoute === item.href ? '#FCD34D' : '#E5D3BE'
        };text-decoration:none;font-weight:${
          options.activeRoute === item.href ? '700' : '500'
        };">${escapeHtml(item.label)}</a>`
    )
    .join('\n          ');

  const footerHtml = footerLinks
    .map(
      (item) =>
        `<a href="${item.href}" style="color:${
          options.activeRoute === item.href ? '#FCD34D' : '#FBBF24'
        };text-decoration:underline;text-underline-offset:3px;">${escapeHtml(item.label)}</a>`
    )
    .join('\n          ');

  return `<div style="min-height:100vh;display:flex;flex-direction:column;background:#1F100B;color:#FAF3E8;font-family:'Plus Jakarta Sans',system-ui,sans-serif;line-height:1.65;">
      <header style="border-bottom:1px solid rgba(250,243,232,0.14);background:#170B07;">
        <div style="max-width:960px;margin:0 auto;padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;">
          <a href="/" style="font-weight:800;font-size:1.2rem;color:#FAF3E8;text-decoration:none;letter-spacing:-0.02em;">SONKO</a>
          <nav aria-label="Primary site navigation" style="display:flex;flex-wrap:wrap;gap:20px;font-size:0.92rem;">
            ${navHtml}
          </nav>
        </div>
      </header>
      <main style="flex:1;width:100%;max-width:880px;margin:0 auto;padding:36px 20px 52px;">
        <article>
          <header style="border-bottom:1px solid rgba(250,243,232,0.14);padding-bottom:20px;margin-bottom:28px;">
            <p style="margin:0 0 8px;font-size:0.8rem;font-weight:600;color:#FBBF24;letter-spacing:0.04em;">${escapeHtml(
              options.eyebrow
            )}</p>
            <h1 style="margin:0 0 12px;font-size:2.1rem;line-height:1.15;color:#FAF3E8;">${escapeHtml(
              options.heading
            )}</h1>
            <p style="margin:0;color:#E5D3BE;font-size:1rem;">${escapeHtml(options.intro)}</p>
          </header>
          ${options.bodyHtml}
        </article>
      </main>
      <footer style="border-top:1px solid rgba(250,243,232,0.14);background:#140906;padding:24px 20px;">
        <div style="max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;font-size:0.88rem;">
          <span style="color:rgba(229,211,190,0.72);">&copy; 2026 Sonko — Ugandan Courtyard Hopscotch. All rights reserved.</span>
          <nav aria-label="Footer navigation" style="display:flex;flex-wrap:wrap;gap:16px;">
            ${footerHtml}
          </nav>
        </div>
      </footer>
    </div>`;
}

export function renderStaticRootMarkup(route: AppRoute): string {
  switch (route) {
    case '/':
      return renderShell({
        activeRoute: '/',
        eyebrow: 'Ugandan Courtyard Hopscotch · 3D Browser & PWA',
        heading: 'Toss your stone, hold your balance, claim the court.',
        intro:
          "Sonko brings Uganda's beloved afternoon courtyard game into an interactive 3D world. Draw chalk lines across red murram earth, toss your Ejjinja river stone, hop through wind and rain puddles, and earn Cowries across five East African venues.",
        bodyHtml: `
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Four ways to play, from quiet practice to live courtyard duels</h2>
            <ul style="margin:0;padding-left:20px;color:#E5D3BE;">
              <li><strong>Solo Practice &amp; Mastery:</strong> Hone your Ejjinja stone aim, master single-foot balance in crosswinds, and clear full 10-square rounds at your own pace.</li>
              <li><strong>VS AI Courtyard Rivals:</strong> Challenge Amina and courtyard regulars across Easy, Normal, and Hard difficulties with dynamic turn banter.</li>
              <li><strong>2-Player Local &amp; 2v2 Teams:</strong> Pass-and-play on one device or team up in Cranes vs Waves 2v2 matches where partners defend shared Houses.</li>
              <li><strong>Online 1v1 Live Rooms:</strong> Create private invite codes or join quick public duels with real-time turn synchronization, wind states, and custom loadouts.</li>
            </ul>
          </section>
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Five courts shaped by soil, coastal breeze, and evening lantern light</h2>
            <p style="margin:0 0 10px;color:#E5D3BE;">
              Play across the Primary Schoolyard, Kampala Compound, Entebbe Lakeshore, Jinja Rain Garden, and Ndere Night Pavilion.
              Every venue responds to daylight presets, shifting coastal breezes, and wet puddles that test your footing.
            </p>
          </section>
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">How a round of Sonko unfolds</h2>
            <ol style="margin:0;padding-left:20px;color:#E5D3BE;">
              <li><strong>Toss the Ejjinja:</strong> Hold Click or Space to charge your river stone throw inside the highlighted chalk square.</li>
              <li><strong>Hop Across the Court:</strong> Hop on one foot across single squares and two feet on straddle pairs, skipping your stone square and opponent Houses.</li>
              <li><strong>Balance Through Breeze:</strong> Steer with A / D or Left / Right arrows through coastal winds and wet Jinja puddles.</li>
              <li><strong>Scoop &amp; Claim Your House:</strong> Turn around in the Home arch, scoop your stone on the return hop, and perform a blind toss to own a permanent House.</li>
            </ol>
          </section>
          <section>
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Play Sonko directly in your browser</h2>
            <p style="margin:0;color:#E5D3BE;">
              No downloads required. <a href="/play" style="color:#FBBF24;">Launch the 3D Courtyard</a>, read the full
              <a href="/how-to-play" style="color:#FBBF24;">How to Play guide</a>, or explore <a href="/about" style="color:#FBBF24;">About Sonko</a>.
            </p>
          </section>`,
      });

    case '/play':
      return renderShell({
        activeRoute: '/play',
        eyebrow: 'Interactive 3D Courtyard',
        heading: 'Play Sonko — 3D Ugandan Courtyard Hopscotch',
        intro:
          'Step onto the sunlit red murram court directly in your browser. Choose Solo Practice, VS Bot, 2-Player Local, 2v2 Teams, or Online 1v1 live rooms across five Ugandan venues.',
        bodyHtml: `
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Playable Modes &amp; Courts</h2>
            <ul style="margin:0;padding-left:20px;color:#E5D3BE;">
              <li><strong>Game Modes:</strong> Solo Practice, VS Bot (Easy / Normal / Hard), 2-Player Pass-and-Play, 2v2 Teams, and Online 1v1 Rooms.</li>
              <li><strong>Court Sizes:</strong> Classic 5-Square Quick Match and full 10-Square Courtyard Court.</li>
              <li><strong>Five Venues:</strong> Primary Schoolyard, Kampala Compound, Entebbe Lakeshore, Jinja Rain Garden, and Ndere Night Pavilion.</li>
            </ul>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Quick Controls</h2>
            <p style="margin:0;color:#E5D3BE;">
              Hold Click or Space to toss your Ejjinja stone, tap highlighted squares or press Space/W to hop, steer balance with A/D or Left/Right arrows,
              and press E/Enter to scoop your stone on the return trip. View the full guide on <a href="/how-to-play" style="color:#FBBF24;">How to Play</a>.
            </p>
          </section>`,
      });

    case '/how-to-play':
      return renderShell({
        activeRoute: '/how-to-play',
        eyebrow: 'Official Player Guide',
        heading: 'How to Play Sonko',
        intro:
          'Learn the rules, throwing techniques, single-foot balance controls, House-claiming strategy, and weather hazards of traditional Ugandan courtyard hopscotch.',
        bodyHtml: `
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">1. Objective of the Game</h2>
            <p style="margin:0;color:#E5D3BE;">
              Win the match by claiming the highest score and the most <strong>Houses</strong> across either a quick 5-square or classic 10-square Ugandan courtyard court.
              You can practice in Solo Mode, challenge AI courtyard rivals, share a screen in 2-Player or 2v2 Team modes, or compete live in Online 1v1 rooms.
            </p>
          </section>
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">2. Step-by-Step Turn Loop</h2>
            <ol style="margin:0;padding-left:20px;color:#E5D3BE;">
              <li><strong>Toss Your Stone (Ejjinja):</strong> Hold Left-Click or Space to aim and charge your throw into the highlighted target square, then release. Landing inside the inner ring earns a Bullseye bonus.</li>
              <li><strong>Hop the Court:</strong> Click the highlighted tile (or press Space, W, or Up Arrow) to hop along the court on one foot for single squares and two feet on straddle pairs, always skipping the square holding your stone and any opponent Houses.</li>
              <li><strong>Balance &amp; Wind:</strong> Watch the balance meter during single-foot hops. Use A / D or Left / Right Arrows (or mobile tilt buttons) to steady your posture during gusty coastal winds.</li>
              <li><strong>Turn Around &amp; Scoop:</strong> Rest with both feet inside the Home arch at the top of the court, turn back, hop down, pause just before your stone's square, and press E, Enter, or Space to scoop your stone without losing balance.</li>
              <li><strong>Claim a House:</strong> After clearing key milestone rounds, stand at the baseline and perform a blind over-the-shoulder toss. If your stone lands cleanly on an unclaimed tile, that tile becomes your permanent House.</li>
            </ol>
          </section>
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">3. Controls Reference</h2>
            <table style="width:100%;border-collapse:collapse;color:#E5D3BE;font-size:0.92rem;">
              <thead>
                <tr style="border-bottom:1px solid rgba(250,243,232,0.16);color:#FCD34D;text-align:left;">
                  <th style="padding:8px 10px;">Action</th>
                  <th style="padding:8px 10px;">Mouse / Touch</th>
                  <th style="padding:8px 10px;">Keyboard</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid rgba(250,243,232,0.1);">
                  <td style="padding:8px 10px;">Aim &amp; Charge Stone Toss</td>
                  <td style="padding:8px 10px;">Hold &amp; Release Canvas</td>
                  <td style="padding:8px 10px;">Hold &amp; Release Space</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(250,243,232,0.1);">
                  <td style="padding:8px 10px;">Hop Forward / Return</td>
                  <td style="padding:8px 10px;">Tap Highlighted Square</td>
                  <td style="padding:8px 10px;">Space, W, or Up Arrow</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(250,243,232,0.1);">
                  <td style="padding:8px 10px;">Steer Single-Foot Balance</td>
                  <td style="padding:8px 10px;">On-Screen Tilt Buttons</td>
                  <td style="padding:8px 10px;">A / D or Left / Right Arrows</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(250,243,232,0.1);">
                  <td style="padding:8px 10px;">Scoop Stone (Ejjinja)</td>
                  <td style="padding:8px 10px;">Tap Scoop Prompt / Tile</td>
                  <td style="padding:8px 10px;">E, Enter, or Space</td>
                </tr>
                <tr>
                  <td style="padding:8px 10px;">Switch Camera / Orbit</td>
                  <td style="padding:8px 10px;">Right-Drag Orbit</td>
                  <td style="padding:8px 10px;">C (Camera) · H (View Bar)</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section>
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">4. Weather, Cowries &amp; Fouls</h2>
            <p style="margin:0 0 10px;color:#E5D3BE;">
              <strong>Puddles &amp; Wind Gusts:</strong> Rainy courts form reflective puddles that make single-foot landings slipperier, while Entebbe breezes nudge high stone tosses sideways.
            </p>
            <p style="margin:0;color:#E5D3BE;">
              <strong>What Counts as a Foul?</strong> Stepping on a chalk border line, tossing your stone outside the target square, stepping inside an opponent's House, or letting your balance meter drop to zero ends your turn.
            </p>
          </section>`,
      });

    case '/about':
      return renderShell({
        activeRoute: '/about',
        eyebrow: 'Our Story & Heritage',
        heading: 'About Sonko',
        intro:
          "Cultural heritage, tactile 3D environments, and browser-native multiplayer inspired by Uganda's timeless courtyard hopscotch tradition.",
        bodyHtml: `
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Preserving Ugandan Courtyard Hopscotch in 3D</h2>
            <p style="margin:0;color:#E5D3BE;">
              <strong>Sonko</strong> brings the beloved Ugandan schoolyard and home-compound hopscotch game into a sunlit, tactile 3D web experience.
              Known across generations for lively afternoon matches drawn in chalk on warm red murram earth, Sonko blends precision stone tossing (<em>Ejjinja</em>),
              rhythmic single-foot hopping, balance control, and the thrilling blind back-toss used to claim a square as your own <em>House</em>.
            </p>
          </section>
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Five Hand-Crafted Worlds &amp; Venues</h2>
            <ul style="margin:0;padding-left:20px;color:#E5D3BE;">
              <li><strong>Primary Schoolyard:</strong> Red-brick classrooms, open shaded verandas, dusty courtyard chalk, assembly flagpole, and lush mango tree shade.</li>
              <li><strong>Kampala Compound:</strong> Sun-baked red murram soil framed by banana groves, mango shade, boundary walls, and warm veranda roofs.</li>
              <li><strong>Entebbe Lakeshore:</strong> Coastal breeze, warm shoreline sand, swaying palm canopies, and Lake Victoria waters nearby.</li>
              <li><strong>Jinja Rain Garden:</strong> Lush river mist, wet reflective puddles across court tiles, and drifting tropical rain showers.</li>
              <li><strong>Ndere Night Pavilion:</strong> Warm amber lantern glow, evening drums, firelight ambiance, and celebratory festival rounds.</li>
            </ul>
          </section>
          <section style="margin-bottom:28px;">
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Dynamic Weather &amp; Living Courtyards</h2>
            <p style="margin:0;color:#E5D3BE;">
              Every venue responds to time-of-day presets and real-time weather conditions. When wind picks up or tropical rain sweeps across Jinja,
              canopy leaves sway organically in synced wind gusts, puddles shimmer across court tiles, and rain and mist intensity adapts smoothly.
            </p>
          </section>
          <section>
            <h2 style="font-size:1.35rem;color:#FDE68A;margin:0 0 10px;">Browser-First &amp; Offline Ready</h2>
            <p style="margin:0;color:#E5D3BE;">
              Sonko runs directly in modern desktop and mobile browsers with zero downloads required, supporting offline Progressive Web App caching for Solo, VS Bot, 2-Player Local, and 2v2 Teams, alongside Online 1v1 duels and a Global Leaderboard.
            </p>
          </section>`,
      });

    case '/privacy':
      return renderShell({
        activeRoute: '/privacy',
        eyebrow: 'Legal & Data Transparency',
        heading: 'Privacy Policy',
        intro: 'Last updated: November 2026',
        bodyHtml: `
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">1. Overview</h2>
            <p style="margin:0;color:#E5D3BE;">
              <strong>Sonko — Ugandan Courtyard Hopscotch</strong> is committed to respecting your privacy while you browse our site or play our 3D courtyard hopscotch game on desktop and mobile browsers.
              This Privacy Policy explains what information is stored locally on your device, what temporary session data is used for multiplayer matches and global leaderboards, and how advertising partners operate on this site.
            </p>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">2. Google AdSense, H5 Games Ads &amp; Cookies</h2>
            <p style="margin:0 0 10px;color:#E5D3BE;">
              To keep Sonko free to play, we support Google AdSense and the Google H5 Games Ads Placement API for eligible display placements on content pages, optional rewarded video placements, and frequency-capped intermission breaks between matches.
            </p>
            <ul style="margin:0;padding-left:20px;color:#E5D3BE;">
              <li>Third-party vendors, including Google, may use cookies or similar local identifiers to serve ads based on prior visits to this or other websites.</li>
              <li>Users may opt out of personalized advertising at <a href="https://adssettings.google.com" style="color:#FBBF24;">Google Ads Settings</a> or <a href="https://www.aboutads.info/choices/" style="color:#FBBF24;">aboutads.info/choices</a>.</li>
              <li>Inside Sonko's game hub, you can switch between Personalized Ads and Non-Personalized Ads via Settings &rarr; Privacy &amp; Ad Preferences.</li>
            </ul>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">3. Local Browser Storage &amp; Game Progress</h2>
            <p style="margin:0;color:#E5D3BE;">
              Sonko stores gameplay preferences, sound settings, graphics quality, cookie and ad consent choices, Cowrie currency balances, unlocked cosmetics, and daily streak progress locally via <code>localStorage</code> and <code>IndexedDB</code>.
            </p>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">4. Leaderboards, Online Matches &amp; Contact Inquiries</h2>
            <ul style="margin:0;padding-left:20px;color:#E5D3BE;">
              <li><strong>Global Leaderboard:</strong> Qualifying matches store an anonymous player ID, chosen display nickname, score, venue, and wins.</li>
              <li><strong>Online 1v1 Rooms:</strong> WebSocket rooms relay real-time turn coordinates, wind state, and cosmetics during active matches and expire automatically.</li>
              <li><strong>Contact Form:</strong> Messages submitted via our <a href="/contact" style="color:#FBBF24;">Contact page</a> are used strictly to respond to your request.</li>
            </ul>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">5. Children's Privacy</h2>
            <p style="margin:0;color:#E5D3BE;">
              Sonko is designed as a family-friendly cultural sports game and does not knowingly collect personally identifiable information from children under 13 (or the applicable digital consent age in your region).
            </p>
          </section>
          <section>
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">6. Contact &amp; Data Requests</h2>
            <p style="margin:0;color:#E5D3BE;">
              For privacy inquiries or data deletion requests, email <a href="mailto:support@sonkogame.com" style="color:#FBBF24;">support@sonkogame.com</a> or use our <a href="/contact" style="color:#FBBF24;">Contact page</a>.
            </p>
          </section>`,
      });

    case '/terms':
      return renderShell({
        activeRoute: '/terms',
        eyebrow: 'Rules & Guidelines',
        heading: 'Terms of Use',
        intro: 'Last updated: November 2026',
        bodyHtml: `
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">1. Acceptance of Terms</h2>
            <p style="margin:0;color:#E5D3BE;">
              By accessing or playing <strong>Sonko — Ugandan Courtyard Hopscotch</strong>, you agree to abide by these Terms of Use and all applicable laws.
            </p>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">2. License &amp; Fair Gameplay</h2>
            <p style="margin:0;color:#E5D3BE;">
              We grant you a personal, non-exclusive, revocable license to play Sonko in a standard web browser. You agree not to automate, tamper with, exploit, or reverse-engineer server reward endpoints, leaderboard submissions, or live 1v1 multiplayer rooms.
            </p>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">3. Virtual Currency (Cowries)</h2>
            <p style="margin:0;color:#E5D3BE;">
              Sonko features an in-game virtual reward currency called <strong>Cowries</strong> used exclusively at the Courtyard Stall to unlock cosmetics. Cowries have no real-world monetary value, cannot be purchased for cash or redeemed for money or real goods, and are non-transferable.
            </p>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">4. Creator Studio &amp; Custom 3D Assets</h2>
            <p style="margin:0;color:#E5D3BE;">
              Players who upload custom 3D <code>.glb</code> models through the Creator Studio certify that they own the rights or hold a valid license to use and display those assets.
            </p>
          </section>
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">5. Advertisements &amp; Third-Party Services</h2>
            <p style="margin:0;color:#E5D3BE;">
              Sonko integrates Google AdSense and Google H5 Games Ads to support free access. Optional rewarded ads never charge fees; if an ad is dismissed early or unavailable, no bonus reward is granted.
            </p>
          </section>
          <section>
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">6. Disclaimer of Warranty &amp; Contact</h2>
            <p style="margin:0;color:#E5D3BE;">
              Sonko is provided &ldquo;as is&rdquo; without warranties of uninterrupted uptime or device compatibility. For questions, contact <a href="mailto:support@sonkogame.com" style="color:#FBBF24;">support@sonkogame.com</a> or visit our <a href="/contact" style="color:#FBBF24;">Contact page</a>.
            </p>
          </section>`,
      });

    case '/contact':
      return renderShell({
        activeRoute: '/contact',
        eyebrow: 'Publisher Support',
        heading: 'Contact Us',
        intro: 'We respond to gameplay support, privacy, and licensing inquiries within 2–3 business days.',
        bodyHtml: `
          <section style="margin-bottom:24px;">
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">Direct Support Channels</h2>
            <p style="margin:0 0 10px;color:#E5D3BE;">
              Questions about gameplay, bug reports, privacy rights, AdSense compliance, or Creator Studio 3D uploads?
              Reach our publishing team directly at <a href="mailto:support@sonkogame.com" style="color:#FBBF24;">support@sonkogame.com</a>.
            </p>
          </section>
          <section>
            <h2 style="font-size:1.3rem;color:#FDE68A;margin:0 0 8px;">Helpful References</h2>
            <ul style="margin:0;padding-left:20px;color:#E5D3BE;">
              <li><a href="/privacy" style="color:#FBBF24;">Privacy Policy</a></li>
              <li><a href="/terms" style="color:#FBBF24;">Terms of Use</a></li>
              <li><a href="/how-to-play" style="color:#FBBF24;">How to Play</a></li>
            </ul>
          </section>`,
      });

    case '/404':
      return renderShell({
        activeRoute: '/404',
        eyebrow: '404 · Not Found',
        heading: 'This courtyard square was not found',
        intro: 'The page you requested does not exist or may have moved.',
        bodyHtml: `
          <section>
            <p style="margin:0;color:#E5D3BE;">
              Return to the <a href="/" style="color:#FBBF24;">Sonko Homepage</a> or jump straight into <a href="/play" style="color:#FBBF24;">Play Sonko</a>.
            </p>
          </section>`,
      });
  }
}

export function applyRouteSeoToHtml(
  templateHtml: string,
  route: AppRoute,
  origin: string = SITE_ORIGIN
): string {
  const meta = ROUTE_META[route];
  const canonicalUrl = meta.canonicalPath ? `${origin}${meta.canonicalPath}` : null;
  const ogUrl = canonicalUrl ?? `${origin}/404`;

  let html = templateHtml;

  // Replace <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);

  // Replace or inject robots
  if (/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i.test(html)) {
    html = html.replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="robots" content="${escapeHtml(meta.robots)}" />`
    );
  } else {
    html = html.replace('</head>', `    <meta name="robots" content="${escapeHtml(meta.robots)}" />\n  </head>`);
  }

  // Replace description
  if (/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i.test(html)) {
    html = html.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`
    );
  } else {
    html = html.replace(
      '</head>',
      `    <meta name="description" content="${escapeHtml(meta.description)}" />\n  </head>`
    );
  }

  // Remove any existing canonical and inject route canonical if applicable
  html = html.replace(/\s*<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/gi, '');
  if (canonicalUrl) {
    html = html.replace(
      '</head>',
      `    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n  </head>`
    );
  }

  // OpenGraph tags
  const ogTags: Array<[string, string]> = [
    ['og:site_name', SITE_NAME],
    ['og:type', meta.ogType],
    ['og:url', ogUrl],
    ['og:title', meta.title],
    ['og:description', meta.description],
  ];

  for (const [prop, content] of ogTags) {
    const re = new RegExp(`<meta\\s+property="${prop}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
    const tag = `<meta property="${prop}" content="${escapeHtml(content)}" />`;
    if (re.test(html)) {
      html = html.replace(re, tag);
    } else {
      html = html.replace('</head>', `    ${tag}\n  </head>`);
    }
  }

  // Twitter tags
  const twitterTags: Array<[string, string]> = [
    ['twitter:title', meta.title],
    ['twitter:description', meta.description],
  ];
  for (const [name, content] of twitterTags) {
    const re = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
    const tag = `<meta name="${name}" content="${escapeHtml(content)}" />`;
    if (re.test(html)) {
      html = html.replace(re, tag);
    } else {
      html = html.replace('</head>', `    ${tag}\n  </head>`);
    }
  }

  // Ensure exact AdSense script appears once in <head> on ad-eligible routes, and never on /404
  const adsenseScriptRe =
    /\s*<script\b[^>]*\bsrc=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"']*["'][^>]*>\s*<\/script>/gi;
  html = html.replace(adsenseScriptRe, '');
  if (route !== '/404') {
    const adsenseScriptTag =
      '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8832384771899504" crossorigin="anonymous"></script>';
    html = html.replace('</head>', `    ${adsenseScriptTag}\n  </head>`);
  }

  // Replace <div id="root">...</div> fallback markup with route-specific static HTML
  const rootMarkup = renderStaticRootMarkup(route);
  const rootRe = /<div id="root">[\s\S]*<\/div>(?=\s*(?:<script\b|<\/body>))/i;
  if (rootRe.test(html)) {
    html = html.replace(rootRe, `<div id="root">${rootMarkup}</div>`);
  }

  return html;
}
