export const buildPromptV2 = (text: string): string => {
  return [
    'Extract structured note intelligence. Return exactly one JSON object and nothing else.',
    'First output char must be { and last output char must be }.',
    'No markdown, no explanations, no code fences.',
    'Schema:',
    '{"title":string,"noteType":string,"summary":string,"language":string,"date":string|null,"sentiment":"positive"|"negative"|"neutral"|"mixed","emotions":[{"emotion":string,"intensity":1|2|3|4|5}],"entities":[{"id":string,"name":string,"type":"person"|"org"|"tool"|"place"|"concept"|"event","nameStart":number,"nameEnd":number,"evidenceStart"?:number,"evidenceEnd"?:number,"context"?:string,"confidence":number}],"facts":[{"id":string,"subjectEntityId"?:string,"predicate":string,"objectEntityId"?:string,"objectText"?:string,"evidenceStart":number,"evidenceEnd":number,"confidence":number}],"relations":[{"fromEntityId":string,"toEntityId":string,"type":string,"evidenceStart"?:number,"evidenceEnd"?:number,"confidence":number}],"groups":[{"name":string,"entityIds":string[],"factIds":string[]}]}',
    'Rules:',
    '- Grounding is strict: all spans must map to exact substrings in input.',
    '- Use minimal canonical entity names (example: "Egle", not "Egle was driving").',
    '- Put phrase-level role/context in evidenceStart/evidenceEnd and optional context.',
    '- Keep IDs short and stable within this response (e.g. ent_1, fact_1).',
    '- Facts/relations should reference entity IDs when possible.',
    '- Use concise values.',
    '- title must be <= 25 characters.',
    '',
    'Input:',
    text,
  ].join('\n');
};
