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

  return (
    <div style={{ ...cardStyle, padding: compact ? '10px 12px' : '16px 20px' }}>
      <h3 style={sectionHeader}>Extraction Metadata</h3>
      <ul
        data-testid="extraction-v2-metadata"
        style={{ margin: 0, paddingLeft: 18, fontSize: compact ? 13 : 14, lineHeight: 1.25 }}
      >
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
