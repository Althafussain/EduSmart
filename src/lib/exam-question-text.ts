export type ParsedExamQuestion = {
  prompt: string;
  options: string[];
  correctAnswer: string | null;
};

function optionRank(value: string) {
  const label = value.trim().replace(/[()[\]]/g, "").toLocaleLowerCase();
  if (/^[a-e]$/.test(label)) return label.charCodeAt(0) - 97;
  if (/^[1-5]$/.test(label)) return Number(label) - 1;
  return ({ i: 0, ii: 1, iii: 2, iv: 3, v: 4 } as Record<string, number>)[label] ?? -1;
}

function identifyNumberedOptionLines(text: string) {
  const lines = text.split("\n");
  let questionSeen = false;
  let optionRun = 0;

  return lines.map((line, index) => {
    if (!line.trim()) return line;
    const numberedOption = line.match(/^(\s*)(?:\((\d)\)|(\d)\s*[).:\-])\s*(\S.*)$/);
    if (numberedOption) {
      const number = Number(numberedOption[2] ?? numberedOption[3]);
      if (optionRun > 0 && number === optionRun + 1) {
        optionRun = number;
        return `${numberedOption[1]}${String.fromCharCode(64 + number)}) ${numberedOption[4]}`;
      }

      const nextLine = lines[index + 1]?.trim() ? lines[index + 1] : lines[index + 2] ?? "";
      const nextNumber = nextLine.match(/^\s*(?:\((\d)\)|(\d)\s*[).:\-])\s*\S/);
      if (number === 1 && questionSeen && Number(nextNumber?.[1] ?? nextNumber?.[2]) === 2) {
        optionRun = 1;
        return `${numberedOption[1]}A) ${numberedOption[4]}`;
      }

      optionRun = 0;
      questionSeen = true;
      return line;
    }

    optionRun = 0;
    if (/^\s*(?:(?:question|q)\.?\s*)?[\[(]?\d{1,3}[\])]?(?:\s*[.):\-]|\s+\S)/i.test(line)) questionSeen = true;
    return line;
  }).join("\n");
}

/** Split pasted, numbered MCQ text into the same structure used by exam uploads. */
export function parsePastedExamQuestions(source: string): ParsedExamQuestion[] {
  const text = source.replace(/\r/g, "").trim();
  if (!text) return [];

  const answerKeyStart = text.search(/(?:^|\n)\s*(?:answer\s+key|correct\s+answers|answers)\s*:?\s*/i);
  const questionText = identifyNumberedOptionLines(answerKeyStart < 0 ? text : text.slice(0, answerKeyStart));
  const answerKeyText = answerKeyStart < 0 ? "" : text.slice(answerKeyStart);
  const answerKey = new Map<number, string>();
  for (const match of answerKeyText.matchAll(/(?:^|\s)(?:(?:question|q)\.?\s*)?(\d{1,3})\s*[.):\-]?\s*(?:option\s*)?(\([iv]{1,3}\)|\([1-5]\)|[A-E1-5]|iv|iii|ii|i|v)(?=\b|\s|$)/gi)) {
    const rank = optionRank(match[2]);
    if (rank >= 0) answerKey.set(Number(match[1]), String.fromCharCode(65 + rank));
  }

  const lineStarts = [...questionText.matchAll(/(?:^|\n)\s*(?:(?:question|q)\.?\s*)?[\[(]?(\d{1,3})[\])]?(?:\s*[.):\-]+\s*|\s+(?=\S))/gim)];
  const inlineStarts = [...questionText.matchAll(/(?:^|\s)(?:(?:question|q)\.?\s*)?[\[(]?(\d{1,3})[\])]?(?:\s*[.):\-]+\s*|\s+(?=\S))/gi)];
  const inlineQuestionCandidates = inlineStarts.filter((match) => {
    const before = questionText.slice(0, match.index ?? 0).trimEnd();
    return !/(?:[A-E][).:\-]|\([A-E]\)|\((?:iv|iii|ii|i|v)\)|(?:iv|iii|ii|i|v)[).:\-])$/i.test(before);
  });
  const inlineNumbers = inlineQuestionCandidates.map((match) => Number(match[1]));
  const inlineListIsSequential = inlineNumbers.length > lineStarts.length &&
    inlineNumbers.every((number, index) => index === 0 || number > inlineNumbers[index - 1]) &&
    (!lineStarts.length || inlineQuestionCandidates[0].index === lineStarts[0].index);
  const starts = inlineListIsSequential ? inlineQuestionCandidates : lineStarts;
  if (starts.length === 0) return [];

  const parsed: ParsedExamQuestion[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const startMatch = starts[index];
    const blockStart = (startMatch.index ?? 0) + startMatch[0].length;
    const blockEnd = index + 1 < starts.length ? starts[index + 1].index ?? questionText.length : questionText.length;
    const block = questionText.slice(blockStart, blockEnd).replace(/[ \t]+/g, " ").trim();
    const answerPattern = /(?:correct\s+(?:answer|option)|answer|ans)\s*(?:[.:\-]|is)?\s*(?:option\s*)?(\([iv]{1,3}\)|\([1-5]\)|[A-E1-5]|iv|iii|ii|i|v)(?=\b|\s|$)/i;
    const answerLabel = block.match(answerPattern)?.[1];
    const answerRank = answerLabel ? optionRank(answerLabel) : -1;
    const localAnswer = answerRank >= 0 ? String.fromCharCode(65 + answerRank) : null;
    const withoutAnswer = block.replace(/\s*(?:correct\s+(?:answer|option)|answer|ans)\s*(?:[.:\-]|is)?\s*(?:option\s*)?(?:\([iv]{1,3}\)|\([1-5]\)|[A-E1-5]|iv|iii|ii|i|v)[\s\S]*$/i, "").trim();
    const optionText = withoutAnswer.replace(/\b(?:options?|choices?)\s*[:\-]\s*/i, "");
    const optionMarker = /(?:^|\s)(?:option\s*)?(?:\[([A-E])\]|\(([A-E])\)|([A-E])\s*[).:\-]|\((iv|iii|ii|i|v)\)|\b(iv|iii|ii|i|v)\s*[).:\-]|\(([1-5])\)|([1-5])\s*[).:\-])\s*/gi;
    const optionMatches = [...optionText.matchAll(optionMarker)];
    const firstOptionAt = optionMatches[0]?.index ?? optionText.length;
    const prompt = optionText.slice(0, firstOptionAt).trim();
    const labeledOptions = optionMatches.map((option, optionIndex) => {
      const optionStart = (option.index ?? 0) + option[0].length;
      const optionEnd = optionIndex + 1 < optionMatches.length ? optionMatches[optionIndex + 1].index ?? optionText.length : optionText.length;
      const label = (option.slice(1).find(Boolean) ?? "").toLocaleUpperCase();
      const rank = optionRank(label);
      const value = optionText.slice(optionStart, optionEnd).trim();
      return { label, rank, value, sourceOrder: optionIndex };
    }).filter((option) => option.value);
    labeledOptions.sort((left, right) => left.rank - right.rank || left.sourceOrder - right.sourceOrder);
    const options = labeledOptions.map((option) => option.value);
    const answer = localAnswer ?? answerKey.get(Number(startMatch[1])) ?? null;
    const answerRankForQuestion = answer ? optionRank(answer) : -1;
    const answerMatches = answerRankForQuestion >= 0 ? labeledOptions.filter((option) => option.rank === answerRankForQuestion) : [];
    const correctAnswer = answerMatches.length === 1
      ? String.fromCharCode(65 + labeledOptions.indexOf(answerMatches[0]))
      : null;

    if (!prompt) continue;
    parsed.push({ prompt, options, correctAnswer });
  }

  return parsed;
}
