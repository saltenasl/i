import type { Api } from '@repo/api';
import { createContext, useContext } from 'react';

export const ApiContext = createContext<Api | null>(null);

export const useApi = (): Api => {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('ApiContext is missing. Wrap the app with ApiProvider.');
  }

  return api;
};

export const resolveWindowApi = (): Api => {
  if (!window.appApi) {
    throw new Error('window.appApi is not available. Ensure preload bridge is configured.');
  }

  return window.appApi;
};
