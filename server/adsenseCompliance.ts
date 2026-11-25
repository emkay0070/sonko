import type { Request } from 'express';

export type CompliancePageId =
  | 'about'
  | 'how-to-play'
  | 'privacy-policy'
  | 'terms'
  | 'contact';

export interface AdsenseRuntimeConfig {
  clientId: string;
  publisherId: string;
  isConfigured: boolean;
  testMode: boolean;
  contactEmail: string;
  siteName: string;
}

const ADSENSE_CLIENT_RE = /^ca-pub-\d{10,20}$/;
const SAFE_HOST_RE = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;
const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[^\s@<>]{2,32}$/;

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(input: string): string {
  return escapeHtml(input);
}

export function resolveAdsenseRuntimeConfig(): AdsenseRuntimeConfig {
  const rawClient = String(
    process.env.ADSENSE_CLIENT_ID || process.env.VITE_ADSENSE_CLIENT_ID || ''
  ).trim();
  const isConfigured = ADSENSE_CLIENT_RE.test(rawClient);
  const clientId = isConfigured ? rawClient : '';
  const publisherId = isConfigured ? clientId.replace(/^ca-/, '') : '';
  const testMode =
    String(process.env.ADSENSE_TEST_MODE || process.env.VITE_ADSENSE_TEST_MODE || '')
      .trim()
      .toLowerCase() === 'true';

  const rawEmail = String(process.env.CONTACT_EMAIL || '').trim();
  const contactEmail = EMAIL_RE.test(rawEmail) ? rawEmail : 'support@sonkogame.com';

  return {
    clientId,
    publisherId,
    isConfigured,
    testMode,
    contactEmail,
    siteName: 'Sonko — Ugandan Courtyard Hopscotch',
  };
}

export function resolveSafeOrigin(req: Request): string {
  const envUrl = String(process.env.APP_URL || '').trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Fallback to validated request headers
    }
  }

  const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = rawProto === 'http' ? 'http' : 'https';
  const rawHost = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim();

  if (SAFE_HOST_RE.test(rawHost)) {
    return `${proto}://${rawHost}`;
  }
  return 'https://localhost:3000';
}

export function renderAdsTxt(cfg: AdsenseRuntimeConfig): string {
  if (!cfg.isConfigured) {
    return [
      '# Sonko — Authorized Digital Sellers (ads.txt)',
      '# Set ADSENSE_CLIENT_ID or VITE_ADSENSE_CLIENT_ID (e.g. ca-pub-1234567890123456)',
      '# to publish your live Google AdSense seller record automatically.',
      '',
    ].join('\n');
  }
  return `google.com, ${cfg.publisherId}, DIRECT, f08c47fec0942fa0\n`;
}

export function renderRobotsTxt(origin: string): string {
  return [
    '# Robots policy for Sonko — Ugandan Courtyard Hopscotch',
    'User-agent: Mediapartners-Google',
    'Allow: /',
    '',
    'User-agent: Google-Display-Ads-Bot',
    'Allow: /',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function renderSitemapXml(origin: string): string {
  const nowDate = new Date().toISOString().slice(0, 10);
  const paths = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/play', priority: '0.9', changefreq: 'weekly' },
    { loc: '/how-to-play', priority: '0.9', changefreq: 'monthly' },
    { loc: '/about', priority: '0.8', changefreq: 'monthly' },
    { loc: '/privacy', priority: '0.6', changefreq: 'yearly' },
    { loc: '/terms', priority: '0.6', changefreq: 'yearly' },
    { loc: '/contact', priority: '0.6', changefreq: 'yearly' },
  ];

  const entries = paths
    .map(
      (p) => `  <url>
    <loc>${escapeXml(`${origin}${p.loc}`)}</loc>
    <lastmod>${nowDate}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function buildAdsenseHeadTags(cfg: AdsenseRuntimeConfig): string {
  if (!cfg.isConfigured) {
    return '';
  }
  const safeClient = escapeHtml(cfg.clientId);
  const testAttr = cfg.testMode ? ' data-adbreak-test="on"' : '';
  return [
    `    <meta name="google-adsense-account" content="${safeClient}" />`,
    `    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.clientId)}" crossorigin="anonymous"${testAttr}></script>`,
    `    <script>window.adsbygoogle=window.adsbygoogle||[];var adBreak=adConfig=function(o){window.adsbygoogle.push(o);};</script>`,
  ].join('\n');
}

export function injectAdsenseHeadIntoHtml(html: string, cfg: AdsenseRuntimeConfig): string {
  if (!cfg.isConfigured) {
    return html;
  }
  if (html.includes('name="google-adsense-account"') || html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')) {
    return html;
  }
  const headTags = buildAdsenseHeadTags(cfg);
  if (!headTags) return html;
  return html.replace('</head>', `${headTags}\n  </head>`);
}

interface PageMeta {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  updatedLabel: string;
  bodyHtml: string;
}

export interface ContactSubmissionFeedback {
  status: 'success' | 'error';
  message: string;
  name?: string;
  email?: string;
  topic?: string;
  body?: string;
}

function getCompliancePageMeta(
  page: CompliancePageId,
  cfg: AdsenseRuntimeConfig,
  contactFeedback?: ContactSubmissionFeedback
): PageMeta {
  const safeEmail = escapeHtml(cfg.contactEmail);
  const mailHref = `mailto:${encodeURIComponent(cfg.contactEmail)}`;

  switch (page) {
    case 'privacy-policy':
      return {
        title: `Privacy Policy | ${cfg.siteName}`,
        description:
          'Privacy Policy for Sonko — Ugandan Courtyard Hopscotch, detailing Google AdSense & H5 Games Ads cookies, personalized ad opt-outs, local storage, and multiplayer data handling.',
        eyebrow: 'Legal & Data Transparency',
        heading: 'Privacy Policy',
        updatedLabel: 'Last updated: November 2026',
        bodyHtml: `
          <section>
            <h2>1. Overview</h2>
            <p>
              <strong>${escapeHtml(cfg.siteName)}</strong> is committed to respecting your privacy while you play
              our 3D courtyard hopscotch game on desktop and mobile browsers. This Privacy Policy explains what
              information is stored locally on your device, what temporary session data is used for multiplayer
              matches and global leaderboards, and how advertising partners such as Google AdSense and Google H5
              Games Ads operate on this site.
            </p>
          </section>

          <section>
            <h2>2. Google AdSense, H5 Games Ads &amp; Cookies</h2>
            <p>
              To keep Sonko free to play, we use <strong>Google AdSense</strong> and the
              <strong>Google H5 Games Ads Placement API</strong> to display optional rewarded video placements
              (such as doubling match Cowries, rerolling a daily mission, or opening a daily bonus chest) and
              frequency-capped intermission breaks between matches.
            </p>
            <ul>
              <li>
                Third-party vendors, including Google, use cookies or similar local identifiers to serve ads based
                on a user's prior visits to this website or other websites on the internet.
              </li>
              <li>
                Google's use of advertising cookies enables it and its partners to serve ads to users based on
                their visit to Sonko and/or other sites on the Internet.
              </li>
              <li>
                Users may opt out of personalized advertising at any time by visiting
                <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
                You can also opt out of third-party vendor use of cookies for personalized advertising by visiting
                <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">aboutads.info/choices</a>.
              </li>
              <li>
                Inside Sonko, you can also switch between <strong>Personalized Ads</strong> and
                <strong>Non-Personalized Ads</strong> at any time via the in-game consent banner or inside
                <strong>Settings &rarr; Privacy &amp; Ad Preferences</strong>.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Local Browser Storage &amp; Game Progress</h2>
            <p>
              Sonko stores gameplay preferences, sound settings, graphics quality, cookie/ad consent choices,
              Cowrie currency balances, unlocked outfits/stones/stencils, and daily streak progress locally in
              your browser via <code>localStorage</code> and <code>IndexedDB</code>. This data stays on your
              device unless you choose to join an online match or submit a score to the leaderboard.
            </p>
          </section>

          <section>
            <h2>4. Leaderboards, Online Matches &amp; Contact Inquiries</h2>
            <ul>
              <li>
                <strong>Global Leaderboard:</strong> When you complete a qualifying match, an anonymous generated
                player identifier and your chosen display nickname (along with score, venue, and wins) are saved on
                the game server so rankings remain accurate.
              </li>
              <li>
                <strong>Online 1v1 Rooms:</strong> WebSocket rooms relay real-time turn coordinates, wind state,
                and character cosmetics between active room participants and expire automatically after inactivity.
              </li>
              <li>
                <strong>Reward Verification:</strong> Server endpoints track anonymous player reward receipts and
                daily caps to prevent duplicate reward claims.
              </li>
              <li>
                <strong>Contact Form:</strong> Messages submitted via our <a href="/contact">Contact page</a>
                (name, email, subject, and message) are used strictly to respond to your support, privacy, or
                copyright request.
              </li>
            </ul>
          </section>

          <section>
            <h2>5. Children's Privacy</h2>
            <p>
              Sonko is designed as a family-friendly cultural sports game and does not knowingly collect
              personally identifiable information from children under 13 (or the applicable digital consent age in
              your region). If you believe personal information has been submitted in error, contact us for prompt
              removal.
            </p>
          </section>

          <section>
            <h2>6. Contact &amp; Data Requests</h2>
            <p>
              For privacy inquiries, ad preference questions, or data deletion requests, please email
              <a href="${mailHref}">${safeEmail}</a> or use the <a href="/contact">Contact form</a>.
            </p>
          </section>
        `,
      };

    case 'terms':
      return {
        title: `Terms of Use | ${cfg.siteName}`,
        description:
          'Terms of Use for Sonko — Ugandan Courtyard Hopscotch covering fair gameplay, Cowrie virtual currency rules, Creator Studio copyright guidelines, and liability.',
        eyebrow: 'Rules & Guidelines',
        heading: 'Terms of Use',
        updatedLabel: 'Last updated: November 2026',
        bodyHtml: `
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or playing <strong>${escapeHtml(cfg.siteName)}</strong>, you agree to abide by these
              Terms of Use and all applicable laws. If you do not agree with any part of these terms, please
              discontinue use of the game and website.
            </p>
          </section>

          <section>
            <h2>2. License &amp; Fair Gameplay</h2>
            <p>
              We grant you a personal, non-exclusive, revocable license to play Sonko in a standard web browser.
              You agree not to automate, tamper with, exploit, or reverse-engineer server reward endpoints,
              leaderboard submissions, or live 1v1 multiplayer WebSocket rooms.
            </p>
          </section>

          <section>
            <h2>3. Virtual Currency (Cowries)</h2>
            <p>
              Sonko features an in-game virtual reward currency called <strong>Cowries</strong> used exclusively
              at the Courtyard Stall to unlock cosmetics such as stones, outfits, hairstyles, and chalk stencils.
              Cowries have <strong>no real-world monetary value</strong>, cannot be purchased for cash, cannot be
              redeemed for money or real goods, and are non-transferable between accounts or devices.
            </p>
          </section>

          <section>
            <h2>4. Creator Studio &amp; Custom 3D Assets</h2>
            <p>
              Players who upload custom 3D <code>.glb</code> models through the Creator Studio certify that they
              own the rights or hold a valid license to use and display those assets. Uploading infringing,
              malicious, or inappropriate content is strictly prohibited, and operators reserve the right to
              remove uploaded assets at any time.
            </p>
          </section>

          <section>
            <h2>5. Advertisements &amp; Third-Party Services</h2>
            <p>
              Sonko integrates Google AdSense / H5 Games Ads to support free access. Ad availability is governed
              by Google's publisher policies and your consent selection. Optional rewarded ads never charge fees;
              if an ad is dismissed early or unavailable, no bonus reward is granted.
            </p>
          </section>

          <section>
            <h2>6. Disclaimer of Warranty &amp; Contact</h2>
            <p>
              Sonko is provided "as is" without warranties of uninterrupted uptime or device compatibility. For
              questions regarding these Terms, please contact <a href="${mailHref}">${safeEmail}</a> or visit our
              <a href="/contact">Contact page</a>.
            </p>
          </section>
        `,
      };

    case 'about':
      return {
        title: `About Sonko | ${cfg.siteName}`,
        description:
          'Discover the story, cultural inspiration, 3D courtyard environments, and engineering behind Sonko — Ugandan Courtyard Hopscotch.',
        eyebrow: 'Our Story & Heritage',
        heading: 'About Sonko',
        updatedLabel: 'Cultural 3D Courtyard Sports Game',
        bodyHtml: `
          <section>
            <h2>Preserving Ugandan Courtyard Hopscotch in 3D</h2>
            <p>
              <strong>Sonko</strong> brings the beloved Ugandan schoolyard and home-compound hopscotch game into
              a sunlit, tactile 3D web experience. Known across generations for lively afternoon matches drawn in
              chalk on warm red murram earth, Sonko blends precision stone tossing (<em>Ejjinja</em>), rhythmic
              single-foot hopping, balance control, and the thrilling blind back-toss used to claim a square as
              your own <em>House</em>.
            </p>
          </section>

          <section>
            <h2>Five Hand-Crafted Worlds &amp; Venues</h2>
            <ul>
              <li><strong>Primary Schoolyard:</strong> Brick classrooms, dusty courtyard chalk, cheerful spectators, and arrival animation.</li>
              <li><strong>Kampala Compound:</strong> Sun-baked murram soil framed by banana groves, mango shade, and clay roof tiles.</li>
              <li><strong>Entebbe Lakeshore:</strong> Coastal breeze, warm sand, shoreline palms, and rippling water nearby.</li>
              <li><strong>Jinja Rain Garden:</strong> Lush river mist, wet reflective puddles on the court, and drifting rain showers.</li>
              <li><strong>Ndere Night Pavilion:</strong> Warm lantern glow, firelight ambiance, and celebratory evening atmosphere.</li>
            </ul>
          </section>

          <section>
            <h2>Dynamic Weather &amp; Living Courtyards</h2>
            <p>
              Every venue responds to time-of-day presets and real-time weather conditions. When wind picks up or
              tropical rain sweeps across Jinja, canopy leaves sway organically in synced wind gusts, puddles
              shimmer across court tiles, and rain/fog intensity adapts smoothly while maintaining responsive
              60 FPS browser performance.
            </p>
          </section>

          <section>
            <h2>Independent Web Publishing</h2>
            <p>
              Sonko runs directly in modern browsers with zero downloads required, supports offline PWA caching,
              pass-and-play local multiplayer, AI courtyard rivals, and real-time 1v1 online rooms. Have feedback
              or partnership questions? Reach us on our <a href="/contact">Contact page</a>.
            </p>
          </section>
        `,
      };

    case 'how-to-play':
      return {
        title: `How to Play Sonko | ${cfg.siteName}`,
        description:
          'Complete guide to Sonko rules, Ejjinja stone throwing, hopping controls, claiming houses, weather hazards, Cowries, and strategies.',
        eyebrow: 'Official Player Guide',
        heading: 'How to Play Sonko',
        updatedLabel: 'Rules, Controls & Winning Strategy',
        bodyHtml: `
          <section>
            <h2>1. Objective of the Game</h2>
            <p>
              Win by claiming the highest score and the most <strong>Houses</strong> across either a classic
              5-square or full 10-square Ugandan courtyard court. You can play Solo Practice, challenge AI rivals,
              compete locally in 2-Player or 2v2 Team modes, or face opponents live in Online 1v1.
            </p>
          </section>

          <section>
            <h2>2. Step-by-Step Turn Loop</h2>
            <ol>
              <li>
                <strong>Toss Your Stone (Ejjinja):</strong> Hold <em>Left-Click</em> or <em>Space</em> to aim and
                charge your throw into the highlighted target square, then release. Keep the stone inside the chalk
                borders—landing inside the inner ring earns a <strong>Bullseye</strong> bonus!
              </li>
              <li>
                <strong>Hop the Court:</strong> Click the highlighted tile (or press <em>Space</em> / <em>W</em> /
                <em>Up Arrow</em>) to hop along the court on one foot for single squares and two feet on straddle
                pairs, always <strong>skipping</strong> the square holding your stone and any opponent Houses.
              </li>
              <li>
                <strong>Balance &amp; Wind:</strong> Watch the balance meter during single-foot hops. Use
                <em>A / D</em> or <em>Left / Right Arrows</em> to steady your posture, especially during gusty wind.
              </li>
              <li>
                <strong>Turn Around &amp; Scoop:</strong> Rest with both feet inside the Home arch at the top of
                the court, turn back, hop down, pause just before your stone's square, and press <em>E</em>,
                <em>Enter</em>, or <em>Space</em> to scoop your stone without losing balance.
              </li>
              <li>
                <strong>Claim a House:</strong> After clearing the final square in a round, stand at the baseline and
                perform a blind over-the-shoulder toss. If your stone lands cleanly on an unclaimed tile, that tile
                becomes your permanent <strong>House</strong>! You can rest on your own House, while rivals must
                skip over it.
              </li>
            </ol>
          </section>

          <section>
            <h2>3. Controls Reference</h2>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Mouse / Touch</th>
                    <th>Keyboard</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Aim &amp; Charge Stone Toss</td>
                    <td>Hold &amp; Release Canvas</td>
                    <td>Hold &amp; Release Space</td>
                  </tr>
                  <tr>
                    <td>Hop Forward / Return</td>
                    <td>Tap Highlighted Square</td>
                    <td>Space, W, or Up Arrow</td>
                  </tr>
                  <tr>
                    <td>Steer Single-Foot Balance</td>
                    <td>On-Screen Tilt Controls</td>
                    <td>A / D or Left / Right Arrows</td>
                  </tr>
                  <tr>
                    <td>Scoop Stone</td>
                    <td>Tap Scoop Prompt / Tile</td>
                    <td>E, Enter, or Space</td>
                  </tr>
                  <tr>
                    <td>Switch Camera / Orbit</td>
                    <td>Right-Drag Orbit</td>
                    <td>C (Camera) · H (View Bar)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2>4. Weather, Cowries &amp; Daily Missions</h2>
            <ul>
              <li>
                <strong>Puddles &amp; Wind:</strong> Rainy courts form reflective puddles that make landings
                slipperier, while courtyard breezes nudge high stone tosses sideways.
              </li>
              <li>
                <strong>Cowries &amp; Courtyard Stall:</strong> Earn Cowries from matches, daily login streaks, and
                Daily Missions to unlock custom stones, Kitenge outfits, hair styles, and chalk stencils.
              </li>
              <li>
                <strong>Frequently Asked Question — What counts as a foul?</strong> Stepping on a chalk line,
                tossing outside your target square, stepping into an opponent's House, or losing balance ends your
                turn and passes play to the next challenger.
              </li>
            </ul>
          </section>
        `,
      };

    case 'contact': {
      const bannerHtml = contactFeedback
        ? `<div class="notice ${contactFeedback.status === 'success' ? 'notice-ok' : 'notice-err'}" role="status">${escapeHtml(
            contactFeedback.message
          )}</div>`
        : '';

      const preName = escapeHtml(contactFeedback?.status === 'error' ? contactFeedback.name || '' : '');
      const preEmail = escapeHtml(contactFeedback?.status === 'error' ? contactFeedback.email || '' : '');
      const preTopic = contactFeedback?.status === 'error' ? contactFeedback.topic || 'Support' : 'Support';
      const preBody = escapeHtml(contactFeedback?.status === 'error' ? contactFeedback.body || '' : '');

      const topics = ['Support', 'Privacy / Ad Preferences', 'Copyright / Creator Studio', 'Business & Press'];
      const topicOptions = topics
        .map(
          (t) =>
            `<option value="${escapeHtml(t)}"${preTopic === t ? ' selected' : ''}>${escapeHtml(t)}</option>`
        )
        .join('');

      return {
        title: `Contact Us | ${cfg.siteName}`,
        description:
          'Contact the Sonko — Ugandan Courtyard Hopscotch publisher team for player support, privacy requests, AdSense inquiries, or Creator Studio questions.',
        eyebrow: 'Publisher Support',
        heading: 'Contact Us',
        updatedLabel: 'We respond within 2–3 business days',
        bodyHtml: `
          <section>
            <h2>Direct Support Channels</h2>
            <p>
              Questions about gameplay, bug reports, privacy rights, AdSense compliance, or Creator Studio 3D
              uploads? You can reach the Sonko publishing team directly by email at
              <a href="${mailHref}">${safeEmail}</a> or by using the contact form below.
            </p>
          </section>

          ${bannerHtml}

          <section>
            <h2>Send a Message</h2>
            <form method="POST" action="/contact" class="contact-form">
              <div class="field-row">
                <label>
                  <span>Your Name</span>
                  <input type="text" name="name" required minlength="2" maxlength="80" value="${preName}" placeholder="e.g. Namono Sarah" />
                </label>
                <label>
                  <span>Email Address</span>
                  <input type="email" name="email" required maxlength="160" value="${preEmail}" placeholder="you@example.com" />
                </label>
              </div>
              <label>
                <span>Topic</span>
                <select name="topic">${topicOptions}</select>
              </label>
              <label>
                <span>Message</span>
                <textarea name="message" required minlength="10" maxlength="2000" rows="5" placeholder="Tell us how we can help...">${preBody}</textarea>
              </label>
              <button type="submit" class="btn-primary">Send Message</button>
            </form>
          </section>
        `,
      };
    }
  }
}

export function renderComplianceHtmlPage(
  page: CompliancePageId,
  origin: string,
  cfg: AdsenseRuntimeConfig,
  contactFeedback?: ContactSubmissionFeedback
): string {
  const meta = getCompliancePageMeta(page, cfg, contactFeedback);
  const canonicalUrl = `${origin}/${page}`;
  const adsenseHead = buildAdsenseHeadTags(cfg);

  const navItems: Array<{ id: CompliancePageId; href: string; label: string }> = [
    { id: 'how-to-play', href: '/how-to-play', label: 'How to Play' },
    { id: 'about', href: '/about', label: 'About' },
    { id: 'privacy-policy', href: '/privacy-policy', label: 'Privacy Policy' },
    { id: 'terms', href: '/terms', label: 'Terms' },
    { id: 'contact', href: '/contact', label: 'Contact' },
  ];

  const navLinksHtml = navItems
    .map(
      (item) =>
        `<a href="${item.href}" class="nav-link${item.id === page ? ' active' : ''}">${item.label}</a>`
    )
    .join('\n          ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="theme-color" content="#1F100B" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
${adsenseHead}
    <style>
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: radial-gradient(circle at top center, #331910 0%, #1F100B 60%, #140906 100%);
        color: #FAF3E8;
        line-height: 1.65;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      a {
        color: #FBBF24;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      a:hover {
        color: #FDE68A;
      }
      header.site-header {
        border-bottom: 1px solid rgba(250, 243, 232, 0.14);
        background: rgba(21, 10, 6, 0.92);
        position: sticky;
        top: 0;
        z-index: 20;
      }
      .header-inner {
        max-width: 960px;
        margin: 0 auto;
        padding: 14px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .brand {
        font-weight: 800;
        font-size: 1.15rem;
        letter-spacing: -0.02em;
        color: #FAF3E8;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .brand span.accent {
        color: #F59E0B;
      }
      nav.top-nav {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .nav-link {
        color: #E5D3BE;
        text-decoration: none;
        font-size: 0.88rem;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 8px;
      }
      .nav-link:hover,
      .nav-link.active {
        background: rgba(245, 158, 11, 0.16);
        color: #FCD34D;
      }
      .play-cta {
        display: inline-block;
        background: #F59E0B;
        color: #1A0B07;
        font-weight: 700;
        font-size: 0.88rem;
        padding: 8px 14px;
        border-radius: 8px;
        text-decoration: none;
      }
      .play-cta:hover {
        background: #FBBF24;
        color: #1A0B07;
      }
      main.doc-shell {
        flex: 1;
        width: 100%;
        max-width: 880px;
        margin: 32px auto 48px;
        padding: 0 20px;
      }
      article.doc-card {
        background: rgba(29, 14, 9, 0.92);
        border: 1px solid rgba(250, 243, 232, 0.14);
        border-radius: 16px;
        padding: 28px 28px 36px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
      }
      .eyebrow {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #F59E0B;
        margin: 0 0 6px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(1.85rem, 3.2vw, 2.5rem);
        line-height: 1.15;
        color: #FAF3E8;
      }
      .updated {
        font-size: 0.84rem;
        color: rgba(229, 211, 190, 0.72);
        margin: 0 0 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(250, 243, 232, 0.12);
      }
      section {
        margin-top: 24px;
      }
      h2 {
        margin: 0 0 10px;
        font-size: 1.2rem;
        color: #FDE68A;
      }
      p, li {
        color: #E5D3BE;
        font-size: 0.98rem;
      }
      ul, ol {
        padding-left: 22px;
        margin: 8px 0 0;
      }
      li {
        margin-bottom: 8px;
      }
      code {
        background: rgba(250, 243, 232, 0.08);
        padding: 2px 6px;
        border-radius: 5px;
        font-size: 0.88em;
        color: #FDE68A;
      }
      .table-wrap {
        overflow-x: auto;
        margin-top: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.92rem;
      }
      th, td {
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(250, 243, 232, 0.12);
      }
      th {
        color: #FCD34D;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.03);
      }
      .contact-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 12px;
      }
      .field-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }
      .contact-form label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 0.88rem;
        font-weight: 600;
        color: #E5D3BE;
      }
      .contact-form input,
      .contact-form select,
      .contact-form textarea {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid rgba(250, 243, 232, 0.2);
        background: #140906;
        color: #FAF3E8;
        font-family: inherit;
        font-size: 0.95rem;
      }
      .contact-form input:focus,
      .contact-form select:focus,
      .contact-form textarea:focus {
        outline: 2px solid #F59E0B;
        border-color: #F59E0B;
      }
      .btn-primary {
        align-self: flex-start;
        background: #F59E0B;
        color: #1A0B07;
        border: 0;
        border-radius: 8px;
        padding: 11px 20px;
        font-weight: 700;
        font-size: 0.95rem;
        cursor: pointer;
      }
      .btn-primary:hover {
        background: #FBBF24;
      }
      .notice {
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: 10px;
        font-size: 0.92rem;
        font-weight: 600;
      }
      .notice-ok {
        background: rgba(16, 185, 129, 0.16);
        border: 1px solid rgba(52, 211, 153, 0.45);
        color: #A7F3D0;
      }
      .notice-err {
        background: rgba(239, 68, 68, 0.16);
        border: 1px solid rgba(248, 113, 113, 0.45);
        color: #FECACA;
      }
      footer.site-footer {
        border-top: 1px solid rgba(250, 243, 232, 0.12);
        background: rgba(16, 7, 5, 0.95);
        padding: 20px;
        text-align: center;
        font-size: 0.85rem;
        color: rgba(229, 211, 190, 0.72);
      }
      .footer-links {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 10px;
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="header-inner">
        <a href="/" class="brand">Sonko <span class="accent">Courtyard</span></a>
        <nav class="top-nav" aria-label="Site navigation">
          ${navLinksHtml}
          <a href="/" class="play-cta">Play Game</a>
        </nav>
      </div>
    </header>

    <main class="doc-shell">
      <article class="doc-card">
        <p class="eyebrow">${escapeHtml(meta.eyebrow)}</p>
        <h1>${escapeHtml(meta.heading)}</h1>
        <p class="updated">${escapeHtml(meta.updatedLabel)}</p>
        ${meta.bodyHtml}
      </article>
    </main>

    <footer class="site-footer">
      <div class="footer-links">
        <a href="/">Play Sonko</a>
        <a href="/how-to-play">How to Play</a>
        <a href="/about">About</a>
        <a href="/privacy-policy">Privacy Policy</a>
        <a href="/terms">Terms of Use</a>
        <a href="/contact">Contact</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} ${escapeHtml(cfg.siteName)}. All rights reserved.</div>
    </footer>
  </body>
</html>
`;
}
