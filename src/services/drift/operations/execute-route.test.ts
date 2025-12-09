import { describe, it, expect } from 'vitest';
import { calculateCentroid } from './execute-route';

describe('calculateCentroid', () => {
  it('returns new embedding when old centroid is empty', () => {
    const result = calculateCentroid([], [0.1, 0.2, 0.3], 1);

    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('calculates running average correctly', () => {
    // Old centroid: [1, 2, 3], new embedding: [2, 4, 6], count: 2
    // Formula: old + (new - old) / n
    // [1 + (2-1)/2, 2 + (4-2)/2, 3 + (6-3)/2] = [1.5, 3, 4.5]
    const result = calculateCentroid([1, 2, 3], [2, 4, 6], 2);

    expect(result).toEqual([1.5, 3, 4.5]);
  });

  it('handles single message (count = 1)', () => {
    // With count=1: old + (new - old) / 1 = new
    const result = calculateCentroid([0.5, 0.5], [1, 1], 1);

    expect(result).toEqual([1, 1]);
  });

  it('converges toward new values with more messages', () => {
    // With higher count, change is smaller
    const result = calculateCentroid([1, 1, 1], [10, 10, 10], 10);

    // [1 + (10-1)/10, ...] = [1.9, 1.9, 1.9]
    expect(result).toEqual([1.9, 1.9, 1.9]);
  });

  it('handles negative values', () => {
    const result = calculateCentroid([-1, -2], [1, 2], 2);

    // [-1 + (1-(-1))/2, -2 + (2-(-2))/2] = [0, 0]
    expect(result).toEqual([0, 0]);
  });

  it('handles zero values', () => {
    const result = calculateCentroid([0, 0, 0], [3, 6, 9], 3);

    // [0 + 3/3, 0 + 6/3, 0 + 9/3] = [1, 2, 3]
    expect(result).toEqual([1, 2, 3]);
  });

  it('preserves array length', () => {
    const embedding = new Array(384).fill(0.5);
    const oldCentroid = new Array(384).fill(0.25);

    const result = calculateCentroid(oldCentroid, embedding, 2);

    expect(result.length).toBe(384);
  });
});
