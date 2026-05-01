import type { PropsWithChildren } from 'react';
import { type RpcClient, RpcContext, createRpcClient } from './api-context.js';

export interface RpcProviderProps {
  rpc?: RpcClient;
}

export const RpcProvider = ({ rpc, children }: PropsWithChildren<RpcProviderProps>) => {
  const resolved = rpc ?? createRpcClient();
  return <RpcContext.Provider value={resolved}>{children}</RpcContext.Provider>;
};
