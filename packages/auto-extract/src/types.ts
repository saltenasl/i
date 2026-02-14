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
