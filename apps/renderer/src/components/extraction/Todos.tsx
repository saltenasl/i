import type { Extraction } from '@repo/api';
import { cardStyle, itemRow, sectionHeader } from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';
import { getEntitySwatch } from '../../utils/extraction-color-utils.js';
import { formatSpan, getExcerpt } from '../../utils/extraction-format-utils.js';

const clampLines = (lines: number) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
});

export const ExtractionTodos = ({
  todos,
  sourceText,
  entityById,
  entitySwatchById,
  active,
  setHoverTarget,
  compact = false,
}: {
  todos: Extraction['todos'];
  sourceText: string;
  entityById: Map<string, Extraction['entities'][number]>;
  entitySwatchById: Map<string, EntitySwatch>;
  active: ActiveHighlights;
  setHoverTarget: (target: HoverTarget) => void;
  compact?: boolean;
}) => {
  if (!todos || todos.length === 0) {
    return null;
  }

  const getEntityLabel = (entityId: string | undefined): string => {
    if (!entityId) {
      return '-';
    }
    const entity = entityById.get(entityId);
    if (!entity) {
      return entityId;
    }
    return `${entityId} (${entity.name})`;
  };

  return (
    <div style={{ ...cardStyle, padding: compact ? '10px 12px' : '16px 20px' }}>
      <h3 style={sectionHeader}>Action Items (TODO)</h3>
      <ul
        data-testid="extraction-v2-todos"
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: compact ? 6 : 8,
        }}
      >
        {todos.map((todo) => {
          // If no assignee, fallback to a default color or self
          const ownerSwatch = todo.assigneeEntityId
            ? getEntitySwatch(todo.assigneeEntityId, entitySwatchById)
            : { accent: '#aaa', fill: '#eee' };

          const isActive = active.todoIds.has(todo.id);
          const showExpanded = !compact || isActive;

          return (
            <li
              key={todo.id}
              data-testid={`todo-row-${todo.id}`}
              data-active={isActive ? 'true' : 'false'}
              onMouseEnter={() => setHoverTarget({ kind: 'todo', todoId: todo.id })}
              onMouseLeave={() => setHoverTarget(null)}
              style={{
                ...itemRow,
                padding: compact ? '8px 10px' : itemRow.padding,
                borderLeft: `5px solid ${ownerSwatch.accent}`,
                background: isActive ? '#f8f2e7' : '#f7f7f8',
                outline: isActive ? `2px solid ${ownerSwatch.accent}` : 'none',
                fontSize: compact ? 13 : 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  ...(!showExpanded && clampLines(2)),
                }}
              >
                <input type="checkbox" disabled style={{ marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div>
                    <strong>{todo.description}</strong>
                    {todo.assigneeEntityId && (
                      <span style={{ marginLeft: 6, fontSize: '0.9em', color: '#555' }}>
                        (Assignee: <strong>{getEntityLabel(todo.assigneeEntityId)}</strong>)
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      opacity: 0.78,
                      fontSize: '0.85em',
                      ...(showExpanded ? {} : clampLines(1)),
                    }}
                  >
                    {showExpanded ? (
                      <>
                        id={todo.id} confidence={todo.confidence.toFixed(2)} | [
                        {formatSpan(todo.evidenceStart, todo.evidenceEnd)}]
                      </>
                    ) : (
                      <>confidence={todo.confidence.toFixed(2)}</>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      opacity: 0.85,
                      fontSize: '0.9em',
                      ...(showExpanded ? {} : clampLines(1)),
                    }}
                  >
                    {getExcerpt(sourceText, todo.evidenceStart, todo.evidenceEnd)}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
