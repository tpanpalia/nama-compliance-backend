import { toNumberArray, toStringArray } from '../../src/utils/queryFilters';

describe('queryFilters utils', () => {
  test('toStringArray supports scalar', () => {
    expect(toStringArray('APPROVED')).toEqual(['APPROVED']);
  });

  test('toStringArray supports arrays', () => {
    expect(toStringArray(['APPROVED', 'SUBMITTED'])).toEqual(['APPROVED', 'SUBMITTED']);
  });

  test('toStringArray supports comma-separated values', () => {
    expect(toStringArray('APPROVED,SUBMITTED')).toEqual(['APPROVED', 'SUBMITTED']);
  });

  test('toStringArray ignores empty values', () => {
    expect(toStringArray('')).toEqual([]);
    expect(toStringArray(['', '  '])).toEqual([]);
  });

  test('toNumberArray supports scalar, arrays, and comma-separated values', () => {
    expect(toNumberArray('2025')).toEqual([2025]);
    expect(toNumberArray(['2025', '2026'])).toEqual([2025, 2026]);
    expect(toNumberArray('1,2,3')).toEqual([1, 2, 3]);
  });
});
