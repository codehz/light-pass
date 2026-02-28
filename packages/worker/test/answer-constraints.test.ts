import { describe, expect, it } from "bun:test";
import {
  validateAnswer,
} from "../../shared/src/answerConstraints";
import type { AnswerConstraints } from "../../shared/src/contracts";

const constraints: AnswerConstraints = {
  max_length: 500,
  min_lines: 1,
};

describe("answer constraints", () => {
  it("accepts answer at max length", () => {
    const answer = "a".repeat(500);
    const result = validateAnswer(answer, constraints);
    expect(result.ok).toBe(true);
  });

  it("rejects answer over max length", () => {
    const answer = "a".repeat(501);
    const result = validateAnswer(answer, constraints);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected validation failure");
    expect(result.errorCode).toBe("too_long");
    expect(result.actual).toBe(501);
    expect(result.expected).toBe(500);
    expect(result.message).toBe("回答过长：当前 501 字，最多 500 字。");
  });

  it("counts non-empty lines only", () => {
    const result1 = validateAnswer("\n \n\t", constraints);
    expect(result1.ok).toBe(false);
    if (result1.ok) throw new Error("expected validation failure");
    expect(result1.errorCode).toBe("too_few_lines");
    expect(result1.actual).toBe(0);

    const result2 = validateAnswer(" \nhello\n\t", constraints);
    expect(result2.ok).toBe(true);
  });

  it("keeps deterministic priority when both constraints fail", () => {
    const strict: AnswerConstraints = {
      max_length: 1,
      min_lines: 2,
    };
    const result = validateAnswer("  ", strict);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected validation failure");
    expect(result.errorCode).toBe("too_long");
  });

  it("counts unicode by code points", () => {
    const unicodeConstraints: AnswerConstraints = {
      max_length: 2,
      min_lines: 1,
    };
    const ok = validateAnswer("😀a", unicodeConstraints);
    expect(ok.ok).toBe(true);

    const tooLong = validateAnswer("😀ab", unicodeConstraints);
    expect(tooLong.ok).toBe(false);
    if (tooLong.ok) throw new Error("expected validation failure");
    expect(tooLong.actual).toBe(3);
  });
});
