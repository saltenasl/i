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

export type NoteSentiment = 'positive' | 'negative' | 'neutral' | 'varied';
export type EntityType = 'person' | 'org' | 'tool' | 'place' | 'concept' | 'event';
export type FactPerspective = 'self' | 'other' | 'uncertain';

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
    ownerEntityId: string;
    perspective: FactPerspective;
    segmentId?: string;
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
  segments: Array<{
    id: string;
    start: number;
    end: number;
    sentiment: NoteSentiment;
    summary: string;
    entityIds: string[];
    factIds: string[];
    relationIndexes: number[];
  }>;
};

export type ExtractionDebug = {
  inputText: string;
  prompt: string;
  rawModelOutput: string;
  validatedExtractionV2BeforeSegmentation: ExtractionV2;
  finalExtractionV2: ExtractionV2;
  finalExtractionV1: Extraction;
  segmentationTrace: Array<{
    segmentId: string;
    start: number;
    end: number;
    reason: string;
  }>;
  runtime: {
    modelPath: string;
    serverMode: 'metal' | 'cpu';
    nPredict: number;
    totalMs: number;
  };
  fallbackUsed: boolean;
  errors: string[];
};

export type ExtractionLaneId = 'local-llama' | 'anthropic-haiku' | 'openai-gpt5mini';

export type ExtractionLaneResult = {
  laneId: ExtractionLaneId;
  provider: 'local' | 'anthropic' | 'openai';
  model: string;
  status: 'ok' | 'error' | 'skipped';
  durationMs: number;
  extraction?: Extraction;
  extractionV2?: ExtractionV2;
  debug?: ExtractionDebug;
  errorMessage?: string;
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
    output: Result<
      { extraction: Extraction; extractionV2: ExtractionV2; debug: ExtractionDebug },
      AppErrorCode
    >;
  };
  'extract.compareLane': {
    input: {
      text: string;
      laneId: ExtractionLaneId;
    };
    output: Result<{ lane: ExtractionLaneResult }, AppErrorCode>;
  };
  'extract.compare': {
    input: {
      text: string;
    };
    output: Result<{ lanes: ExtractionLaneResult[] }, AppErrorCode>;
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
