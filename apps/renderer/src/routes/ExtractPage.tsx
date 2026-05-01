import type {
  Extraction,
  ExtractionDebug,
  ExtractionLaneId,
  ExtractionLaneResult,
} from '@repo/auto-extract';
import type { ExtractionHistoryEntry } from '@repo/db';
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { useRpc } from '../api-context.js';
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
  const rpc = useRpc();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareCompleted, setCompareCompleted] = useState(0);
  const [compareLanes, setCompareLanes] = useState<CompareLaneUi[]>([]);
  const [historyEntries, setHistoryEntries] = useState<ExtractionHistoryEntry[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [copySelectedState, setCopySelectedState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [result, setResult] = useState<{
    extraction: Extraction;
    debug: ExtractionDebug;
  } | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await rpc.api.extract.history.list.$get({ query: { limit: '100' } });
    const data = await res.json();

    if (!data.ok) {
      setHistoryError('Failed to load history');
      return;
    }
    setHistoryError(null);
    setHistoryEntries(data.history);
  }, [rpc]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const submit = async () => {
    setIsSubmitting(true);
    setCompareLanes([]);
    setCompareCompleted(0);

    const res = await rpc.api.extract.run.$post({ json: { text } });
    const data = await res.json();

    setIsSubmitting(false);

    if (!data.ok) {
      setError('Extraction failed');
      setResult(null);
      return;
    }

    setError(null);
    setResult({
      extraction: data.extraction,
      debug: data.debug,
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
      const promises = compareLaneOrder.map(async (laneId) => {
        try {
          const res = await rpc.api.extract.compareLane.$post({
            json: { text, laneId: laneId as ExtractionLaneId },
          });
          const data = await res.json();

          if (!data.ok) {
            throw new Error('Lane failed');
          }
          const laneUi = toLaneUi(data.lane);
          setCompareLanes((current) =>
            current.map((lane) => (lane.laneId === laneId ? laneUi : lane)),
          );
          setCompareCompleted((current) => current + 1);
          return data.lane;
        } catch (error) {
          const errorLaneUi = toLaneUi({
            laneId,
            provider:
              laneId === 'google-gemini'
                ? 'google'
                : laneId === 'anthropic-haiku'
                  ? 'anthropic'
                  : 'openai',
            model: 'unknown',
            status: 'error',
            durationMs: 0,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          setCompareLanes((current) =>
            current.map((lane) => (lane.laneId === laneId ? errorLaneUi : lane)),
          );
          setCompareCompleted((current) => current + 1);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const successfulLanes = results.filter((r): r is ExtractionLaneResult => r !== null);
      if (successfulLanes.length > 0) {
        await rpc.api.extract.history.saveCompare.$post({
          json: { text, lanes: successfulLanes },
        });
      }
    } catch (globalError) {
      setError(globalError instanceof Error ? globalError.message : String(globalError));
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
              extraction: entry.extraction,
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

  const openHistoryEntry = (entry: ExtractionHistoryEntry) => {
    setText(entry.sourceText);
    setResult({
      extraction: entry.extraction,
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
          <ExtractionView extraction={result.extraction} sourceText={text} debug={result.debug} />

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
