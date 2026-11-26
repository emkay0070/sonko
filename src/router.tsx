import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type AppRoute,
  normalizePathname,
  ROUTE_META,
  type RouteMeta,
  SITE_NAME,
} from './seo/routeMeta';

export type { AppRoute, RouteMeta };
export { normalizePathname };

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

function upsertMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function syncCanonicalTag(canonicalUrl: string | null) {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalUrl) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.setAttribute('href', canonicalUrl);
    return;
  }
  const link = document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', canonicalUrl);
  document.head.appendChild(link);
}

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
    const origin = window.location.origin;
    const canonicalUrl = meta.canonicalPath ? `${origin}${meta.canonicalPath}` : null;
    const ogUrl = canonicalUrl ?? `${origin}${loc.pathname}`;

    document.title = meta.title;
    upsertMetaTag('name', 'description', meta.description);
    upsertMetaTag('name', 'robots', meta.robots);
    syncCanonicalTag(canonicalUrl);

    upsertMetaTag('property', 'og:site_name', SITE_NAME);
    upsertMetaTag('property', 'og:type', meta.ogType);
    upsertMetaTag('property', 'og:url', ogUrl);
    upsertMetaTag('property', 'og:title', meta.title);
    upsertMetaTag('property', 'og:description', meta.description);

    upsertMetaTag('name', 'twitter:title', meta.title);
    upsertMetaTag('name', 'twitter:description', meta.description);
  }, [loc.route, loc.pathname]);

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
