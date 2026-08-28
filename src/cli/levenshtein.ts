/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));

  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1, // deletion
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Finds best matches for a typo candidate from a list of valid options
 */
export function findClosestSuggestions(
  input: string,
  candidates: string[],
  maxDistance = 3,
  limit = 3
): string[] {
  if (!input || !candidates.length) return [];

  const cleanInput = input.trim().toLowerCase();
  
  const matches = candidates
    .map((cand) => {
      const cleanCand = cand.toLowerCase();
      // Exact prefix match bonus
      const distance = levenshtein(cleanInput, cleanCand);
      return { candidate: cand, distance };
    })
    .filter((item) => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.candidate);

  return matches.slice(0, limit);
}
