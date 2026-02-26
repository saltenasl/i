import type {
  Extraction,
  ExtractionDebug,
  ExtractionLaneId,
  ExtractionLaneResult,
} from '@repo/api';
import { useState } from 'react';
import { ExtractionView } from '../extraction/View.js';

export type CompareLaneUi = {
  laneId: ExtractionLaneId;
  provider: 'local' | 'anthropic' | 'openai';
  model: string;
  status: 'loading' | 'ok' | 'error' | 'skipped';
  durationMs: number | null;
  extraction?: Extraction;
  debug?: ExtractionDebug;
  errorMessage?: string;
};

export const compareLaneOrder: ExtractionLaneId[] = [
  'local-llama',
  'anthropic-haiku',
  'openai-gpt5mini',
];

export const compareLaneMeta: Record<
  ExtractionLaneId,
  { label: string; providerLabel: string; model: string }
> = {
  'local-llama': {
    label: 'Local Llama',
    providerLabel: 'Local',
    model: 'local-llama.cpp',
  },
  'anthropic-haiku': {
    label: 'Claude Haiku',
    providerLabel: 'Anthropic',
    model: 'claude-haiku-4-5-20251001',
  },
  'openai-gpt5mini': {
    label: 'GPT-5 mini',
    providerLabel: 'OpenAI',
    model: 'gpt-5-mini',
  },
};

const LANE_ERROR_PREVIEW_MAX_CHARS = 320;

export const splitLaneErrorMessage = (
  errorMessage: string | undefined,
): { preview: string; details?: string } => {
  const normalized = (errorMessage ?? 'No details.').trim();
  const rawOutputIndex = normalized.indexOf('Raw output:');
  if (rawOutputIndex >= 0) {
    const preview = normalized.slice(0, rawOutputIndex).trim();
    const details = normalized.slice(rawOutputIndex).trim();
    return {
      preview: preview.length > 0 ? preview : 'Model output was not valid JSON.',
      ...(details.length > 0 ? { details } : {}),
    };
  }

  if (normalized.length <= LANE_ERROR_PREVIEW_MAX_CHARS) {
    return { preview: normalized };
  }

  return {
    preview: `${normalized.slice(0, LANE_ERROR_PREVIEW_MAX_CHARS).trimEnd()}...`,
    details: normalized,
  };
};

export const createLoadingLane = (laneId: ExtractionLaneId): CompareLaneUi => {
  const lane = compareLaneMeta[laneId];
  return {
    laneId,
    provider:
      laneId === 'local-llama' ? 'local' : laneId === 'anthropic-haiku' ? 'anthropic' : 'openai',
    model: lane.model,
    status: 'loading',
    durationMs: null,
  };
};

export const toLaneUi = (lane: ExtractionLaneResult): CompareLaneUi => {
  // biome-ignore lint/suspicious/noExplicitAny: Support legacy extractionV2 key from older history entries
  const extraction = lane.extraction ?? (lane as any).extractionV2;
  return {
    laneId: lane.laneId,
    provider: lane.provider,
    model: lane.model,
    status: lane.status,
    durationMs: lane.durationMs,
    ...(extraction ? { extraction } : {}),
    ...(lane.debug ? { debug: lane.debug } : {}),
    ...(lane.errorMessage ? { errorMessage: lane.errorMessage } : {}),
  };
};

export const CompareLaneCard = ({
  lane,
  sourceText,
}: {
  lane: CompareLaneUi;
  sourceText: string;
}) => {
  const laneLabel = compareLaneMeta[lane.laneId];
  const laneExtraction = lane.status === 'ok' ? lane.extraction : undefined;
  const laneError =
    lane.status === 'error' || lane.status === 'skipped'
      ? splitLaneErrorMessage(lane.errorMessage)
      : undefined;
  const canExpand = lane.status === 'ok' && lane.extraction && lane.debug;
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      data-testid={`compare-lane-${lane.laneId}`}
      style={{
        position: 'relative',
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box',
        padding: '14px 14px 14px 42px',
        border: '1px dotted #9aa4b2',
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden',
        scrollSnapAlign: 'start',
      }}
    >
      <span
        data-testid={`compare-lane-vertical-${lane.laneId}`}
        style={{
          position: 'absolute',
          left: 8,
          top: 10,
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: '#5f6b7a',
          opacity: 0.75,
          pointerEvents: 'none',
        }}
      >
        {laneLabel.providerLabel} {laneLabel.label}
      </span>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => {
            if (canExpand) {
              setExpanded((prev) => !prev);
            }
          }}
          style={{
            all: 'unset',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            cursor: canExpand ? 'pointer' : 'default',
            gap: 8,
          }}
          aria-expanded={canExpand ? expanded : undefined}
        >
          <strong style={{ fontSize: 13 }}>{laneLabel.label}</strong>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span data-testid={`compare-lane-status-${lane.laneId}`} style={{ fontSize: 12 }}>
              {lane.status}
            </span>
            {canExpand ? (
              <span
                data-testid={`compare-lane-toggle-${lane.laneId}`}
                style={{
                  border: '1px solid #d0d7de',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 11,
                  color: '#4c6ef5',
                  lineHeight: 1.2,
                }}
              >
                {expanded ? 'Minimize' : 'Expand'}
              </span>
            ) : null}
          </span>
        </button>
      </header>

      <p style={{ margin: '4px 0 10px', opacity: 0.75, fontSize: 12 }}>{lane.model}</p>

      {lane.status === 'loading' ? (
        <div
          data-testid={`compare-lane-loading-${lane.laneId}`}
          style={{ display: 'flex', gap: 8 }}
        >
          <span
            className="lane-spinner"
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid #d0d7de',
              borderTopColor: '#4c6ef5',
              animation: 'lane-spin 0.8s linear infinite',
              marginTop: 3,
            }}
          />
          <span style={{ fontSize: 13 }}>Running {laneLabel.label}...</span>
        </div>
      ) : null}

      {lane.durationMs !== null ? (
        <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.75 }}>
          Duration: {lane.durationMs} ms
        </p>
      ) : null}

      {lane.status === 'error' || lane.status === 'skipped' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <p
            data-testid={`compare-lane-message-${lane.laneId}`}
            style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {laneError?.preview}
          </p>
          {laneError?.details ? (
            <details>
              <summary>Show Full Error</summary>
              <pre
                data-testid={`compare-lane-message-full-${lane.laneId}`}
                style={{
                  marginTop: 8,
                  maxHeight: 220,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  border: '1px solid #d0d7de',
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                {laneError.details}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {lane.status === 'ok' && lane.extraction && lane.debug && !expanded ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, display: 'grid', gap: 4 }}>
            <div>
              <strong>Title:</strong> {laneExtraction?.title}
            </div>
            <div>
              <strong>Sentiment:</strong> {laneExtraction?.sentiment}
            </div>
            <div>
              <strong>Entities:</strong> {laneExtraction?.entities?.length ?? 0} |{' '}
              <strong>Facts:</strong> {laneExtraction?.facts?.length ?? 0} |{' '}
              <strong>Relations:</strong> {laneExtraction?.relations?.length ?? 0}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              <strong>Summary:</strong> {laneExtraction?.summary}
            </div>
          </div>
        </div>
      ) : null}

      {lane.status === 'ok' && lane.extraction && lane.debug && expanded ? (
        <div
          data-testid={`compare-lane-success-${lane.laneId}`}
          style={{
            marginTop: 8,
            maxHeight: 680,
            overflow: 'auto',
            border: '1px solid #d0d7de',
            borderRadius: 8,
            padding: 8,
          }}
        >
          <ExtractionView
            extraction={lane.extraction}
            sourceText={sourceText}
            debug={lane.debug}
            showDebugActions={false}
            showSegments={false}
            layoutMode="compact"
          />
        </div>
      ) : null}
    </article>
  );
};
