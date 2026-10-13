export function normalizeOptionAnswer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const answer = value.trim().toUpperCase();
  if (/^[A-E]$/.test(answer)) return answer;
  if (/^[1-5]$/.test(answer)) return String.fromCharCode(64 + Number(answer));
  const romanOptions: Record<string, string> = { I: "A", II: "B", III: "C", IV: "D", V: "E" };
  if (romanOptions[answer]) return romanOptions[answer];
  return null;
}

export function optionAnswerIndex(value: unknown): number {
  const answer = normalizeOptionAnswer(value);
  return answer ? answer.charCodeAt(0) - 65 : -1;
}

/** Resolve an answer label or exact option text to the option's displayed position. */
export function resolveOptionAnswer(value: unknown, options: string[]): string | null {
  const label = normalizeOptionAnswer(value);
  if (label) {
    const index = optionAnswerIndex(label);
    return index < options.length ? label : null;
  }

  if (typeof value !== "string") return null;
  const answerText = value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  if (!answerText) return null;
  const matchingIndexes = options
    .map((option, index) => option.trim().replace(/\s+/g, " ").toLocaleLowerCase() === answerText ? index : -1)
    .filter((index) => index >= 0);
  return matchingIndexes.length === 1 && matchingIndexes[0] < 5
    ? String.fromCharCode(65 + matchingIndexes[0])
    : null;
}

export function isValidOptionAnswer(value: unknown, options: string[]): boolean {
  return resolveOptionAnswer(value, options) !== null;
}
