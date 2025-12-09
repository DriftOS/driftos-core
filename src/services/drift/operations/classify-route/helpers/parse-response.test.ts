import { describe, it, expect } from 'vitest';
import { parseResponse } from './parse-response';

describe('parseResponse', () => {
  it('parses STAY action correctly', () => {
    const response = JSON.stringify({
      action: 'STAY',
      reason: 'Continues current topic',
      confidence: 0.9,
    });

    const result = parseResponse(response);

    expect(result.action).toBe('STAY');
    expect(result.reason).toBe('Continues current topic');
    expect(result.confidence).toBe(0.9);
    expect(result.targetBranchId).toBeUndefined();
    expect(result.newBranchTopic).toBeUndefined();
  });

  it('parses BRANCH action with newBranchTopic', () => {
    const response = JSON.stringify({
      action: 'BRANCH',
      newBranchTopic: 'New discussion about weather',
      reason: 'Different topic',
      confidence: 0.85,
    });

    const result = parseResponse(response);

    expect(result.action).toBe('BRANCH');
    expect(result.newBranchTopic).toBe('New discussion about weather');
    expect(result.reason).toBe('Different topic');
  });

  it('parses ROUTE action with targetBranchId', () => {
    const response = JSON.stringify({
      action: 'ROUTE',
      targetBranchId: 'branch-456',
      reason: 'Matches existing branch',
      confidence: 0.8,
    });

    const result = parseResponse(response, 'branch-123');

    expect(result.action).toBe('ROUTE');
    expect(result.targetBranchId).toBe('branch-456');
  });

  it('converts ROUTE to STAY when targeting current branch', () => {
    const response = JSON.stringify({
      action: 'ROUTE',
      targetBranchId: 'current-branch',
      reason: 'Some reason',
      confidence: 0.7,
    });

    const result = parseResponse(response, 'current-branch');

    expect(result.action).toBe('STAY');
    expect(result.targetBranchId).toBeUndefined();
  });

  it('defaults confidence to 0.5 when missing', () => {
    const response = JSON.stringify({
      action: 'STAY',
      reason: 'Some reason',
    });

    const result = parseResponse(response);

    expect(result.confidence).toBe(0.5);
  });

  it('defaults reason to Unknown when missing', () => {
    const response = JSON.stringify({
      action: 'STAY',
      confidence: 0.8,
    });

    const result = parseResponse(response);

    expect(result.reason).toBe('Unknown');
  });

  it('handles empty targetBranchId as undefined', () => {
    const response = JSON.stringify({
      action: 'STAY',
      targetBranchId: '',
      reason: 'Test',
    });

    const result = parseResponse(response);

    expect(result.targetBranchId).toBeUndefined();
  });

  it('handles empty newBranchTopic as undefined', () => {
    const response = JSON.stringify({
      action: 'BRANCH',
      newBranchTopic: '',
      reason: 'Test',
    });

    const result = parseResponse(response);

    expect(result.newBranchTopic).toBeUndefined();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseResponse('not valid json')).toThrow();
  });
});
