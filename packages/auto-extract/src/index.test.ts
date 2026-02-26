import { describe, expect, it } from 'vitest';
import { postProcessExtractionV2 } from './index.js';
import type { Extraction } from './types.js';
import { normalizeGroupsV2, validateExtractionV2 } from './validate.js';

const V2_TEXT =
  'I called road maintenance. Egle was driving in Klaipeda and she was scared. Maybe when I was a kid the seaside had white dunes.';

const createValidExtractionV2 = (): Extraction => {
  const iStart = V2_TEXT.indexOf('I');
  const egleStart = V2_TEXT.indexOf('Egle');
  const drivingStart = V2_TEXT.indexOf('Egle was driving');
  const klaipedaStart = V2_TEXT.indexOf('Klaipeda');
  const scaredStart = V2_TEXT.indexOf('she was scared');
  const memoryStart = V2_TEXT.indexOf('when I was a kid');
  const memoryEnd = V2_TEXT.indexOf('white dunes') + 'white dunes'.length;

  if (
    iStart < 0 ||
    egleStart < 0 ||
    drivingStart < 0 ||
    klaipedaStart < 0 ||
    scaredStart < 0 ||
    memoryStart < 0 ||
    memoryEnd < 0
  ) {
    throw new Error('Expected V2 fixture spans to exist in source text.');
  }

  return {
    title: 'Winter drive note',
    noteType: 'personal',
    summary: 'I called maintenance while Egle drove and felt scared.',
    language: 'en',
    date: null,
    sentiment: 'varied',
    emotions: [{ emotion: 'fear', intensity: 4 }],
    entities: [
      {
        id: 'ent-self',
        name: 'I',
        type: 'person',
        nameStart: iStart,
        nameEnd: iStart + 1,
        confidence: 0.9,
      },
      {
        id: 'ent-egle',
        name: 'Egle',
        type: 'person',
        nameStart: egleStart,
        nameEnd: egleStart + 'Egle'.length,
        evidenceStart: drivingStart,
        evidenceEnd: drivingStart + 'Egle was driving'.length,
        confidence: 0.9,
      },
      {
        id: 'ent-klaipeda',
        name: 'Klaipeda',
        type: 'place',
        nameStart: klaipedaStart,
        nameEnd: klaipedaStart + 'Klaipeda'.length,
        confidence: 0.9,
      },
    ],
    facts: [
      {
        id: 'fact-call',
        ownerEntityId: 'ent-self',
        perspective: 'self',
        subjectEntityId: 'ent-self',
        predicate: 'called_road_maintenance',
        evidenceStart: 0,
        evidenceEnd: 24,
        confidence: 0.85,
      },
      {
        id: 'fact-scared',
        ownerEntityId: 'ent-egle',
        perspective: 'other',
        subjectEntityId: 'ent-egle',
        predicate: 'felt_scared',
        evidenceStart: scaredStart,
        evidenceEnd: scaredStart + 'she was scared'.length,
        confidence: 0.82,
      },
      {
        id: 'fact-memory',
        ownerEntityId: 'ent-self',
        perspective: 'self',
        predicate: 'childhood_memory',
        objectText: V2_TEXT.slice(memoryStart, memoryEnd),
        evidenceStart: memoryStart,
        evidenceEnd: memoryEnd,
        confidence: 0.75,
      },
    ],
    relations: [
      {
        fromEntityId: 'ent-egle',
        toEntityId: 'ent-klaipeda',
        type: 'drove_to',
        evidenceStart: drivingStart,
        evidenceEnd: drivingStart + 'Egle was driving'.length,
        confidence: 0.82,
      },
    ],
    todos: [],
    groups: [
      {
        name: 'people',
        entityIds: ['ent-self', 'ent-egle'],
        factIds: ['fact-call', 'fact-scared'],
      },
      {
        name: 'memories',
        entityIds: ['ent-self'],
        factIds: ['fact-memory'],
      },
    ],
    segments: [
      {
        id: 'seg_1',
        start: 0,
        end: 24,
        sentiment: 'neutral',
        summary: 'I called road maintenance.',
        entityIds: ['ent-self'],
        factIds: ['fact-call'],
        relationIndexes: [],
      },
      {
        id: 'seg_2',
        start: drivingStart,
        end: memoryEnd,
        sentiment: 'negative',
        summary: 'Egle drove and felt scared while snow memories surfaced.',
        entityIds: ['ent-egle', 'ent-klaipeda', 'ent-self'],
        factIds: ['fact-scared', 'fact-memory'],
        relationIndexes: [0],
      },
    ],
  };
};

const createRawExtractionV2 = () => {
  const valid = createValidExtractionV2();

  const rawEntities = valid.entities.map((e) => ({
    ...e,
    evidenceText:
      e.evidenceStart !== undefined ? V2_TEXT.slice(e.evidenceStart, e.evidenceEnd) : undefined,
  }));

  const rawFacts = valid.facts.map((f) => ({
    ...f,
    evidenceText: V2_TEXT.slice(f.evidenceStart, f.evidenceEnd),
  }));

  const rawRelations = valid.relations.map((r) => ({
    ...r,
    evidenceText:
      r.evidenceStart !== undefined && r.evidenceEnd !== undefined
        ? V2_TEXT.slice(r.evidenceStart, r.evidenceEnd)
        : undefined,
  }));

  return {
    ...valid,
    entities: rawEntities,
    facts: rawFacts,
    relations: rawRelations,
  };
};

describe('validateExtractionV2', () => {
  it('keeps ownership and perspective fields', () => {
    const extraction = validateExtractionV2(V2_TEXT, createRawExtractionV2());
    const scared = extraction.facts.find((fact) => fact.id === 'fact-scared');
    expect(scared?.ownerEntityId).toBe('ent-egle');
    expect(scared?.perspective).toBe('other');
  });

  it('supports notetaker self-owned facts', () => {
    const extraction = validateExtractionV2(V2_TEXT, createRawExtractionV2());
    const call = extraction.facts.find((fact) => fact.id === 'fact-call');
    expect(call?.ownerEntityId).toBe('ent-self');
    expect(call?.perspective).toBe('self');
  });

  it('normalizes sentiment and groups', () => {
    const extraction = createRawExtractionV2();
    extraction.sentiment = 'varied';
    extraction.groups = [
      { name: 'driving events', entityIds: ['ent-egle'], factIds: ['fact-scared'] },
    ];
    const result = validateExtractionV2(V2_TEXT, extraction);
    expect(result.sentiment).toBe('varied');
    expect(normalizeGroupsV2(result).some((group) => group.name === 'actions')).toBe(true);
  });

  it('drops malformed relations while keeping extraction valid', () => {
    const extraction = createRawExtractionV2();
    extraction.relations.push({
      fromEntityId: 'missing',
      toEntityId: 'ent-klaipeda',
      type: 'invalid',
      evidenceText: undefined,
      confidence: 0.5,
    });

    const result = validateExtractionV2(V2_TEXT, extraction);
    expect(result.relations).toHaveLength(1);
    expect(result.segments).toHaveLength(2);
  });
});

describe('postProcessExtractionV2', () => {
  it('prefers singular notetaker anchor and resolves unresolved self ownership', () => {
    const text = 'we were driving and there was ice. I called support. Egle was driving.';
    const weStart = text.indexOf('we');
    const iStart = text.indexOf('I called');
    const egleStart = text.indexOf('Egle');
    const weDrivingStart = text.indexOf('we were driving');
    const callStart = text.indexOf('I called support');
    const egleDrivingStart = text.indexOf('Egle was driving');

    if (
      weStart < 0 ||
      iStart < 0 ||
      egleStart < 0 ||
      weDrivingStart < 0 ||
      callStart < 0 ||
      egleDrivingStart < 0
    ) {
      throw new Error('Expected notetaker/driver fixtures to exist in source text.');
    }

    const raw: Extraction = {
      title: 'Drive note',
      noteType: 'personal',
      summary: 'We drove and I called support while Egle drove.',
      language: 'en',
      date: null,
      sentiment: 'neutral',
      emotions: [],
      entities: [
        {
          id: 'ent_we',
          name: 'we',
          type: 'person',
          nameStart: weStart,
          nameEnd: weStart + 2,
          context: 'notetaker',
          confidence: 0.8,
        },
        {
          id: 'ent_egle',
          name: 'Egle',
          type: 'person',
          nameStart: egleStart,
          nameEnd: egleStart + 4,
          confidence: 0.9,
        },
      ],
      facts: [
        {
          id: 'fact-self-driving',
          ownerEntityId: 'ent_we',
          perspective: 'self',
          predicate: 'was driving',
          evidenceStart: weDrivingStart,
          evidenceEnd: weDrivingStart + 'we were driving'.length,
          confidence: 0.8,
        },
        {
          id: 'fact-call',
          ownerEntityId: 'unresolved_owner_2',
          perspective: 'self',
          predicate: 'called support',
          evidenceStart: callStart,
          evidenceEnd: callStart + 'I called support'.length,
          confidence: 0.8,
        },
        {
          id: 'fact-egle-driving',
          ownerEntityId: 'ent_egle',
          perspective: 'other',
          predicate: 'was driving',
          evidenceStart: egleDrivingStart,
          evidenceEnd: egleDrivingStart + 'Egle was driving'.length,
          confidence: 0.85,
        },
      ],
      relations: [],
      todos: [],
      groups: [
        {
          name: 'people',
          entityIds: ['ent_we', 'ent_egle'],
          factIds: ['fact-self-driving', 'fact-call', 'fact-egle-driving'],
        },
      ],
      segments: [],
    };

    const result = postProcessExtractionV2(raw, text);
    const notetaker = result.entities.find((entity) => entity.id === 'ent_self');
    const callFact = result.facts.find((fact) => fact.id === 'fact-call');
    const selfDrivingFact = result.facts.find((fact) => fact.id === 'fact-self-driving');

    expect(notetaker?.name).toBe('I');
    expect(notetaker?.context).toContain('notetaker');
    expect(callFact?.ownerEntityId).toBe('ent_self');
    expect(selfDrivingFact?.ownerEntityId).toBe('ent_self');
  });

  it('replaces narrator wording with notetaker wording', () => {
    const text = 'I wrote this note.';
    const iStart = text.indexOf('I');
    if (iStart < 0) {
      throw new Error('Expected notetaker fixture to exist in source text.');
    }

    const raw: Extraction = {
      title: 'Note',
      noteType: 'personal',
      summary: 'Narrator noted this.',
      language: 'en',
      date: null,
      sentiment: 'neutral',
      emotions: [],
      entities: [
        {
          id: 'ent_self',
          name: 'narrator',
          type: 'person',
          nameStart: iStart,
          nameEnd: iStart + 1,
          context: 'Narrator',
          confidence: 0.9,
        },
      ],
      facts: [
        {
          id: 'fact_1',
          ownerEntityId: 'ent_self',
          perspective: 'self',
          predicate: 'narrator wrote',
          evidenceStart: iStart,
          evidenceEnd: iStart + 1,
          confidence: 0.8,
        },
      ],
      relations: [],
      todos: [],
      groups: [{ name: 'people', entityIds: ['ent_self'], factIds: ['fact_1'] }],
      segments: [],
    };

    const result = postProcessExtractionV2(raw, text);
    const notetaker = result.entities.find((entity) => entity.id === 'ent_self');
    const fact = result.facts[0];

    expect(result.summary.toLowerCase()).not.toContain('narrator');
    expect(result.summary.toLowerCase()).toContain('notetaker');
    expect(notetaker?.name).toBe('I');
    expect(notetaker?.context?.toLowerCase()).toContain('notetaker');
    expect(fact?.predicate.toLowerCase()).toContain('notetaker');
  });
});
