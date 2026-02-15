export const getExcerpt = (text: string, start: number, end: number): string => {
  const left = Math.max(0, start - 40);
  const right = Math.min(text.length, end + 40);
  return text.slice(left, right).replace(/\s+/g, ' ').trim();
};

export const formatSpan = (start: number, end: number): string => {
  return `${start}-${end}`;
};

export const formatOptionalSpan = (start: number | undefined, end: number | undefined): string => {
  if (start === undefined || end === undefined) {
    return '-';
  }
  return `${start}-${end}`;
};
