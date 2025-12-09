import { describe, it, expect } from 'vitest';
import { buildPrompt } from './build-prompt';

describe('buildPrompt', () => {
  it('builds prompt with current branch and other branches', () => {
    const currentBranch = { id: 'branch-1', summary: 'Discussing TypeScript' };
    const otherBranches = [
      { id: 'branch-2', summary: 'Python tutorials' },
      { id: 'branch-3', summary: 'Database design' },
    ];

    const prompt = buildPrompt('What about generics?', currentBranch, otherBranches);

    expect(prompt).toContain('Current branch topic: Discussing TypeScript');
    expect(prompt).toContain('- branch-2: Python tutorials');
    expect(prompt).toContain('- branch-3: Database design');
    expect(prompt).toContain('New message: "What about generics?"');
  });

  it('handles no current branch (new conversation)', () => {
    const prompt = buildPrompt('Hello there', undefined, []);

    expect(prompt).toContain('Current branch topic: None (new conversation)');
    expect(prompt).toContain('Other branches:\nNone');
  });

  it('handles no other branches', () => {
    const currentBranch = { id: 'branch-1', summary: 'Current topic' };

    const prompt = buildPrompt('Test message', currentBranch, []);

    expect(prompt).toContain('Other branches:\nNone');
  });

  it('includes STAY/BRANCH/ROUTE guidelines', () => {
    const prompt = buildPrompt('Test', undefined, []);

    expect(prompt).toContain('- STAY:');
    expect(prompt).toContain('- ROUTE:');
    expect(prompt).toContain('- BRANCH:');
  });

  it('includes quick check guidelines', () => {
    const prompt = buildPrompt('Test', undefined, []);

    expect(prompt).toContain('Filler (Yes, Ok, Sure, Thanks) → STAY');
    expect(prompt).toContain('Direct responses, elaborations, follow-up questions → STAY');
  });

  it('references current topic in STAY description', () => {
    const currentBranch = { id: 'b1', summary: 'Machine Learning' };

    const prompt = buildPrompt('Test', currentBranch, []);

    expect(prompt).toContain('STAY: Message DIRECTLY continues discussing "Machine Learning"');
  });

  it('uses fallback text when no current branch', () => {
    const prompt = buildPrompt('Test', undefined, []);

    expect(prompt).toContain('STAY: Message DIRECTLY continues discussing "the current topic"');
  });

  it('formats multiple branches correctly', () => {
    const otherBranches = [
      { id: 'a', summary: 'Topic A' },
      { id: 'b', summary: 'Topic B' },
      { id: 'c', summary: 'Topic C' },
    ];

    const prompt = buildPrompt('Test', undefined, otherBranches);

    expect(prompt).toContain('- a: Topic A\n- b: Topic B\n- c: Topic C');
  });
});
