import type { ExtractionV2 } from '@repo/api';
import { cardStyle, itemRow, sectionHeader } from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';

export const ExtractionGroups = ({
  groups,
  entityById,
  entitySwatchById,
  active,
  setHoverTarget,
  compact = false,
}: {
  groups: ExtractionV2['groups'];
  entityById: Map<string, ExtractionV2['entities'][number]>;
  entitySwatchById: Map<string, EntitySwatch>;
  active: ActiveHighlights;
  setHoverTarget: (target: HoverTarget) => void;
  compact?: boolean;
}) => {
  const getEntityLabel = (entityId: string): string => {
    const entity = entityById.get(entityId);
    if (!entity) {
      return entityId;
    }
    return `${entityId} (${entity.name})`;
  };

  return (
    <div style={{ ...cardStyle, padding: compact ? '10px 12px' : '16px 20px' }}>
      <h3 style={sectionHeader}>Groups</h3>
      <ul
        data-testid="extraction-v2-groups"
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: compact ? 6 : 8,
          ...(compact ? { maxHeight: 240, overflowY: 'auto', paddingRight: 2 } : {}),
        }}
      >
        {groups.length === 0 ? (
          <li style={{ opacity: 0.7 }}>-</li>
        ) : (
          groups.map((group) => {
            const isActive = active.groupNames.has(group.name);
            return (
              <li
                key={group.name}
                data-testid={`group-row-${group.name.replace(/\s+/g, '-')}`}
                data-active={isActive ? 'true' : 'false'}
                onMouseEnter={() => setHoverTarget({ kind: 'group', groupName: group.name })}
                onMouseLeave={() => setHoverTarget(null)}
                style={{
                  ...itemRow,
                  padding: compact ? '8px 10px' : itemRow.padding,
                  border: isActive ? '2px solid #4c6ef5' : '1px solid #d0d7de',
                  background: isActive ? '#edf2ff' : '#fff',
                  fontSize: compact ? 13 : 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <strong>{group.name}</strong>
                  {' | entities='}
                  {group.entityIds.length === 0
                    ? '-'
                    : group.entityIds.map((entityId) => {
                        const swatch = entitySwatchById.get(entityId);
                        return (
                          <span
                            key={entityId}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          >
                            {swatch ? (
                              <span
                                aria-hidden
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  background: swatch.fill,
                                  border: `1px solid ${swatch.accent}`,
                                  display: 'inline-block',
                                }}
                              />
                            ) : null}
                            {getEntityLabel(entityId)}
                          </span>
                        );
                      })}
                  {' | facts='}
                  {group.factIds.length === 0 ? '-' : group.factIds.join(', ')}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};
