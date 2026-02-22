import type { ExtractionDebug, ExtractionHistoryEntryDto, ExtractionV2 } from '@repo/api';
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { useApi } from '../api-context.js';
import {
  CompareLaneCard,
  type CompareLaneUi,
  compareLaneOrder,
  createLoadingLane,
  toLaneUi,
} from '../components/compare/CompareLaneCard.js';
import { ExtractionView } from '../components/extraction/View.js';
import {
  ExtractionHistoryList,
  HistoryCopyFloating,
} from '../components/history/ExtractionHistoryList.js';

export const ExtractPage = () => {
  const api = useApi();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareCompleted, setCompareCompleted] = useState(0);
  const [compareLanes, setCompareLanes] = useState<CompareLaneUi[]>([]);
  const [historyEntries, setHistoryEntries] = useState<ExtractionHistoryEntryDto[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [copySelectedState, setCopySelectedState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [result, setResult] = useState<{
    extractionV2: ExtractionV2;
    debug: ExtractionDebug;
  } | null>(null);
  const loadHistory = useCallback(async () => {
    const response = await api.call('extract.history.list', { limit: 100 });
    if (!response.ok) {
      setHistoryError(response.error.message);
      return;
    }
    setHistoryError(null);
    setHistoryEntries(response.data.entries);
  }, [api]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const submit = async () => {
    setIsSubmitting(true);
    setCompareLanes([]);
    setCompareCompleted(0);

    const response = await api.call('extract.run', { text });

    setIsSubmitting(false);

    if (!response.ok) {
      setError(response.error.message);
      setResult(null);
      return;
    }

    setError(null);
    setResult({
      extractionV2: response.data.extractionV2,
      debug: response.data.debug,
    });
    await loadHistory();
  };

  const submitCompare = async () => {
    setIsComparing(true);
    setResult(null);
    setError(null);
    setCompareCompleted(0);
    setCompareLanes(compareLaneOrder.map((laneId) => createLoadingLane(laneId)));
    try {
      const response = await api.call('extract.compare', { text });
      if (!response.ok) {
        setError(response.error.message);
        setCompareLanes([]);
        return;
      }

      const byLaneId = new Map(response.data.lanes.map((lane) => [lane.laneId, toLaneUi(lane)]));
      setCompareLanes(
        compareLaneOrder.map((laneId) => byLaneId.get(laneId) ?? createLoadingLane(laneId)),
      );
      setCompareCompleted(compareLaneOrder.length);
    } catch (compareError) {
      setError(compareError instanceof Error ? compareError.message : String(compareError));
      setCompareLanes([]);
    }
    setIsComparing(false);
    await loadHistory();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit();
  };

  const onKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault();
      await submit();
    }
  };

  const toggleHistorySelection = (entryId: string) => {
    setSelectedHistoryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
    setCopySelectedState('idle');
  };

  const selectedHistory = historyEntries.filter((entry) => selectedHistoryIds.has(entry.id));

  const copySelectedDebugLogs = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            copiedAt: new Date().toISOString(),
            count: selectedHistory.length,
            entries: selectedHistory.map((entry) => ({
              id: entry.id,
              createdAt: entry.createdAt,
              sourceText: entry.sourceText,
              prompt: entry.prompt,
              extractionV2: entry.extractionV2,
              debug: entry.debug,
              compareLanes: entry.compareLanes,
            })),
          },
          null,
          2,
        ),
      );
      setCopySelectedState('copied');
    } catch {
      setCopySelectedState('error');
    }
  };

  const openHistoryEntry = (entry: ExtractionHistoryEntryDto) => {
    setText(entry.sourceText);
    setResult({
      extractionV2: entry.extractionV2,
      debug: entry.debug,
    });
    setCompareLanes((entry.compareLanes ?? []).map(toLaneUi));
    setCompareCompleted(entry.compareLanes ? entry.compareLanes.length : 0);
    setError(null);
  };

  return (
    <section>
      <h1>Auto Extract</h1>

      <form onSubmit={onSubmit} aria-label="extract-form">
        <label htmlFor="extract-text">Text</label>
        <textarea
          id="extract-text"
          data-testid="extract-text-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            void onKeyDown(event);
          }}
          placeholder="Paste text and press Cmd+Enter to submit"
        />

        <button
          data-testid="extract-submit-button"
          type="submit"
          disabled={isSubmitting || isComparing}
        >
          {isSubmitting ? 'Extracting...' : 'Submit'}
        </button>
        <button
          data-testid="extract-compare-button"
          type="button"
          onClick={() => {
            void submitCompare();
          }}
          disabled={isComparing || isSubmitting}
          style={{ marginLeft: 8 }}
        >
          {isComparing ? 'Running 3 models...' : 'Run A/B Compare'}
        </button>
      </form>

      {error ? (
        <p role="alert" data-testid="extract-error-message">
          {error}
        </p>
      ) : null}

      {historyError ? (
        <p role="alert" data-testid="extract-history-error">
          {historyError}
        </p>
      ) : null}

      {result ? (
        <>
          <ExtractionView
            extractionV2={result.extractionV2}
            sourceText={text}
            debug={result.debug}
          />

          <details style={{ marginTop: 10 }}>
            <summary>Raw JSON</summary>
            <pre
              data-testid="extraction-raw-json"
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 8,
                border: '1px solid #d0d7de',
                background: '#0d1117',
                color: '#e6edf3',
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </>
      ) : null}

      {compareLanes.length > 0 ? (
        <section data-testid="compare-results" style={{ marginTop: 18, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Model Compare</h2>
            <p data-testid="compare-progress" style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
              {compareCompleted}/{compareLaneOrder.length} complete
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
            {compareLaneOrder.map((laneId) => {
              const lane = compareLanes.find((entry) => entry.laneId === laneId);
              if (!lane) {
                return null;
              }

              return <CompareLaneCard key={laneId} lane={lane} sourceText={text} />;
            })}
          </div>
        </section>
      ) : null}

      <ExtractionHistoryList
        historyEntries={historyEntries}
        selectedHistoryIds={selectedHistoryIds}
        onToggleSelection={toggleHistorySelection}
        onOpenEntry={openHistoryEntry}
      />

      <HistoryCopyFloating
        selectedCount={selectedHistory.length}
        onCopy={() => {
          void copySelectedDebugLogs();
        }}
        copyState={copySelectedState}
      />
    </section>
  );
};
