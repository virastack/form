export interface TextDiff {
  /** First changed index (same in both strings). */
  start: number;
  /** End of the removed range in the previous string. */
  removedEnd: number;
  /** Text that replaced the removed range. */
  inserted: string;
}

/**
 * Finds the single edit that turns `previous` into `next`.
 * The caret marks where inserted text ends, so repeated characters ("11" → "111") resolve correctly.
 */
export function diffText(previous: string, next: string, caret: number | null): TextDiff {
  const at = caret ?? next.length;
  const maxStart = Math.min(previous.length, next.length, at);

  let start = 0;
  while (start < maxStart && previous[start] === next[start]) start++;

  let end = 0;
  while (
    end < previous.length - start &&
    end < next.length - start &&
    next.length - end > at &&
    previous[previous.length - 1 - end] === next[next.length - 1 - end]
  ) {
    end++;
  }

  return { start, removedEnd: previous.length - end, inserted: next.slice(start, next.length - end) };
}

export function isForwardDelete(inputType: string | undefined): boolean {
  return inputType === "deleteContentForward" || inputType === "deleteWordForward";
}
