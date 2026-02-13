export const buildPrompt = (text: string): string => {
  return [
    'You are an extraction engine.',
    'Output must be ONLY valid JSON matching this exact TypeScript shape:',
    '{"title":string,"memory"?:string,"items":[{"label":string,"value":string,"start":number,"end":number,"confidence":number}],"groups":[{"name":string,"itemIndexes":number[]}]}',
    'Rules:',
    '- No prose, no markdown, no comments, JSON only.',
    '- No hallucinations: every item.value must be a literal substring of input text.',
    '- Grounding: value must equal input.slice(start,end).',
    '- Include items for explicit mentions of models, tools, constraints, and configs when present.',
    '- Keep groups generic and reusable across many inputs.',
    '- title must be 25 characters or fewer.',
    '- memory is optional; include it only for durable intent/constraints compression.',
    '- confidence must be in [0,1].',
    '',
    'Input text:',
    '<input>',
    text,
    '</input>',
  ].join('\n');
};
