import type { ExtractionV2 } from '@repo/api';
import { cardStyle, emotionIntensityWidth, sectionHeader } from '../../styles/extraction-theme.js';

export const ExtractionEmotions = ({
  extractionV2,
}: {
  extractionV2: ExtractionV2;
}) => {
  return (
    <div style={{ ...cardStyle, padding: '16px 20px' }}>
      <h3 style={sectionHeader}>Emotions</h3>
      <ul
        data-testid="extraction-v2-emotions"
        style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6 }}
      >
        {extractionV2.emotions.length === 0 ? (
          <li>-</li>
        ) : (
          extractionV2.emotions.map((emotion, index) => (
            <li
              key={`${emotion.emotion}-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
              }}
            >
              <span style={{ minWidth: 90, fontSize: 14 }}>{emotion.emotion}</span>
              <div
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: '#e5e7eb',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: emotionIntensityWidth(emotion.intensity),
                    height: '100%',
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, #818cf8, #6366f1)',
                    transition: 'width 0.15s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: 12, opacity: 0.7, minWidth: 20 }}>{emotion.intensity}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};
