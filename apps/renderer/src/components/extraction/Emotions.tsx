import type { Extraction } from '@repo/api';
import { cardStyle, emotionIntensityWidth, sectionHeader } from '../../styles/extraction-theme.js';

export const ExtractionEmotions = ({
  extraction,
  compact = false,
}: {
  extraction: Extraction;
  compact?: boolean;
}) => {
  return (
    <div style={{ ...cardStyle, padding: compact ? '10px 12px' : '16px 20px' }}>
      <h3 style={sectionHeader}>Emotions</h3>
      <ul
        data-testid="extraction-v2-emotions"
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: compact ? 4 : 6,
        }}
      >
        {!extraction.emotions || extraction.emotions.length === 0 ? (
          <li>-</li>
        ) : (
          extraction.emotions.map((emotion, index) => (
            <li
              key={`${emotion.emotion}-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: compact ? '4px 0' : '6px 0',
              }}
            >
              <span style={{ minWidth: compact ? 80 : 90, fontSize: compact ? 13 : 14 }}>
                {emotion.emotion}
              </span>
              <div
                style={{
                  flex: 1,
                  height: compact ? 6 : 8,
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
