import type { Extraction } from '@repo/api';
import { cardStyle, sectionHeader, sentimentColors } from '../../styles/extraction-theme.js';

export const ExtractionMetadata = ({
  extraction,
  compact = false,
}: {
  extraction: Extraction;
  compact?: boolean;
}) => {
  const sentColor = sentimentColors[extraction.sentiment] ?? sentimentColors.neutral;
  const clamp3 = {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  };

  if (compact) {
    return (
      <div style={{ ...cardStyle, padding: '10px 12px' }}>
        <h3 style={sectionHeader}>Extraction Metadata</h3>
        <div data-testid="extraction-v2-metadata" style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{extraction.title}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
            <CompactMetaPill label="type" value={extraction.noteType} />
            <CompactMetaPill label="lang" value={extraction.language} />
            <CompactMetaPill label="date" value={extraction.date ?? '-'} />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 6px',
                borderRadius: 999,
                border: `1px solid ${sentColor.border}`,
                background: sentColor.bg,
                color: sentColor.text,
                fontWeight: 600,
              }}
            >
              sentiment
              <span>{extraction.sentiment}</span>
            </span>
          </div>
          <div
            title={extraction.summary}
            style={{ fontSize: 12.5, lineHeight: 1.25, opacity: 0.92, ...clamp3 }}
          >
            {extraction.summary}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, padding: '16px 20px' }}>
      <h3 style={sectionHeader}>Extraction Metadata</h3>
      <ul data-testid="extraction-v2-metadata" style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          <strong>title</strong>: {extraction.title}
        </li>
        <li>
          <strong>noteType</strong>: {extraction.noteType}
        </li>
        <li>
          <strong>summary</strong>: {extraction.summary}
        </li>
        <li>
          <strong>language</strong>: {extraction.language}
        </li>
        <li>
          <strong>date</strong>: {extraction.date ?? '-'}
        </li>
        <li>
          <strong>sentiment</strong>:{' '}
          <span
            style={{
              display: 'inline-block',
              padding: '1px 8px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: sentColor.bg,
              color: sentColor.text,
              border: `1px solid ${sentColor.border}`,
            }}
          >
            {extraction.sentiment}
          </span>
        </li>
      </ul>
    </div>
  );
};

const CompactMetaPill = ({ label, value }: { label: string; value: string }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '1px 6px',
      borderRadius: 999,
      border: '1px solid #d0d7de',
      background: '#fff',
      color: '#475569',
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{ opacity: 0.75 }}>{label}</span>
    <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
  </span>
);
