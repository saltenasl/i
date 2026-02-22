import type { ExtractionV2 } from '@repo/api';
import { cardStyle, sectionHeader, sentimentColors } from '../../styles/extraction-theme.js';

export const ExtractionMetadata = ({
  extractionV2,
  compact = false,
}: {
  extractionV2: ExtractionV2;
  compact?: boolean;
}) => {
  const sentColor = sentimentColors[extractionV2.sentiment];
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
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{extractionV2.title}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
            <CompactMetaPill label="type" value={extractionV2.noteType} />
            <CompactMetaPill label="lang" value={extractionV2.language} />
            <CompactMetaPill label="date" value={extractionV2.date ?? '-'} />
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
              <span>{extractionV2.sentiment}</span>
            </span>
          </div>
          <div
            title={extractionV2.summary}
            style={{ fontSize: 12.5, lineHeight: 1.25, opacity: 0.92, ...clamp3 }}
          >
            {extractionV2.summary}
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
          <strong>title</strong>: {extractionV2.title}
        </li>
        <li>
          <strong>noteType</strong>: {extractionV2.noteType}
        </li>
        <li>
          <strong>summary</strong>: {extractionV2.summary}
        </li>
        <li>
          <strong>language</strong>: {extractionV2.language}
        </li>
        <li>
          <strong>date</strong>: {extractionV2.date ?? '-'}
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
            {extractionV2.sentiment}
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
