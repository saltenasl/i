export const buildSystemPromptV2 = (): string => {
  return [
    'Extract structured note intelligence from the full note. Return exactly one JSON object and nothing else.',
    'First output char must be { and last output char must be }.',
    'No markdown, no explanations, no code fences.',
    'Schema:',
    '{"title":string,"noteType":string,"summary":string,"language":string,"date":string|null,"sentiment":"positive"|"negative"|"neutral"|"varied","emotions":[{"emotion":string,"intensity":1|2|3|4|5}],"entities":[{"id":string,"name":string,"type":"person"|"org"|"tool"|"place"|"concept"|"event","nameStart":number,"nameEnd":number,"evidenceStart"?:number,"evidenceEnd"?:number,"context"?:string,"confidence":number}],"facts":[{"id":string,"ownerEntityId":string,"perspective":"self"|"other"|"uncertain","subjectEntityId"?:string,"predicate":string,"objectEntityId"?:string,"objectText"?:string,"evidenceStart":number,"evidenceEnd":number,"confidence":number}],"relations":[{"fromEntityId":string,"toEntityId":string,"type":string,"evidenceStart"?:number,"evidenceEnd"?:number,"confidence":number}],"todos":[{"id":string,"description":string,"assigneeEntityId"?:string,"evidenceStart":number,"evidenceEnd":number,"confidence":number}],"groups":[{"name":string,"entityIds":string[],"factIds":string[]}]}',
    'Rules:',
    '- Grounding is strict: all spans must map to exact substrings in input.',
    '- Use minimal canonical entity names (example: "Egle", not "Egle was driving").',
    '- Put phrase-level role/context in evidenceStart/evidenceEnd and optional context.',
    '- Keep IDs short and stable within this response (e.g. ent_1, fact_1, todo_1).',
    '- If first-person pronouns appear, create a notetaker entity with id "ent_self" and name "I".',
    '- Facts/relations/todos should reference entity IDs when possible.',
    '- Every fact must include ownerEntityId and perspective.',
    '- Use concise natural-language predicates (example: "called road maintenance"), not snake_case tokens.',
    '- If first-person pronouns appear (I/me/my/we/us/our), include notetaker as a person entity and treat first-person facts as perspective=self.',
    '- "we" includes the notetaker; do not map "we" facts to only another person.',
    '- If another person is explicitly stated as role holder (e.g., "Egle was driving"), do not also assign that role to notetaker from a collective "we" phrase unless "I was ..." is explicit.',
    '- Use minimal evidence spans; avoid evidence that bundles multiple subjects in one fact.',
    '- Separate action items, tasks, and future intents into the "todos" array (e.g., need to, should, must, todo, remember to). Do not put actionable commands into the "facts" array. Assignee entity ID is optional but preferred if the task belongs to someone specific.',
    "- Do not assign another person's emotional state to notetaker unless explicitly stated. Clearly isolate who is feeling what.",
    '- Do not use the word "narrator" in summary, predicates, contexts, or entity names; use "I" or "notetaker" when needed.',
    '- Actions/emotions should be represented in fact/todo evidence spans, not inside entity names.',
    '- Summary must synthesize, not restate line-by-line; keep it to 1-2 concise sentences.',
    '- Use concise values.',
    '- title must be <= 25 characters.',
  ].join('\n');
};

export const buildUserPromptV2 = (text: string): string => {
  return ['Input:', text].join('\n');
};

export const buildPromptV2 = (text: string): string => {
  return [buildSystemPromptV2(), '', buildUserPromptV2(text)].join('\n');
};
