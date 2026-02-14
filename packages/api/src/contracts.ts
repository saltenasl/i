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

export type NoteSentiment = 'positive' | 'negative' | 'neutral' | 'mixed';
export type EntityType = 'person' | 'org' | 'tool' | 'place' | 'concept' | 'event';

export type ExtractionV2 = {
  title: string;
  noteType: string;
  summary: string;
  language: string;
  date: string | null;
  sentiment: NoteSentiment;
  emotions: Array<{
    emotion: string;
    intensity: 1 | 2 | 3 | 4 | 5;
  }>;
  entities: Array<{
    id: string;
    name: string;
    type: EntityType;
    nameStart: number;
    nameEnd: number;
    evidenceStart?: number;
    evidenceEnd?: number;
    context?: string;
    confidence: number;
  }>;
  facts: Array<{
    id: string;
    subjectEntityId?: string;
    predicate: string;
    objectEntityId?: string;
    objectText?: string;
    evidenceStart: number;
    evidenceEnd: number;
    confidence: number;
  }>;
  relations: Array<{
    fromEntityId: string;
    toEntityId: string;
    type: string;
    evidenceStart?: number;
    evidenceEnd?: number;
    confidence: number;
  }>;
  groups: Array<{
    name: string;
    entityIds: string[];
    factIds: string[];
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
    output: Result<{ extraction: Extraction; extractionV2: ExtractionV2 }, AppErrorCode>;
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
