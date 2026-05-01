import type { AppType } from '@repo/server';
import { hc } from 'hono/client';
import { createContext, useContext } from 'react';

export type RpcClient = ReturnType<typeof hc<AppType>>;

export const RpcContext = createContext<RpcClient | null>(null);

export const useRpc = (): RpcClient => {
  const rpc = useContext(RpcContext);
  if (!rpc) {
    throw new Error('RpcContext is missing. Wrap the app with RpcProvider.');
  }

  return rpc;
};

export const createRpcClient = (baseUrl = '/'): RpcClient => {
  return hc<AppType>(baseUrl);
};
