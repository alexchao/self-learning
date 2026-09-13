export type DiffSegment = { kind: "same" | "removed" | "added"; text: string };

/**
 * Character-level diff (LCS) between the learner's answer and the corrected version.
 * Character granularity suits Chinese; inputs are short, so O(n·m) is fine.
 */
export function diffCharacters(original: string, corrected: string): DiffSegment[] {
  const originalCharacters = Array.from(original);
  const correctedCharacters = Array.from(corrected);
  const rows = originalCharacters.length;
  const columns = correctedCharacters.length;
  if (rows * columns > 400_000) {
    return [
      { kind: "removed", text: original },
      { kind: "added", text: corrected },
    ];
  }

  const lcsLengths: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(columns + 1).fill(0));
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      lcsLengths[row]![column] =
        originalCharacters[row] === correctedCharacters[column]
          ? lcsLengths[row + 1]![column + 1]! + 1
          : Math.max(lcsLengths[row + 1]![column]!, lcsLengths[row]![column + 1]!);
    }
  }

  const segments: DiffSegment[] = [];
  const pushCharacter = (kind: DiffSegment["kind"], character: string) => {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.kind === kind) lastSegment.text += character;
    else segments.push({ kind, text: character });
  };

  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (originalCharacters[row] === correctedCharacters[column]) {
      pushCharacter("same", originalCharacters[row]!);
      row += 1;
      column += 1;
    } else if (lcsLengths[row + 1]![column]! >= lcsLengths[row]![column + 1]!) {
      pushCharacter("removed", originalCharacters[row]!);
      row += 1;
    } else {
      pushCharacter("added", correctedCharacters[column]!);
      column += 1;
    }
  }
  while (row < rows) pushCharacter("removed", originalCharacters[row++]!);
  while (column < columns) pushCharacter("added", correctedCharacters[column++]!);
  return segments;
}
