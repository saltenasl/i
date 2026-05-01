import type { ExtractionHistoryEntry } from '@repo/db';
import { useCallback, useEffect, useState } from 'react';
import { useRpc } from '../api-context.js';
import { compareLaneOrder, toLaneUi } from '../components/compare/CompareLaneCard.js';
import { CompareTimeline } from '../components/compare/CompareTimeline.js';
import { ExtractionView } from '../components/extraction/View.js';

export const ViewPage = ({ id }: { id: string }) => {
  const rpc = useRpc();
  const [entry, setEntry] = useState<ExtractionHistoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEntry = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await rpc.api.extract.history.get[':id'].$get({ param: { id } });
    const data = await res.json();
    setLoading(false);

    if (!data.ok) {
      setError('Failed to fetch entry');
      return;
    }
    setEntry(data.entry);
  }, [rpc, id]);

  useEffect(() => {
    void fetchEntry();
  }, [fetchEntry]);

  if (loading) {
    return (
      <section>
        <p data-testid="view-loading">Loading extraction...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <p data-testid="view-error" role="alert">
          {error}
        </p>
        <a href="#/" data-testid="view-back-link">
          Back to Extract
        </a>
      </section>
    );
  }

  if (!entry) {
    return null;
  }

  const compareLanes = entry.compareLanes?.map(toLaneUi) ?? [];

  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a
            href="#/"
            data-testid="view-back-link"
            style={{
              fontSize: 13,
              color: '#4c6ef5',
              textDecoration: 'none',
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #4c6ef5',
            }}
          >
            New Extract
          </a>
        </div>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      </div>

      {compareLanes.length > 0 ? (
        <CompareTimeline
          lanes={compareLanes}
          sourceText={entry.sourceText}
          completed={compareLanes.length}
          total={compareLaneOrder.length}
        />
      ) : (
        <ExtractionView
          extraction={entry.extraction}
          sourceText={entry.sourceText}
          debug={entry.debug}
        />
      )}
    </section>
  );
};
