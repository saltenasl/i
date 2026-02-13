import type { Result } from './result.js';

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'DB_ERROR';

export interface NoteDto {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Extraction = {
  title: string;
  memory?: string;
  items: Array<{
    label: string;
    value: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  groups: Array<{
    name: string;
    itemIndexes: number[];
  }>;
};

export interface ApiMethodMap {
  'health.ping': {
    input: Record<string, never>;
    output: Result<{ status: 'ok' }, AppErrorCode>;
  };
  'notes.list': {
    input: Record<string, never>;
    output: Result<{ notes: NoteDto[] }, AppErrorCode>;
  };
  'notes.create': {
    input: {
      title: string;
      body?: string;
    };
    output: Result<{ note: NoteDto }, AppErrorCode>;
  };
  'extract.run': {
    input: {
      text: string;
    };
    output: Result<{ extraction: Extraction }, AppErrorCode>;
  };
}

export type ApiMethodName = keyof ApiMethodMap;

export type ApiInput<K extends ApiMethodName> = ApiMethodMap[K]['input'];
export type ApiOutput<K extends ApiMethodName> = ApiMethodMap[K]['output'];

export type ApiHandlers = {
  [K in ApiMethodName]: (input: ApiInput<K>) => Promise<ApiOutput<K>>;
};

export interface Api {
  call<K extends ApiMethodName>(method: K, input: ApiInput<K>): Promise<ApiOutput<K>>;
}

export const createApiFromHandlers = (handlers: ApiHandlers): Api => ({
  call: async (method, input) => handlers[method](input),
});
