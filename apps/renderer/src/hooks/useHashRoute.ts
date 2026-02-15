import { useEffect, useState } from 'react';

export type Route = 'extract' | 'notes' | 'view';

export type RouteParams = {
  id?: string;
};

const resolveRoute = (hash: string): { route: Route; params: RouteParams } => {
  if (hash === '#/notes') {
    return { route: 'notes', params: {} };
  }

  const viewMatch = hash.match(/^#\/view\/(.+)$/);
  if (viewMatch?.[1]) {
    return { route: 'view', params: { id: viewMatch[1] } };
  }

  return { route: 'extract', params: {} };
};

export const useHashRoute = (): { route: Route; params: RouteParams } => {
  const [state, setState] = useState(() => resolveRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setState(resolveRoute(window.location.hash));
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return state;
};
