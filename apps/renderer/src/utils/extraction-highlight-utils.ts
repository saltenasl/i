import type { Extraction } from '@repo/api';
import type { ActiveHighlights, HoverTarget } from '../types/extraction-ui.js';

const factTouchesEntity = (fact: Extraction['facts'][number], entityId: string): boolean => {
  return (
    fact.ownerEntityId === entityId ||
    fact.subjectEntityId === entityId ||
    fact.objectEntityId === entityId
  );
};

export const computeActiveHighlights = (
  hoverTarget: HoverTarget,
  extraction: Extraction,
): ActiveHighlights => {
  const entityIds = new Set<string>();
  const factIds = new Set<string>();
  const todoIds = new Set<string>();
  const relationIndexes = new Set<number>();
  const groupNames = new Set<string>();
  const segmentIds = new Set<string>();

  const factById = new Map((extraction.facts ?? []).map((fact) => [fact.id, fact]));
  const todoById = new Map((extraction.todos ?? []).map((todo) => [todo.id, todo]));
  const groupByName = new Map((extraction.groups ?? []).map((group) => [group.name, group]));

  const addEntity = (entityId: string | undefined) => {
    if (!entityId) {
      return;
    }
    entityIds.add(entityId);
  };

  const addFact = (fact: Extraction['facts'][number] | undefined) => {
    if (!fact) {
      return;
    }
    factIds.add(fact.id);
    addEntity(fact.ownerEntityId);
    addEntity(fact.subjectEntityId);
    addEntity(fact.objectEntityId);
  };

  const includeGroupsForCurrentSelection = () => {
    for (const group of extraction.groups ?? []) {
      const touchesEntity = group.entityIds.some((id) => entityIds.has(id));
      const touchesFact = group.factIds.some((id) => factIds.has(id));
      if (touchesEntity || touchesFact) {
        groupNames.add(group.name);
      }
    }
  };

  const includeSegmentsForCurrentSelection = () => {
    for (const segment of extraction.segments ?? []) {
      const touchesEntity = segment.entityIds.some((id) => entityIds.has(id));
      const touchesFact = segment.factIds.some((id) => factIds.has(id));
      const touchesRelation = segment.relationIndexes.some((idx) => relationIndexes.has(idx));
      if (touchesEntity || touchesFact || touchesRelation) {
        segmentIds.add(segment.id);
      }
    }
  };

  switch (hoverTarget?.kind) {
    case 'entity': {
      addEntity(hoverTarget.entityId);
      for (const fact of extraction.facts ?? []) {
        if (factTouchesEntity(fact, hoverTarget.entityId)) {
          addFact(fact);
        }
      }
      for (const [relationIndex, relation] of (extraction.relations ?? []).entries()) {
        if (
          relation.fromEntityId === hoverTarget.entityId ||
          relation.toEntityId === hoverTarget.entityId
        ) {
          relationIndexes.add(relationIndex);
          addEntity(relation.fromEntityId);
          addEntity(relation.toEntityId);
        }
      }
      includeGroupsForCurrentSelection();
      includeSegmentsForCurrentSelection();
      break;
    }
    case 'fact': {
      addFact(factById.get(hoverTarget.factId));
      for (const [relationIndex, relation] of (extraction.relations ?? []).entries()) {
        if (entityIds.has(relation.fromEntityId) || entityIds.has(relation.toEntityId)) {
          relationIndexes.add(relationIndex);
          addEntity(relation.fromEntityId);
          addEntity(relation.toEntityId);
        }
      }
      includeGroupsForCurrentSelection();
      includeSegmentsForCurrentSelection();
      break;
    }
    case 'todo': {
      const todo = todoById.get(hoverTarget.todoId);
      if (todo) {
        todoIds.add(todo.id);
        addEntity(todo.assigneeEntityId);
        for (const fact of extraction.facts ?? []) {
          if (todo.assigneeEntityId && factTouchesEntity(fact, todo.assigneeEntityId)) {
            addFact(fact);
          }
        }
        for (const [relationIndex, relation] of (extraction.relations ?? []).entries()) {
          if (
            todo.assigneeEntityId &&
            (relation.fromEntityId === todo.assigneeEntityId ||
              relation.toEntityId === todo.assigneeEntityId)
          ) {
            relationIndexes.add(relationIndex);
            addEntity(relation.fromEntityId);
            addEntity(relation.toEntityId);
          }
        }
        includeGroupsForCurrentSelection();
        includeSegmentsForCurrentSelection();
      }
      break;
    }
    case 'relation': {
      const relation = (extraction.relations ?? [])[hoverTarget.relationIndex];
      if (relation) {
        relationIndexes.add(hoverTarget.relationIndex);
        addEntity(relation.fromEntityId);
        addEntity(relation.toEntityId);
        for (const fact of extraction.facts ?? []) {
          if (
            factTouchesEntity(fact, relation.fromEntityId) ||
            factTouchesEntity(fact, relation.toEntityId)
          ) {
            addFact(fact);
          }
        }
        includeGroupsForCurrentSelection();
        includeSegmentsForCurrentSelection();
      }
      break;
    }
    case 'group': {
      const group = groupByName.get(hoverTarget.groupName);
      if (group) {
        groupNames.add(group.name);
        for (const entityId of group.entityIds) {
          addEntity(entityId);
        }
        for (const factId of group.factIds) {
          addFact(factById.get(factId));
        }
        for (const [relationIndex, relation] of (extraction.relations ?? []).entries()) {
          if (entityIds.has(relation.fromEntityId) || entityIds.has(relation.toEntityId)) {
            relationIndexes.add(relationIndex);
          }
        }
        includeSegmentsForCurrentSelection();
      }
      break;
    }
    case 'segment': {
      const segment = (extraction.segments ?? []).find((s) => s.id === hoverTarget.segmentId);
      if (segment) {
        segmentIds.add(segment.id);
        for (const entityId of segment.entityIds) {
          addEntity(entityId);
        }
        for (const factId of segment.factIds) {
          addFact(factById.get(factId));
        }
        for (const relationIndex of segment.relationIndexes) {
          relationIndexes.add(relationIndex);
          const relation = (extraction.relations ?? [])[relationIndex];
          if (relation) {
            addEntity(relation.fromEntityId);
            addEntity(relation.toEntityId);
          }
        }
        includeGroupsForCurrentSelection();
      }
      break;
    }
    default:
      break;
  }

  return { entityIds, factIds, todoIds, relationIndexes, groupNames, segmentIds };
};
