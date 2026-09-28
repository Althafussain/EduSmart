export type ParsedExamQuestion = {
  prompt: string;
  options: string[];
  correctAnswer: string | null;
};

/** Split pasted, numbered MCQ text into the same structure used by exam uploads. */
export function parsePastedExamQuestions(source: string): ParsedExamQuestion[] {
  const text = source.replace(/\r/g, "").trim();
  if (!text) return [];

  const answerKeyStart = text.search(/(?:^|\n)\s*(?:answer\s+key|correct\s+answers?|answers?)\s*:?[ \t]*(?=\n|$)/i);
  const questionText = answerKeyStart < 0 ? text : text.slice(0, answerKeyStart);
  const answerKeyText = answerKeyStart < 0 ? "" : text.slice(answerKeyStart);
  const answerKey = new Map<number, string>();
  for (const match of answerKeyText.matchAll(/(?:^|\s)(\d{1,3})\s*[.):\-]?\s*([A-D])\b/gi)) {
    answerKey.set(Number(match[1]), match[2].toUpperCase());
  }

  const lineStarts = [...questionText.matchAll(/(?:^|\n)\s*(?:(?:question|q)\.?\s*)?[\[(]?(\d{1,3})[\])]?(?:\s*[.):\-]+\s*|\s+(?=\S))/gim)];
  const inlineStarts = [...questionText.matchAll(/(?:^|\s)(?:(?:question|q)\.?\s*)?[\[(]?(\d{1,3})[\])]?(?:\s*[.):\-]+\s*|\s+(?=\S))/gi)];
  const starts = lineStarts.length >= 2 ? lineStarts : inlineStarts;
  if (starts.length === 0) return [];

  const parsed: ParsedExamQuestion[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const startMatch = starts[index];
    const blockStart = (startMatch.index ?? 0) + startMatch[0].length;
    const blockEnd = index + 1 < starts.length ? starts[index + 1].index ?? questionText.length : questionText.length;
    const block = questionText.slice(blockStart, blockEnd).replace(/[ \t]+/g, " ").trim();
    const localAnswer = block.match(/(?:correct\s+answer|answer|ans)\s*[:\-]?\s*([A-D])\b/i)?.[1]?.toUpperCase() ?? null;
    const withoutAnswer = block.replace(/\s*(?:correct\s+answer|answer|ans)\s*[:\-]?\s*[A-D]\b[\s\S]*$/i, "").trim();
    const optionMatches = [...withoutAnswer.matchAll(/(?:^|\s)(?:\(([A-D])\)|([A-D])\s*[).:\-])\s*/gi)];
    const firstOptionAt = optionMatches[0]?.index ?? withoutAnswer.length;
    const prompt = withoutAnswer.slice(0, firstOptionAt).trim();
    const options = optionMatches.map((option, optionIndex) => {
      const optionStart = (option.index ?? 0) + option[0].length;
      const optionEnd = optionIndex + 1 < optionMatches.length ? optionMatches[optionIndex + 1].index ?? withoutAnswer.length : withoutAnswer.length;
      return withoutAnswer.slice(optionStart, optionEnd).trim();
    }).filter(Boolean);

    if (!prompt) continue;
    parsed.push({ prompt, options, correctAnswer: localAnswer ?? answerKey.get(Number(startMatch[1])) ?? null });
  }

  return parsed;
}
