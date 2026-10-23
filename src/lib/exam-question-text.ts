export type ParsedExamQuestion = {
  prompt: string;
  options: string[];
  correctAnswer: string | null;
  questionNumber?: number;
  imageUrl?: string | null;
  optionImages?: (string | null)[];
};

const ANSWER_MARKER = "\\b(?:correct\\s+(?:answer|option)|answer\\s+key|answers|answer|ans|key|solution|correct)";
const ANSWER_LEAD_IN = "(?:(?:the|and|so|thus|therefore|hence|then|is|its|of|right|final)\\s+){0,3}";
const LETTER_LABEL = "(?:[A-E1-5]|iv|iii|ii|i|v)";
const LONE_LABEL_LINE = new RegExp(`^\\s*(?:(?:question|q)\\.?\\s*)?(?:\\d{1,3}\\s*[.)\\-:]\\s*)?[([]?\\s*(${LETTER_LABEL})\\s*[)\\]]?[\\s.]*$`, "i");
const ROMAN_RANKS: Record<string, number> = { i: 0, ii: 1, iii: 2, iv: 3, v: 4 };

const ANSWER_KEY_HEADER = /(?:^|\n)\s*(?:(?:answer\s+key|answers|correct\s+answers|marking\s+scheme)\s*:?\s*|(?:answer|correct\s+answer)\s*:?\s*(?=\n|$))/i;
const ANSWER_KEY_LETTER_ENTRY = new RegExp(`(?:^|\\s)(?:(?:question|q)\\.?\\s*)?(\\d{1,3})\\s*[.,):\\-]?\\s*(?:option\\s*)?\\(?(${LETTER_LABEL})\\)?(?=\\b|\\s|$|[,;.)])`, "gi");
const ANSWER_KEY_TEXT_ENTRY = /^(?:(?:question|q)\.?\s*)?(\d{1,3})\s*[.)\-:]\s*(.+)$/i;
const OPTION_MARKER = /(?:^|\s)(?:option\s*)?(?:\[([A-E])\]|\(([A-E])\)|([A-E])\s*[).:\-]|\((iv|iii|ii|i|v)\)|\b(iv|iii|ii|i|v)\s*[).:\-]|\(([1-5])\)|([1-5])\s*[).:\-])[^\S\n]*/gi;
const ANSWER_LINE_PREFIX = new RegExp(`^\\s*${ANSWER_LEAD_IN}${ANSWER_MARKER}`, "i");
const INLINE_LETTER_TAIL = new RegExp(`^\\s*(?:is\\s*)?(?:[.:\\-]\\s*)?(?:option\\s*)?\\(?(${LETTER_LABEL})\\)?(?=\\b|\\s|$)`, "i");
const INLINE_TEXT_TAIL = new RegExp(`^\\s*(?:is\\s*[:\\-–—]?\\s*|[:\\-–—]\\s*)(.+)$`, "i");
const ANSWER_LETTER = new RegExp(`${ANSWER_MARKER}\\s*(?:is\\s*)?(?:[.:\\-]\\s*)?(?:option\\s*)?\\(?(${LETTER_LABEL})\\)?(?=\\b|\\s|$)`, "i");
const ANSWER_LETTER_GLOBAL = new RegExp(ANSWER_LETTER.source, "gi");
const ANSWER_TAIL_TEXT = new RegExp(`${ANSWER_MARKER}\\s*(?:is\\s*[:\\-–—]?\\s*|[:\\-–—]\\s*)([^\\n]+)$`, "im");
const ANSWER_TAIL_TEXT_GLOBAL = new RegExp(ANSWER_TAIL_TEXT.source, "gim");
const PAREN_ANSWER_LETTER = new RegExp(`[([]\\s*${ANSWER_MARKER}\\s*(?:is\\s*)?(?:[.:\\-]\\s*)?(?:option\\s*)?\\(?(${LETTER_LABEL})\\)?\\s*[)\\]]`, "i");
const PAREN_ANSWER_TEXT = new RegExp(`[([]\\s*${ANSWER_MARKER}\\s*(?:is\\s*[:\\-–—]?\\s*|[:\\-–—]\\s*)([^)\\]]+?)\\s*[)\\]]`, "i");

function optionRank(value: string) {
  const label = value
    .trim()
    .replace(/[()[\]]/g, "")
    .replace(/^[\s.:\-–—]+|[\s.:\-–—]+$/g, "")
    .toLocaleLowerCase();
  if (/^[a-e]$/.test(label)) return label.charCodeAt(0) - 97;
  if (/^[1-5]$/.test(label)) return Number(label) - 1;
  return ROMAN_RANKS[label] ?? -1;
}

function collapse(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeAnswerText(value: string) {
  return collapse(value).replace(/[.!?;,]+$/, "").toLocaleLowerCase();
}

/** Split an answer such as "B", "(C)", "D. Chlorophyll", or "III Iron" into label and wording. */
function splitLeadingLabel(value: string): { label: string; rest: string } | null {
  const bracketed = value.match(/^[([]\s*([A-E1-5]|iv|iii|ii|i|v)\s*[)\]]\s*[.:\-,–—]?\s*(.*)$/i);
  if (bracketed) return { label: bracketed[1], rest: bracketed[2].trim() };
  const punctuated = value.match(/^([A-E1-5]|iv|iii|ii|i|v)\s*[.:\-,–—]\s*(.+)$/i);
  if (punctuated) return { label: punctuated[1], rest: punctuated[2].trim() };
  const spaced = value.match(/^([A-E1-5]|iv|iii|ii|i|v)\s+(?=[A-Z0-9[(])(.+)$/);
  if (spaced) return { label: spaced[1], rest: spaced[2].trim() };
  if (optionRank(value) >= 0) return { label: value.trim(), rest: "" };
  return null;
}

function isCleanAnswerTail(tail: string) {
  const value = tail.trim();
  return value === "" || /^[.)\],;:\-–—]/.test(value);
}

/** Cut the answer phrase out of a line, dropping filler words such as "The" that only lead into it. */
function cutAnswerFrom(text: string, index: number) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const before = text.slice(lineStart, index);
  const trimmed = before.trim();
  if (trimmed && /^[A-Za-z\s]+$/.test(trimmed) && trimmed.split(/\s+/).length <= 4) {
    const lineEnd = text.indexOf("\n", index);
    return text.slice(0, lineStart) + (lineEnd >= 0 ? text.slice(lineEnd) : "");
  }
  return text.slice(0, index);
}

function hasOtherContent(lines: string[], skipIndex: number) {
  return lines.some((line, index) => index !== skipIndex && line.trim());
}

/** Answers can sit on their own line, in brackets, or trailing the last choice. */
function takeInlineAnswer(rawBlock: string): { block: string; answer: string | null } {
  let lines = rawBlock.split("\n");
  let answer: string | null = null;

  for (let index = lines.length - 1; index >= 0 && answer === null; index -= 1) {
    const line = lines[index];
    const prefix = line.match(ANSWER_LINE_PREFIX);
    if (!prefix || !hasOtherContent(lines, index)) continue;
    const after = line.slice(prefix[0].length);
    const letter = after.match(INLINE_LETTER_TAIL);
    if (letter && isCleanAnswerTail(after.slice(letter[0].length))) {
      answer = letter[1];
      lines[index] = "";
      continue;
    }
    const text = after.match(INLINE_TEXT_TAIL);
    if (text && collapse(text[1]) && !text[1].includes("?")) {
      answer = collapse(text[1]);
      lines[index] = "";
    }
  }

  if (answer === null) {
    for (let index = 0; index < lines.length && answer === null; index += 1) {
      const letter = lines[index].match(PAREN_ANSWER_LETTER);
      const text = letter ? null : lines[index].match(PAREN_ANSWER_TEXT);
      const match = letter ?? text;
      if (!match) continue;
      const value = collapse(match[1]);
      if (!value) continue;
      answer = value;
      lines[index] = lines[index].slice(0, match.index ?? 0) + lines[index].slice((match.index ?? 0) + match[0].length);
    }
  }

  if (answer === null) {
    const joined = lines.join("\n");
    const trailingLetter = [...joined.matchAll(ANSWER_LETTER_GLOBAL)]
      .reverse()
      .find((match) => isCleanAnswerTail(joined.slice((match.index ?? 0) + match[0].length)));
    if (trailingLetter) {
      answer = trailingLetter[1];
      lines = cutAnswerFrom(joined, trailingLetter.index ?? 0).split("\n");
    } else {
      const trailingText = [...joined.matchAll(ANSWER_TAIL_TEXT_GLOBAL)]
        .reverse()
        .find((match) => collapse(match[1]) && !match[1].includes("?"));
      if (trailingText) {
        answer = collapse(trailingText[1]);
        lines = cutAnswerFrom(joined, trailingText.index ?? 0).split("\n");
      }
    }
  }

  if (answer === null) {
    let last = lines.length - 1;
    while (last >= 0 && !lines[last].trim()) last -= 1;
    const lone = last >= 0 ? lines[last].match(LONE_LABEL_LINE) : null;
    if (lone) {
      const rest = lines.slice(0, last).join("\n");
      if ([...rest.matchAll(OPTION_MARKER)].length >= 2 && hasOtherContent(lines, last)) {
        answer = lone[1];
        lines.splice(last, 1);
      }
    }
  }

  const block = lines
    .filter((line) => line.trim() && !/^[\s).\-–—:;,[\]]+$/.test(line))
    .join("\n")
    .replace(/\(\s*\)|\[\s*\]/g, " ")
    .trim();
  return { block, answer };
}

function parseAnswerKey(text: string): Map<number, string> {
  const answerKey = new Map<number, string>();
  for (const match of text.matchAll(ANSWER_KEY_LETTER_ENTRY)) {
    const rank = optionRank(match[2]);
    const questionNumber = Number(match[1]);
    if (rank >= 0 && !answerKey.has(questionNumber)) answerKey.set(questionNumber, String.fromCharCode(65 + rank));
  }
  for (const line of text.split("\n")) {
    const entry = line.trim().match(ANSWER_KEY_TEXT_ENTRY);
    if (!entry) continue;
    const questionNumber = Number(entry[1]);
    if (answerKey.has(questionNumber)) continue;
    const value = collapse(entry[2]).replace(/[.]+$/, "");
    if (value && value.length <= 120 && !value.includes("?")) answerKey.set(questionNumber, value);
  }
  return answerKey;
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

/** Numbers printed inside a stem or answer line ("2 + 2", "(2 marks)", "Answer: (2)") are not question numbers. */
function isNoiseQuestionStart(questionText: string, match: RegExpMatchArray) {
  const start = match.index ?? 0;
  const after = questionText.slice(start + match[0].length);
  if (/^\s*[+\-*/×÷=]\s*\d/.test(after)) return true;
  if (/^\s*\d{0,2}\s*(?:marks?|points?|pts|minutes?|mins?|seconds?|percent)\b/i.test(after)) return true;
  const numberAt = start + (match[0].length - match[0].trimStart().length);
  const lineStart = questionText.lastIndexOf("\n", numberAt - 1) + 1;
  const sameLineBefore = questionText.slice(lineStart, numberAt);
  if (sameLineBefore.trim()) {
    return /(?:^|[\s.])(?:correct\s+answer|answer(?:\s+key)?|answers|ans|key|solution)\s*[:.\-]\s*$/i.test(sameLineBefore);
  }
  // At a line start the number must look like printed numbering, not a wrapped stem.
  const separator = questionText[numberAt + match[1].length] ?? "";
  if (!/[.):\-]/.test(separator) && !/^\s*(?:question|q)\.?\s*\d/i.test(match[0])) return true;
  return separator === "." && /\d/.test(questionText[numberAt + match[1].length + 1] ?? "");
}

function findQuestionStarts(questionText: string) {
  const lineStarts = [...questionText.matchAll(/(?:^|\n)\s*(?:(?:question|q)\.?\s*)?[\[(]?(\d{1,3})[\])]?(?:\s*[.):\-]+\s*|\s+(?=\S))/gim)]
    .filter((match) => !isNoiseQuestionStart(questionText, match));
  const inlineStarts = [...questionText.matchAll(/(?:^|\s)(?:(?:question|q)\.?\s*)?[\[(]?(\d{1,3})[\])]?(?:\s*[.):\-]+\s*|\s+(?=\S))/gi)];
  const inlineQuestionCandidates = inlineStarts.filter((match) => {
    const before = questionText.slice(0, match.index ?? 0).trimEnd();
    if (/(?:[A-E][).:\-]|\([A-E]\)|\((?:iv|iii|ii|i|v)\)|(?:iv|iii|ii|i|v)[).:\-])$/i.test(before)) return false;
    return !isNoiseQuestionStart(questionText, match);
  });
  const inlineNumbers = inlineQuestionCandidates.map((match) => Number(match[1]));
  const inlineListIsSequential = inlineNumbers.length > lineStarts.length &&
    inlineNumbers.every((number, index) => index === 0 || number === inlineNumbers[index - 1] + 1) &&
    (!lineStarts.length || inlineQuestionCandidates[0].index === lineStarts[0].index);
  return inlineListIsSequential ? inlineQuestionCandidates : lineStarts;
}

function stripChoiceMarker(line: string) {
  return line.replace(/^(?:[•▪◦‣·●⁃]\s*|\(?\d{1,2}[.)]\s*|[-–—]\s+)/, "").trim();
}

/** Choices printed without labels: one per line, or split by tabs and wide gaps. */
function parseUnlabeledChoices(text: string): { prompt: string; options: string[] } {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 3) {
    let promptEnd = -1;
    for (let index = lines.length - 3; index >= 0; index -= 1) {
      if (/[?:]\s*$/.test(lines[index])) { promptEnd = index; break; }
    }
    const end = promptEnd >= 0 ? promptEnd : 0;
    const options = lines.slice(end + 1).map(stripChoiceMarker).filter(Boolean);
    const prompt = collapse(lines.slice(0, end + 1).join(" "));
    const looksLikeQuestion = promptEnd >= 0 || (prompt.length >= 12 && options.length <= 6 && options.every((option) => option.length <= 80 && !/[.]\s*$/.test(option)));
    if (options.length >= 2 && options.length <= 6 && looksLikeQuestion) return { prompt, options };
  }

  const parts = text.replace(/[\t\n]/g, "  ").split(/\s{2,}/).map(stripChoiceMarker).filter(Boolean);
  const partChoices = parts.slice(1);
  if (parts.length >= 3 && parts.length <= 7 && /[?:]\s*$/.test(parts[0]) && partChoices.every((option) => option.length <= 80)) {
    return { prompt: parts[0], options: partChoices };
  }

  return { prompt: collapse(lines.join(" ")), options: [] };
}

type LabeledChoice = { label: string; rank: number; value: string; sourceOrder: number };

type OptionStyle = "letter" | "digit" | "roman";

function optionStyleOf(match: RegExpMatchArray): OptionStyle | null {
  if (match[1] || match[2] || match[3]) return "letter";
  if (match[6] || match[7]) return "digit";
  if (match[4] || match[5]) return "roman";
  return null;
}

/** Keep only the final consecutive choice list when a stem also labels its statements. */
function selectOptionMatches(matches: RegExpMatchArray[]) {
  const groups: RegExpMatchArray[][] = [];
  for (const match of matches) {
    const style = optionStyleOf(match);
    const label = match.slice(1).find(Boolean) ?? "";
    const rank = optionRank(label);
    const previousGroup = groups[groups.length - 1];
    const previous = previousGroup?.[previousGroup.length - 1];
    const previousStyle = previous ? optionStyleOf(previous) : null;
    const previousLabel = previous?.slice(1).find(Boolean) ?? "";

    if (previousGroup && previousStyle === style && rank === optionRank(previousLabel) + 1) {
      previousGroup.push(match);
    } else {
      groups.push([match]);
    }
  }

  const choiceGroups = groups.filter((group) => group.length >= 2);
  return choiceGroups.length ? choiceGroups[choiceGroups.length - 1] : matches;
}

function parseQuestionBlock(rawBlock: string) {
  const { block, answer } = takeInlineAnswer(rawBlock);
  const text = block.replace(/\b(?:options?|choices?|alternatives?)\s*[:\-]\s*/i, " ");
  const optionMatches = selectOptionMatches([...text.matchAll(OPTION_MARKER)]);
  const firstOptionAt = optionMatches[0]?.index ?? text.length;
  const labeledOptions: LabeledChoice[] = optionMatches
    .map((option, optionIndex) => {
      const optionStart = (option.index ?? 0) + option[0].length;
      const optionEnd = optionIndex + 1 < optionMatches.length ? optionMatches[optionIndex + 1].index ?? text.length : text.length;
      const label = (option.slice(1).find(Boolean) ?? "").toLocaleUpperCase();
      return { label, rank: optionRank(label), value: collapse(text.slice(optionStart, optionEnd)), sourceOrder: optionIndex };
    })
    .filter((option) => option.value)
    .sort((left, right) => left.rank - right.rank || left.sourceOrder - right.sourceOrder);

  let prompt = collapse(text.slice(0, firstOptionAt));
  let options = labeledOptions.map((option) => option.value);
  let choices = labeledOptions;

  if (labeledOptions.length < 2) {
    const fallback = parseUnlabeledChoices(text);
    if (fallback.options.length > labeledOptions.length) {
      prompt = fallback.prompt;
      options = fallback.options;
      choices = [];
    }
  }

  return { prompt, options, labeledChoices: choices, answer };
}

/** Place the identified answer into its choice, adding the wording when no label matches. */
function resolveAnswer(rawAnswer: string | null, options: string[], labeledChoices: LabeledChoice[]) {
  const value = (rawAnswer ?? "").trim();
  if (!value) return { options, correctAnswer: null };

  const split = splitLeadingLabel(value);
  const textCandidates = [value, ...(split?.rest ? [split.rest] : [])];
  for (const candidate of textCandidates) {
    const normalized = normalizeAnswerText(candidate);
    if (!normalized) continue;
    const matches = options
      .map((option, index) => normalizeAnswerText(option) === normalized ? index : -1)
      .filter((index) => index >= 0);
    if (matches.length === 1) return { options, correctAnswer: String.fromCharCode(65 + matches[0]) };
  }

  const rank = optionRank(value) >= 0 ? optionRank(value) : split ? optionRank(split.label) : -1;
  if (rank >= 0) {
    if (labeledChoices.length) {
      const at = labeledChoices.findIndex((choice) => choice.rank === rank);
      return at >= 0 ? { options, correctAnswer: String.fromCharCode(65 + at) } : { options, correctAnswer: null };
    }
    return rank < options.length ? { options, correctAnswer: String.fromCharCode(65 + rank) } : { options, correctAnswer: null };
  }

  // Keys such as "A and E" or "(1), (3)" list several labels; place the first one that exists.
  const labelParts = value.split(/\s*(?:,|and|&|or|\/)\s*/i).filter(Boolean);
  if (labelParts.length >= 2 && labelParts.every((part) => optionRank(part) >= 0)) {
    for (const part of labelParts) {
      const partRank = optionRank(part);
      if (labeledChoices.length) {
        const at = labeledChoices.findIndex((choice) => choice.rank === partRank);
        if (at >= 0) return { options, correctAnswer: String.fromCharCode(65 + at) };
      } else if (partRank < options.length) {
        return { options, correctAnswer: String.fromCharCode(65 + partRank) };
      }
    }
  }

  const wording = split?.rest || value;
  if (wording && options.length < 5) {
    return { options: [...options, wording], correctAnswer: String.fromCharCode(65 + options.length) };
  }
  return { options, correctAnswer: null };
}

/** A key entry is a short single line; questions carry a mark, choices, or several lines. */
function looksLikeQuestionBlock(questionText: string, starts: RegExpMatchArray[], index: number) {
  const start = (starts[index].index ?? 0) + starts[index][0].length;
  const end = index + 1 < starts.length ? starts[index + 1].index ?? questionText.length : questionText.length;
  const block = questionText.slice(start, end).trim();
  if (block.includes("?") || block.length >= 60 || block.split("\n").length > 2) return true;
  return [...block.matchAll(/(?:^|\s)\(?[A-E][).:\-]/g)].length >= 2;
}

/** A bare label such as "1) B" after a question is its answer, not a new question. */
function isLabelOnlyQuestion(questionText: string, starts: RegExpMatchArray[], index: number) {
  const start = (starts[index].index ?? 0) + starts[index][0].length;
  const end = index + 1 < starts.length ? starts[index + 1].index ?? questionText.length : questionText.length;
  return LONE_LABEL_LINE.test(questionText.slice(start, end).trim());
}

/** Split a paper into questions, choices, and answers without any manual entry. */
export function parseExamQuestions(source: string): ParsedExamQuestion[] {
  const text = source.replace(/\r/g, "").replace(/\u00a0/g, " ").trim();
  if (!text) return [];

  const answerKeyStart = text.search(ANSWER_KEY_HEADER);
  let questionText = identifyNumberedOptionLines(text);
  let answerKeyText = "";

  if (answerKeyStart >= 0) {
    const beforeKey = identifyNumberedOptionLines(text.slice(0, answerKeyStart));
    if (findQuestionStarts(beforeKey).length > 0) {
      questionText = beforeKey;
      answerKeyText = text.slice(answerKeyStart);
    } else {
      // The key was printed first: keep it apart from the questions that follow.
      const starts = findQuestionStarts(questionText);
      const firstQuestion = starts.findIndex((_, index) => looksLikeQuestionBlock(questionText, starts, index));
      if (firstQuestion >= 0) {
        answerKeyText = questionText.slice(answerKeyStart, starts[firstQuestion].index ?? questionText.length);
        questionText = questionText.slice(starts[firstQuestion].index ?? 0);
      } else {
        questionText = beforeKey;
        answerKeyText = text.slice(answerKeyStart);
      }
    }
  }

  const answerKey = answerKeyText ? parseAnswerKey(answerKeyText) : new Map<number, string>();
  const allStarts = findQuestionStarts(questionText);
  const starts = allStarts.filter((_, index) => !isLabelOnlyQuestion(questionText, allStarts, index));
  if (starts.length === 0) return [];

  const parsed: ParsedExamQuestion[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const startMatch = starts[index];
    const blockStart = (startMatch.index ?? 0) + startMatch[0].length;
    const blockEnd = index + 1 < starts.length ? starts[index + 1].index ?? questionText.length : questionText.length;
    const questionNumber = Number(startMatch[1]);
    const { prompt, options, labeledChoices, answer } = parseQuestionBlock(questionText.slice(blockStart, blockEnd));
    if (!prompt) continue;
    const inline = resolveAnswer(answer, options, labeledChoices);
    const keyed = answerKey.get(questionNumber) ?? null;
    const resolved = inline.correctAnswer || !keyed ? inline : resolveAnswer(keyed, options, labeledChoices);
    parsed.push({ questionNumber, prompt, options: resolved.options, correctAnswer: resolved.correctAnswer });
  }

  return parsed;
}

/** Split pasted, numbered MCQ text into the same structure used by exam uploads. */
export function parsePastedExamQuestions(source: string): ParsedExamQuestion[] {
  return parseExamQuestions(source);
}
