import { useState } from 'react';
import { ExtractionView } from '../extraction/View.js';
import type { CompareLaneUi } from './CompareLaneCard.js';
import { compareLaneMeta, compareLaneOrder, splitLaneErrorMessage } from './CompareLaneCard.js';

export const CompareTimeline = ({
  lanes,
  sourceText,
  completed,
  total,
}: {
  lanes: CompareLaneUi[];
  sourceText: string;
  completed: number;
  total: number;
}) => {
  const activeLanes = compareLaneOrder
    .map((laneId) => lanes.find((entry) => entry.laneId === laneId))
    .filter((lane): lane is CompareLaneUi => lane !== undefined);

  return (
    <section data-testid="compare-results" style={{ marginTop: 18, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Model Compare</h2>
        <p data-testid="compare-progress" style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
          {completed}/{total} complete
        </p>
      </div>

      <div
        data-testid="compare-lanes-scroll"
        style={{
          display: 'grid',
          width: '100%',
          gap: 12,
          alignItems: 'start',
          gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(100%, 100%)',
          overflowX: 'auto',
          overscrollBehaviorX: 'contain',
          scrollSnapType: 'x mandatory',
        }}
      >
        {activeLanes.map((lane) => (
          <CompareColumn key={lane.laneId} lane={lane} sourceText={sourceText} />
        ))}
      </div>
    </section>
  );
};

const CompareColumn = ({
  lane,
  sourceText,
}: {
  lane: CompareLaneUi;
  sourceText: string;
}) => {
  const laneLabel = compareLaneMeta[lane.laneId];
  const [expanded, setExpanded] = useState(false);
  const laneError =
    lane.status === 'error' || lane.status === 'skipped'
      ? splitLaneErrorMessage(lane.errorMessage)
      : undefined;

  const canExpand = lane.status === 'ok' && lane.extraction && lane.debug;

  return (
    <article
      data-testid={`compare-lane-${lane.laneId}`}
      style={{
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fff',
        overflow: 'hidden',
        scrollSnapAlign: 'start',
      }}
    >
      <header
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        aria-expanded={canExpand ? expanded : undefined}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: canExpand ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (canExpand) {
            setExpanded((prev) => !prev);
          }
        }}
        onKeyDown={(event) => {
          if (!canExpand) {
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
      >
        <div>
          <span
            data-testid={`compare-lane-vertical-${lane.laneId}`}
            style={{
              fontSize: 10,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: '#5f6b7a',
              opacity: 0.75,
              marginRight: 8,
            }}
          >
            {laneLabel.providerLabel}
          </span>
          <strong style={{ fontSize: 13 }}>{laneLabel.label}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lane.durationMs !== null ? (
            <span style={{ fontSize: 12, opacity: 0.75 }}>{lane.durationMs}ms</span>
          ) : null}
          <span data-testid={`compare-lane-status-${lane.laneId}`} style={{ fontSize: 12 }}>
            {lane.status}
          </span>
          {canExpand ? (
            <button
              data-testid={`compare-lane-toggle-${lane.laneId}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              style={{
                background: 'none',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11,
                cursor: 'pointer',
                color: '#4c6ef5',
              }}
            >
              {expanded ? 'Minimize' : 'Expand'}
            </button>
          ) : null}
        </div>
      </header>

      {lane.status === 'loading' ? (
        <div
          data-testid={`compare-lane-loading-${lane.laneId}`}
          style={{ display: 'flex', gap: 8, padding: '10px 14px' }}
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

      {lane.status === 'error' || lane.status === 'skipped' ? (
        <div style={{ padding: 14, display: 'grid', gap: 8 }}>
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
        <div style={{ padding: '10px 14px', fontSize: 13, display: 'grid', gap: 4 }}>
          <div>
            <strong>Title:</strong> {lane.extraction?.title}
          </div>
          <div>
            <strong>Sentiment:</strong> {lane.extraction?.sentiment}
          </div>
          <div>
            <strong>Entities:</strong> {lane.extraction?.entities.length ?? 0} |{' '}
            <strong>Facts:</strong> {lane.extraction?.facts.length ?? 0} |{' '}
            <strong>Relations:</strong> {lane.extraction?.relations.length ?? 0}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            <strong>Summary:</strong> {lane.extraction?.summary}
          </div>
        </div>
      ) : null}

      {lane.status === 'ok' && lane.extraction && lane.debug && expanded ? (
        <div data-testid={`compare-lane-success-${lane.laneId}`} style={{ padding: 14 }}>
          <ExtractionView
            extraction={lane.extraction}
            sourceText={sourceText}
            debug={lane.debug}
            showDebugActions={true}
            showSegments={false}
            layoutMode="compact"
          />
        </div>
      ) : null}
    </article>
  );
};
