import type { ExtractionHistoryEntryDto } from '@repo/api';
import { CompareLaneCard, compareLaneOrder, toLaneUi } from '../compare/CompareLaneCard.js';

export const ExtractionHistoryList = ({
  historyEntries,
  selectedHistoryIds,
  onToggleSelection,
  onOpenEntry,
}: {
  historyEntries: ExtractionHistoryEntryDto[];
  selectedHistoryIds: Set<string>;
  onToggleSelection: (entryId: string) => void;
  onOpenEntry: (entry: ExtractionHistoryEntryDto) => void;
}) => {
  return (
    <section data-testid="extraction-history" style={{ marginTop: 20, display: 'grid', gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Extraction History</h2>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
        Select one or more entries to enable bulk debug-copy.
      </p>
      {historyEntries.length === 0 ? (
        <p data-testid="extraction-history-empty" style={{ margin: 0, opacity: 0.75 }}>
          No extraction history yet.
        </p>
      ) : (
        <ul
          data-testid="extraction-history-list"
          style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10 }}
        >
          {historyEntries.map((entry) => {
            const selected = selectedHistoryIds.has(entry.id);
            return (
              <li
                key={entry.id}
                data-testid={`history-item-${entry.id}`}
                style={{
                  position: 'relative',
                  border: selected ? '1px solid #f08c00' : '1px solid #d0d7de',
                  borderRadius: 10,
                  padding: '10px 54px 10px 14px',
                  background: selected ? '#fff9db' : '#fff',
                }}
              >
                <label
                  data-testid={`history-checkbox-floating-${entry.id}`}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1px solid #cfd8e3',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                  }}
                  title="Select debug bundle"
                >
                  <input
                    data-testid={`history-checkbox-${entry.id}`}
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelection(entry.id)}
                  />
                </label>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    data-testid={`history-open-${entry.id}`}
                    onClick={() => onOpenEntry(entry)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'block',
                      flex: 1,
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontWeight: 700 }}>{entry.extraction.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>{entry.extraction.summary}</div>
                    <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                      Prompt: {entry.prompt.slice(0, 120)}
                      {entry.prompt.length > 120 ? '...' : ''}
                    </div>
                  </button>
                  <a
                    href={`#/view/${entry.id}`}
                    data-testid={`history-view-link-${entry.id}`}
                    style={{
                      fontSize: 12,
                      color: '#4c6ef5',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    View
                  </a>
                </div>

                {entry.compareLanes && entry.compareLanes.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <div
                      data-testid={`history-compare-results-${entry.id}`}
                      style={{ display: 'grid', gap: 8 }}
                    >
                      <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                        {entry.compareLanes.length}/{compareLaneOrder.length} complete
                      </p>
                      <div
                        data-testid={`history-compare-lanes-${entry.id}`}
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
                          const lane = entry.compareLanes?.find((item) => item.laneId === laneId);
                          if (!lane) {
                            return null;
                          }
                          return (
                            <CompareLaneCard
                              key={`${entry.id}-${laneId}`}
                              lane={toLaneUi(lane)}
                              sourceText={entry.sourceText}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export const HistoryCopyFloating = ({
  selectedCount,
  onCopy,
  copyState,
}: {
  selectedCount: number;
  onCopy: () => void;
  copyState: 'idle' | 'copied' | 'error';
}) => {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      data-testid="history-copy-selected-floating"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 40,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        background: '#111827',
        color: '#fff',
        borderRadius: 999,
        padding: '10px 14px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
      }}
    >
      <button
        type="button"
        data-testid="history-copy-selected-button"
        onClick={onCopy}
        style={{
          border: '1px solid #4b5563',
          background: '#1f2937',
          color: '#fff',
          borderRadius: 999,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        Copy {selectedCount} debug log{selectedCount === 1 ? '' : 's'}
      </button>
      <span data-testid="history-copy-selected-state" style={{ fontSize: 12, opacity: 0.9 }}>
        {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : ''}
      </span>
    </div>
  );
};
