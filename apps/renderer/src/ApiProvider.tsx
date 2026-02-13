import type { Api } from '@repo/api';
import type { PropsWithChildren } from 'react';
import { ApiContext, resolveWindowApi } from './api-context.js';

export interface ApiProviderProps {
  api?: Api;
}

export const ApiProvider = ({ api, children }: PropsWithChildren<ApiProviderProps>) => {
  const resolved = api ?? resolveWindowApi();
  return <ApiContext.Provider value={resolved}>{children}</ApiContext.Provider>;
};
