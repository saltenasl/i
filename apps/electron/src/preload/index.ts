import {
  type Api,
  type ApiInput,
  type ApiMethodName,
  type ApiOutput,
  IPC_API_CHANNEL,
  type IpcApiRequest,
} from '@repo/api';
import { contextBridge, ipcRenderer } from 'electron';

const api: Api = {
  call: async <K extends ApiMethodName>(method: K, input: ApiInput<K>): Promise<ApiOutput<K>> => {
    const request: IpcApiRequest<K> = { method, input };
    return ipcRenderer.invoke(IPC_API_CHANNEL, request) as Promise<ApiOutput<K>>;
  },
};

contextBridge.exposeInMainWorld('appApi', api);
