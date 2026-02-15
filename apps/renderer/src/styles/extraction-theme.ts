import type { EntityType, NoteSentiment } from '@repo/api';

export const cardStyle = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
} as const;

export const cardHoverShadow = '0 4px 16px rgba(0,0,0,0.08)';

export const sectionHeader = {
  fontSize: 14,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  color: '#6b7280',
  marginBottom: 12,
  margin: 0,
};

export const sourceTextContainer = {
  borderRadius: 14,
  background: '#f8f9fb',
  padding: 20,
  fontSize: 19,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap' as const,
  margin: 0,
};

export const itemRow = {
  borderRadius: 12,
  padding: '10px 14px',
  cursor: 'pointer' as const,
  transition: 'all 0.08s ease',
};

export const sentimentColors: Record<NoteSentiment, { bg: string; text: string; border: string }> =
  {
    positive: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
    negative: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
    neutral: { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },
    varied: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  };

export const entityTypeBadges: Record<EntityType, { bg: string; text: string }> = {
  person: { bg: '#e0e7ff', text: '#3730a3' },
  org: { bg: '#ede9fe', text: '#5b21b6' },
  tool: { bg: '#cffafe', text: '#155e75' },
  place: { bg: '#d1fae5', text: '#065f46' },
  concept: { bg: '#fef3c7', text: '#92400e' },
  event: { bg: '#fce7f3', text: '#9d174d' },
};

export const emotionIntensityWidth = (intensity: number): string => {
  const map: Record<number, string> = { 1: '20%', 2: '40%', 3: '60%', 4: '80%', 5: '100%' };
  return map[intensity] ?? '0%';
};

export const transition = {
  fast: '0.08s ease',
  medium: '0.15s ease',
};

export const typography = {
  h1: 24,
  h2: 18,
  body: 14,
  caption: 12,
};
