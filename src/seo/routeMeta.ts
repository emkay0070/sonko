export type AppRoute =
  | '/'
  | '/play'
  | '/how-to-play'
  | '/about'
  | '/privacy'
  | '/terms'
  | '/contact'
  | '/404';

export interface RouteMeta {
  title: string;
  description: string;
  canonicalPath: Exclude<AppRoute, '/404'> | null;
  ogType: 'website' | 'article';
  robots: string;
}

export const SITE_ORIGIN = 'https://sonko-ug.vercel.app';
export const SITE_NAME = 'Sonko';

export const PUBLIC_INDEXABLE_ROUTES: ReadonlyArray<Exclude<AppRoute, '/404'>> = [
  '/',
  '/play',
  '/how-to-play',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
];

export const ROUTE_META: Record<AppRoute, RouteMeta> = {
  '/': {
    title: 'Sonko — Ugandan Courtyard Hopscotch in 3D',
    description:
      'Play Sonko, the traditional Ugandan courtyard hopscotch game of stone tossing, single-foot balance, and claiming houses on sunlit red earth.',
    canonicalPath: '/',
    ogType: 'website',
    robots: 'index, follow',
  },
  '/play': {
    title: 'Play Sonko — 3D Ugandan Courtyard Hopscotch',
    description:
      'Step onto the red murram court and play Sonko in 3D across Solo, AI rivals, 2-Player local, 2v2 Teams, and Online 1v1.',
    canonicalPath: '/play',
    ogType: 'website',
    robots: 'index, follow',
  },
  '/how-to-play': {
    title: 'How to Play Sonko — Rules, Controls & Strategy',
    description:
      'Complete guide to Sonko rules, Ejjinja stone tossing, single-foot hopping, balance control, claiming Houses, weather hazards, and Cowries.',
    canonicalPath: '/how-to-play',
    ogType: 'article',
    robots: 'index, follow',
  },
  '/about': {
    title: 'About Sonko — Heritage, Worlds & 3D Courtyard',
    description:
      'Discover the cultural inspiration, five hand-crafted East African worlds, dynamic weather, and browser-native 3D design behind Sonko.',
    canonicalPath: '/about',
    ogType: 'article',
    robots: 'index, follow',
  },
  '/privacy': {
    title: 'Privacy Policy — Sonko Ugandan Courtyard Hopscotch',
    description:
      'Privacy Policy for Sonko detailing local browser storage, global leaderboards, online multiplayer rooms, cookies, and Google AdSense preferences.',
    canonicalPath: '/privacy',
    ogType: 'article',
    robots: 'index, follow',
  },
  '/terms': {
    title: 'Terms of Use — Sonko Ugandan Courtyard Hopscotch',
    description:
      'Terms of Use for Sonko covering fair gameplay, Cowries virtual currency rules, Creator Studio guidelines, and browser compatibility.',
    canonicalPath: '/terms',
    ogType: 'article',
    robots: 'index, follow',
  },
  '/contact': {
    title: 'Contact Us — Sonko Support & Inquiries',
    description:
      'Reach the Sonko team for player support, bug reports, privacy requests, Creator Studio questions, or general inquiries.',
    canonicalPath: '/contact',
    ogType: 'website',
    robots: 'index, follow',
  },
  '/404': {
    title: 'Page Not Found — Sonko',
    description: 'The requested page could not be found on Sonko.',
    canonicalPath: null,
    ogType: 'website',
    robots: 'noindex, follow',
  },
};

export function normalizePathname(rawPath: string): AppRoute {
  const cleaned = rawPath.replace(/\/+$/, '').toLowerCase() || '/';
  switch (cleaned) {
    case '/':
    case '/index.html':
      return '/';
    case '/play':
    case '/play.html':
      return '/play';
    case '/how-to-play':
    case '/how-to-play.html':
      return '/how-to-play';
    case '/about':
    case '/about.html':
      return '/about';
    case '/privacy':
    case '/privacy.html':
    case '/privacy-policy':
    case '/privacy-policy.html':
      return '/privacy';
    case '/terms':
    case '/terms.html':
      return '/terms';
    case '/contact':
    case '/contact.html':
      return '/contact';
    default:
      return '/404';
  }
}
