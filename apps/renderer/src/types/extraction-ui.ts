export type EntitySwatch = {
  fill: string;
  accent: string;
};

export type HoverTarget =
  | { kind: 'entity'; entityId: string }
  | { kind: 'fact'; factId: string }
  | { kind: 'todo'; todoId: string }
  | { kind: 'relation'; relationIndex: number }
  | { kind: 'group'; groupName: string }
  | { kind: 'segment'; segmentId: string }
  | null;

export type ActiveHighlights = {
  entityIds: Set<string>;
  factIds: Set<string>;
  todoIds: Set<string>;
  relationIndexes: Set<number>;
  groupNames: Set<string>;
  segmentIds: Set<string>;
};

export type SourceSpan = {
  start: number;
  end: number;
  type: 'entity-name' | 'entity-evidence' | 'fact-evidence' | 'todo-evidence' | 'relation-evidence';
  id: string;
  priority: number;
};

export type EnhancedSourceToken = {
  start: number;
  text: string;
  spans: SourceSpan[];
};

export type ExtractionViewMode = 'full' | 'compact';
