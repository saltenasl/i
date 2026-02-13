import {
  type AnyIpcApiRequest,
  type ApiHandlers,
  IPC_API_CHANNEL,
  type IpcApiResponse,
} from '@repo/api';
import { ipcMain } from 'electron';

const invokeHandler = async (
  handlers: ApiHandlers,
  request: AnyIpcApiRequest,
): Promise<IpcApiResponse> => {
  switch (request.method) {
    case 'health.ping':
      return handlers['health.ping'](request.input);
    case 'notes.list':
      return handlers['notes.list'](request.input);
    case 'notes.create':
      return handlers['notes.create'](request.input);
    case 'extract.run':
      return handlers['extract.run'](request.input);
  }
};

export const registerIpcApiHandlers = (handlers: ApiHandlers): void => {
  ipcMain.removeHandler(IPC_API_CHANNEL);

  ipcMain.handle(IPC_API_CHANNEL, async (_event, request: AnyIpcApiRequest) => {
    return invokeHandler(handlers, request);
  });
};
