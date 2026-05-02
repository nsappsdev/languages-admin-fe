import Papa from 'papaparse';
import type { BulkImportRow } from './apiTypes';

const REQUIRED_HEADERS = ['englishText', 'translation'] as const;
const KNOWN_KINDS = new Set(['WORD', 'PHRASE', 'SENTENCE']);

export interface CsvParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  rows: BulkImportRow[];
  errors: CsvParseError[];
  totalParsed: number;
}

export function parseAndValidate(csvText: string): ParseResult {
  const errors: CsvParseError[] = [];
  const rows: BulkImportRow[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^﻿/, '').trim(),
  });

  for (const err of parsed.errors) {
    errors.push({ row: err.row ?? -1, message: err.message });
  }

  const headers = parsed.meta.fields ?? [];
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      errors.push({ row: -1, message: `Missing required column: ${required}` });
    }
  }
  if (errors.some((e) => e.row === -1)) {
    return { rows: [], errors, totalParsed: parsed.data.length };
  }

  parsed.data.forEach((raw, i) => {
    const englishText = (raw.englishText ?? '').trim();
    const translation = (raw.translation ?? '').trim();
    const kindRaw = (raw.kind ?? '').trim().toUpperCase();
    const notes = (raw.notes ?? '').trim();
    const tagsRaw = (raw.tags ?? '').trim();
    const usageExample = (raw.usageExample ?? '').trim();

    if (!englishText) {
      errors.push({ row: i, message: 'englishText is required' });
      return;
    }
    if (!translation) {
      errors.push({ row: i, message: 'translation is required' });
      return;
    }
    if (kindRaw && !KNOWN_KINDS.has(kindRaw)) {
      errors.push({ row: i, message: `kind must be WORD, PHRASE, or SENTENCE (got "${kindRaw}")` });
      return;
    }

    const tags = tagsRaw
      ? tagsRaw.split(';').map((t) => t.trim()).filter(Boolean)
      : undefined;

    rows.push({
      englishText,
      translation,
      kind: kindRaw ? (kindRaw as BulkImportRow['kind']) : undefined,
      notes: notes || undefined,
      tags,
      usageExample: usageExample || undefined,
    });
  });

  return { rows, errors, totalParsed: parsed.data.length };
}
