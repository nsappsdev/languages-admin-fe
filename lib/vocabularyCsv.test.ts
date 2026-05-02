import { parseAndValidate } from './vocabularyCsv';

describe('parseAndValidate', () => {
  it('parses a valid CSV with all columns', () => {
    const csv = [
      'englishText,translation,kind,notes,tags,usageExample',
      'hello,բարև,WORD,greeting,greeting;basic,Hello there!',
    ].join('\n');
    const result = parseAndValidate(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        englishText: 'hello',
        translation: 'բարև',
        kind: 'WORD',
        notes: 'greeting',
        tags: ['greeting', 'basic'],
        usageExample: 'Hello there!',
      },
    ]);
  });

  it('reports missing englishText as a row error', () => {
    const csv = ['englishText,translation', ',foo'].join('\n');
    const result = parseAndValidate(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it('reports missing translation as a row error', () => {
    const csv = ['englishText,translation', 'hello,'].join('\n');
    const result = parseAndValidate(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(0);
  });

  it('treats empty kind as undefined (server auto-detects)', () => {
    const csv = ['englishText,translation,kind', 'hello,բարև,'].join('\n');
    const result = parseAndValidate(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].kind).toBeUndefined();
  });

  it('rejects unknown kind values', () => {
    const csv = ['englishText,translation,kind', 'hello,բարև,VERB'].join('\n');
    const result = parseAndValidate(csv);
    expect(result.errors).toHaveLength(1);
  });

  it('splits semicolon-delimited tags and trims', () => {
    const csv = ['englishText,translation,tags', 'hello,բարև, a ; b ;c '].join('\n');
    const result = parseAndValidate(csv);
    expect(result.rows[0].tags).toEqual(['a', 'b', 'c']);
  });

  it('handles UTF-8 BOM', () => {
    const csv = '﻿' + ['englishText,translation', 'hello,բարև'].join('\n');
    const result = parseAndValidate(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });

  it('reports missing required headers', () => {
    const csv = ['englishText', 'hello'].join('\n');
    const result = parseAndValidate(csv);
    expect(result.errors.some((e) => e.row === -1)).toBe(true);
  });

  it('handles RFC 4180 quoted fields with commas', () => {
    const csv = ['englishText,translation', '"hello, world",բարև'].join('\n');
    const result = parseAndValidate(csv);
    expect(result.rows[0].englishText).toBe('hello, world');
  });
});
