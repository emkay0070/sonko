import React, { useEffect } from 'react';
import { RouterProvider, useRouter } from './router';
import { SiteLayout } from './components/SiteLayout';
import { SonkoGameExperience } from './components/SonkoGameExperience';
import { HomePage } from './pages/HomePage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';

function AppRoutes() {
  const { route } = useRouter();

  // Lock body scrolling only on /play where the full-screen 3D canvas lives;
  // allow natural document scrolling on all public website & content pages.
  useEffect(() => {
    if (route === '/play') {
      document.documentElement.classList.add('overflow-hidden');
      document.body.classList.add('overflow-hidden');
    } else {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
    };
  }, [route]);

  if (route === '/play') {
    return <SonkoGameExperience />;
  }

  return (
    <SiteLayout>
      {route === '/' && <HomePage />}
      {route === '/how-to-play' && <HowToPlayPage />}
      {route === '/about' && <AboutPage />}
      {route === '/privacy' && <PrivacyPage />}
      {route === '/terms' && <TermsPage />}
      {route === '/contact' && <ContactPage />}
      {route === '/404' && <NotFoundPage />}
    </SiteLayout>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppRoutes />
    </RouterProvider>
  );
}
