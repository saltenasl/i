export type NoteSentiment = 'positive' | 'negative' | 'neutral' | 'varied';
export type EntityType = 'person' | 'org' | 'tool' | 'place' | 'concept' | 'event';
export type FactPerspective = 'self' | 'other' | 'uncertain';

export type Extraction = {
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
    evidenceStart?: number | undefined;
    evidenceEnd?: number | undefined;
    context?: string | undefined;
    confidence: number;
  }>;
  facts: Array<{
    id: string;
    ownerEntityId: string;
    perspective: FactPerspective;
    segmentId?: string | undefined;
    subjectEntityId?: string | undefined;
    predicate: string;
    objectEntityId?: string | undefined;
    objectText?: string | undefined;
    evidenceStart: number;
    evidenceEnd: number;
    confidence: number;
  }>;
  relations: Array<{
    fromEntityId: string;
    toEntityId: string;
    type: string;
    evidenceStart?: number | undefined;
    evidenceEnd?: number | undefined;
    confidence: number;
  }>;
  todos: Array<{
    id: string;
    description: string;
    assigneeEntityId?: string | undefined;
    evidenceStart: number;
    evidenceEnd: number;
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
  validatedExtractionBeforeSegmentation: Extraction;
  finalExtraction: Extraction;
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

export type ExtractionLaneId = 'google-gemini' | 'anthropic-haiku' | 'openai-gpt5mini';

export type ExtractionLaneResult = {
  laneId: ExtractionLaneId;
  provider: 'google' | 'anthropic' | 'openai';
  model: string;
  status: 'ok' | 'error' | 'skipped';
  durationMs: number;
  extraction?: Extraction | undefined;
  debug?: ExtractionDebug | undefined;
  errorMessage?: string | undefined;
};
