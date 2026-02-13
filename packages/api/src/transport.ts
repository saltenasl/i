import type { ApiInput, ApiMethodName, ApiOutput } from './contracts.js';

export const IPC_API_CHANNEL = 'app:api:call';

export type IpcApiRequest<K extends ApiMethodName = ApiMethodName> = {
  method: K;
  input: ApiInput<K>;
};

export type AnyIpcApiRequest = {
  [K in ApiMethodName]: IpcApiRequest<K>;
}[ApiMethodName];

export type IpcApiResponse<K extends ApiMethodName = ApiMethodName> = ApiOutput<K>;
