import type { ExtractionV2 } from '@repo/api';
import {
  cardStyle,
  itemRow,
  sectionHeader,
  sentimentColors,
} from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';

export const ExtractionSegments = ({
  segments,
  sourceTextLength,
  entityById,
  entitySwatchById,
  active,
  setHoverTarget,
  compact = false,
}: {
  segments: ExtractionV2['segments'];
  sourceTextLength: number;
  entityById: Map<string, ExtractionV2['entities'][number]>;
  entitySwatchById: Map<string, EntitySwatch>;
  active: ActiveHighlights;
  setHoverTarget: (target: HoverTarget) => void;
  compact?: boolean;
}) => {
  if (segments.length === 0) {
    return null;
  }

  return (
    <div style={{ ...cardStyle, padding: compact ? '10px 12px' : '16px 20px' }}>
      <h3 style={sectionHeader}>Segments</h3>

      <div
        data-testid="segment-timeline"
        style={{
          display: 'flex',
          height: compact ? 18 : 24,
          borderRadius: 6,
          overflow: 'hidden',
          background: '#e5e7eb',
          marginBottom: compact ? 10 : 14,
        }}
      >
        {segments.map((segment) => {
          const widthPct =
            sourceTextLength > 0 ? ((segment.end - segment.start) / sourceTextLength) * 100 : 0;
          const leftPct = sourceTextLength > 0 ? (segment.start / sourceTextLength) * 100 : 0;
          const sentColor = sentimentColors[segment.sentiment];
          const isActive = active.segmentIds.has(segment.id);
          return (
            <div
              key={segment.id}
              data-testid={`segment-timeline-bar-${segment.id}`}
              onMouseEnter={() => setHoverTarget({ kind: 'segment', segmentId: segment.id })}
              onMouseLeave={() => setHoverTarget(null)}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                height: '100%',
                background: sentColor.border,
                opacity: isActive ? 1 : 0.6,
                cursor: 'pointer',
                transition: 'opacity 0.08s ease',
              }}
              title={`${segment.id}: ${segment.summary}`}
            />
          );
        })}
      </div>

      <ul
        data-testid="extraction-v2-segments"
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: compact ? 6 : 8,
          ...(compact ? { maxHeight: 260, overflowY: 'auto', paddingRight: 2 } : {}),
        }}
      >
        {segments.map((segment) => {
          const isActive = active.segmentIds.has(segment.id);
          const sentColor = sentimentColors[segment.sentiment];
          return (
            <li
              key={segment.id}
              data-testid={`segment-row-${segment.id}`}
              data-active={isActive ? 'true' : 'false'}
              onMouseEnter={() => setHoverTarget({ kind: 'segment', segmentId: segment.id })}
              onMouseLeave={() => setHoverTarget(null)}
              style={{
                ...itemRow,
                padding: compact ? '8px 10px' : itemRow.padding,
                border: isActive ? `2px solid ${sentColor.border}` : '1px solid #d0d7de',
                background: isActive ? sentColor.bg : '#fff',
                fontSize: compact ? 13 : 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong>{segment.id}</strong>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0 6px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: sentColor.bg,
                    color: sentColor.text,
                    border: `1px solid ${sentColor.border}`,
                  }}
                >
                  {segment.sentiment}
                </span>
                <span style={{ opacity: 0.7, fontSize: 12 }}>
                  chars {segment.start}-{segment.end}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 13 }}>{segment.summary}</div>
              <div
                style={{
                  marginTop: 4,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  fontSize: 12,
                  opacity: 0.8,
                }}
              >
                <span>
                  entities:{' '}
                  {segment.entityIds.length === 0
                    ? '-'
                    : segment.entityIds.map((id) => {
                        const entity = entityById.get(id);
                        const swatch = entitySwatchById.get(id);
                        return (
                          <span
                            key={id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              marginRight: 4,
                            }}
                          >
                            {swatch ? (
                              <span
                                aria-hidden
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: swatch.fill,
                                  border: `1px solid ${swatch.accent}`,
                                  display: 'inline-block',
                                }}
                              />
                            ) : null}
                            {entity?.name ?? id}
                          </span>
                        );
                      })}
                </span>
                <span>facts: {segment.factIds.length}</span>
                <span>relations: {segment.relationIndexes.length}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
