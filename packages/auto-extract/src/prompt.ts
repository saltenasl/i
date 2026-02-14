export const buildPrompt = (text: string): string => {
  return [
    'Extraction engine. Return one minified JSON object only.',
    'First char must be { and last char must be }.',
    'No prefix/suffix text, no markdown, no code fences.',
    'Schema:',
    '{"title":string,"memory"?:string,"items":[{"label":string,"value":string,"start":number,"end":number,"confidence":number}],"groups":[{"name":string,"itemIndexes":number[]}]}',
    'Rules: no hallucinations; each value is exact substring; start/end exact; confidence 0..1; title <=25 chars.',
    'Keep output compact: max 3 items, max 2 groups.',
    'Include explicit models/tools/constraints/config mentions when present.',
    '',
    'Input:',
    text,
  ].join('\n');
};
