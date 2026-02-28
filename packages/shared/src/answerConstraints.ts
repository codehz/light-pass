import {
  type AnswerConstraints,
  DEFAULT_ANSWER_CONSTRAINTS,
} from "./contracts";

export const ANSWER_VALIDATION_ERROR_PREFIX = "answer_validation_failed:";

export type AnswerValidationErrorCode = "too_long" | "too_few_lines";

export type AnswerValidationResult =
  | {
      ok: true;
      actual: {
        length: number;
        non_empty_lines: number;
      };
    }
  | {
      ok: false;
      errorCode: AnswerValidationErrorCode;
      message: string;
      actual: number;
      expected: number;
      metrics: {
        length: number;
        non_empty_lines: number;
      };
    };

export function countAnswerLength(answer: string): number {
  return Array.from(answer).length;
}

export function countNonEmptyLines(answer: string): number {
  return answer
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

export function normalizeAnswerConstraints(
  constraints: Partial<AnswerConstraints> | null | undefined,
): AnswerConstraints {
  return {
    max_length: constraints?.max_length ?? DEFAULT_ANSWER_CONSTRAINTS.max_length,
    min_lines: constraints?.min_lines ?? DEFAULT_ANSWER_CONSTRAINTS.min_lines,
  };
}

export function validateAnswer(
  answer: string,
  constraints: AnswerConstraints,
): AnswerValidationResult {
  const length = countAnswerLength(answer);
  const nonEmptyLines = countNonEmptyLines(answer);

  if (length > constraints.max_length) {
    return {
      ok: false,
      errorCode: "too_long",
      message: `回答过长：当前 ${length} 字，最多 ${constraints.max_length} 字。`,
      actual: length,
      expected: constraints.max_length,
      metrics: {
        length,
        non_empty_lines: nonEmptyLines,
      },
    };
  }

  if (nonEmptyLines < constraints.min_lines) {
    return {
      ok: false,
      errorCode: "too_few_lines",
      message: `回答行数不足：当前 ${nonEmptyLines} 行，至少 ${constraints.min_lines} 行（按非空行统计）。`,
      actual: nonEmptyLines,
      expected: constraints.min_lines,
      metrics: {
        length,
        non_empty_lines: nonEmptyLines,
      },
    };
  }

  return {
    ok: true,
    actual: {
      length,
      non_empty_lines: nonEmptyLines,
    },
  };
}
