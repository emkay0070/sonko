import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

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
}

const ROUTE_META: Record<AppRoute, RouteMeta> = {
  '/': {
    title: 'Sonko — Ugandan Courtyard Hopscotch in 3D',
    description:
      'Play Sonko, the traditional Ugandan courtyard hopscotch game of stone tossing, single-foot balance, and claiming houses on sunlit red earth.',
  },
  '/play': {
    title: 'Play Sonko — 3D Ugandan Courtyard Hopscotch',
    description:
      'Step onto the red murram court and play Sonko in 3D across Solo, AI rivals, 2-Player local, 2v2 Teams, and Online 1v1.',
  },
  '/how-to-play': {
    title: 'How to Play Sonko — Rules, Controls & Strategy',
    description:
      'Complete guide to Sonko rules, Ejjinja stone tossing, single-foot hopping, balance control, claiming Houses, weather hazards, and Cowries.',
  },
  '/about': {
    title: 'About Sonko — Heritage, Worlds & 3D Courtyard',
    description:
      'Discover the cultural inspiration, five hand-crafted East African worlds, dynamic weather, and browser-native 3D design behind Sonko.',
  },
  '/privacy': {
    title: 'Privacy Policy — Sonko Ugandan Courtyard Hopscotch',
    description:
      'Privacy Policy for Sonko detailing local browser storage, global leaderboards, online multiplayer rooms, cookies, and Google AdSense preferences.',
  },
  '/terms': {
    title: 'Terms of Use — Sonko Ugandan Courtyard Hopscotch',
    description:
      'Terms of Use for Sonko covering fair gameplay, Cowries virtual currency rules, Creator Studio guidelines, and browser compatibility.',
  },
  '/contact': {
    title: 'Contact Us — Sonko Support & Inquiries',
    description:
      'Reach the Sonko team for player support, bug reports, privacy requests, or general inquiries.',
  },
  '/404': {
    title: 'Page Not Found — Sonko',
    description: 'The requested page could not be found on Sonko.',
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

interface RouterContextValue {
  route: AppRoute;
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue>({
  route: '/',
  pathname: '/',
  navigate: () => {},
});

function resolveInitialLocation(): { route: AppRoute; pathname: string } {
  if (typeof window === 'undefined') {
    return { route: '/', pathname: '/' };
  }
  const params = new URLSearchParams(window.location.search);
  const currentRoute = normalizePathname(window.location.pathname);

  // Preserve deep invite links like /?room=CODE or /?studio=1 by routing directly to /play
  if (currentRoute === '/' && (params.has('room') || params.get('studio') === '1')) {
    const nextUrl = `/play${window.location.search}`;
    window.history.replaceState(null, '', nextUrl);
    return { route: '/play', pathname: '/play' };
  }

  return { route: currentRoute, pathname: window.location.pathname };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [loc, setLoc] = useState(resolveInitialLocation);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;
    const url = new URL(to, window.location.origin);
    const nextRoute = normalizePathname(url.pathname);
    const targetFull = `${url.pathname}${url.search}${url.hash}`;

    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== targetFull) {
      if (options?.replace) {
        window.history.replaceState(null, '', targetFull);
      } else {
        window.history.pushState(null, '', targetFull);
      }
    }

    setLoc({ route: nextRoute, pathname: url.pathname });
    if (!url.hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setLoc({
        route: normalizePathname(window.location.pathname),
        pathname: window.location.pathname,
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const meta = ROUTE_META[loc.route] ?? ROUTE_META['/'];
    document.title = meta.title;
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) {
      descEl.setAttribute('content', meta.description);
    }
    const ogTitleEl = document.querySelector('meta[property="og:title"]');
    if (ogTitleEl) {
      ogTitleEl.setAttribute('content', meta.title);
    }
    const ogDescEl = document.querySelector('meta[property="og:description"]');
    if (ogDescEl) {
      ogDescEl.setAttribute('content', meta.description);
    }
  }, [loc.route]);

  return (
    <RouterContext.Provider value={{ route: loc.route, pathname: loc.pathname, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterContextValue {
  return useContext(RouterContext);
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export function Link({ to, onClick, target, ...rest }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      target === '_blank' ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    if (to.startsWith('http://') || to.startsWith('https://') || to.startsWith('mailto:')) {
      return;
    }
    e.preventDefault();
    navigate(to);
  };

  return <a href={to} target={target} onClick={handleClick} {...rest} />;
}
