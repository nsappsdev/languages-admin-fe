import Papa from 'papaparse';
import { OccurrencesResponse, WordOccurrenceDto } from './textAuthoringTypes';

export interface ImportRow { line: number; term: string; translation: string }
export interface ImportMatch {
  key: string; row: ImportRow; first: WordOccurrenceDto; last: WordOccurrenceDto;
  sentence: string; sentenceNumber: number; existingTranslation: string;
  issue?: string; replace: boolean; unchanged: boolean;
}
const normalize = (value: string) => value.normalize('NFC').trim().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').toLocaleLowerCase('en');
export const armenianTranslation = (word: WordOccurrenceDto) => word.translations.find(t => ['hy', 'am'].includes(t.languageCode))?.translation ?? '';

export function parseVocabularyImport(input: string): { rows: ImportRow[]; errors: string[] } {
  if (input.length > 200_000) return { rows: [], errors: ['Keep the import below 200 KB.'] };
  const source = input.replace(/^\uFEFF/, '').trim();
  if (!source) return { rows: [], errors: ['Paste words and Armenian translations, or choose a CSV file.'] };
  const lines = source.split(/\r?\n/).filter(line => line.trim());
  const arrow = lines.every(line => line.includes('→'));
  const parsed = arrow ? { data: lines.map(line => { const at = line.indexOf('→'); return [line.slice(0, at), line.slice(at + 1)]; }), errors: [] }
    : Papa.parse<string[]>(source, { skipEmptyLines: 'greedy', delimitersToGuess: [',', '\t', ';'] });
  const errors = parsed.errors.filter(error => error.code !== 'UndetectableDelimiter').map(error => `Unable to read CSV: ${error.message}`);
  const data = parsed.data;
  const header = data[0]?.map(normalize);
  const hasHeader = header && ['word', 'phrase', 'term', 'english', 'word / phrase'].includes(header[0]) && ['translation', 'armenian', 'hy', 'armenian translation'].includes(header[1]);
  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  data.slice(hasHeader ? 1 : 0).forEach((columns, index) => {
    const line = index + (hasHeader ? 2 : 1);
    const [term, translation] = columns.map(value => value.trim());
    if (columns.length !== 2 || !term || !translation) errors.push(`Row ${line}: provide a word or phrase and its Armenian translation in two columns.`);
    else if (translation.length > 2000) errors.push(`Row ${line}: the translation is too long (maximum 2,000 characters).`);
    else if (seen.has(normalize(term))) errors.push(`Row ${line}: “${term}” appears more than once. Use one row, then choose its occurrences in the preview.`);
    else { rows.push({ line, term, translation }); seen.add(normalize(term)); }
  });
  if (rows.length > 500) errors.push('Import up to 500 rows at a time.');
  if (!rows.length && !errors.length) errors.push('Add at least one row beneath the header.');
  return { rows, errors };
}

export function learningOccurrences(data: OccurrencesResponse): WordOccurrenceDto[] {
  return data.occurrences.filter(word => word.selected).map(word => {
    const last = data.occurrences.find(candidate => candidate.id === word.endOccurrenceId) ?? word;
    const sentence = data.sentences.find(candidate => candidate.id === word.sentenceId);
    return { ...word, charEnd: last.charEnd, speechEndSample: last.speechEndSample,
      text: sentence?.text.slice(word.charStart - sentence.charStart, last.charEnd - sentence.charStart) ?? word.text };
  });
}

export function matchVocabularyImport(rows: ImportRow[], data: OccurrencesResponse) {
  const matches: ImportMatch[] = [];
  const unmatched: ImportRow[] = [];
  const selected = learningOccurrences(data);
  for (const row of rows) {
    const before = matches.length;
    data.sentences.forEach((sentence, sentenceIndex) => {
      const words = data.occurrences.filter(word => word.sentenceId === sentence.id).sort((a, b) => a.charStart - b.charStart);
      for (let start = 0; start < words.length; start++) for (let end = start; end < words.length; end++) {
        const first = words[start], last = words[end];
        const candidate = normalize(sentence.text.slice(first.charStart - sentence.charStart, last.charEnd - sentence.charStart));
        if (candidate.length > normalize(row.term).length) break;
        if (candidate !== normalize(row.term)) continue;
        const overlap = selected.find(word => word.charStart < last.charEnd && word.charEnd > first.charStart &&
          (word.id !== first.id || word.charEnd !== last.charEnd));
        const sameSpan = (first.endOccurrenceId ?? first.id) === last.id;
        const existingTranslation = sameSpan ? armenianTranslation(first) : '';
        const unmapped = words.slice(start, end + 1).some(word => word.mappingStatus !== 'MAPPED');
        matches.push({ key: `${row.line}:${first.id}:${last.id}`, row, first, last, sentence: sentence.text, sentenceNumber: sentenceIndex + 1,
          existingTranslation, replace: !!existingTranslation.trim() && existingTranslation !== row.translation,
          unchanged: first.selected && sameSpan && existingTranslation === row.translation,
          issue: overlap ? `Overlaps “${overlap.text}”. Remove that selection first.` : unmapped ? 'Not aligned to narration.' : undefined });
      }
    });
    if (matches.length === before) unmatched.push(row);
  }
  return { matches, unmatched };
}

export function importMatchesOverlap(matches: ImportMatch[]) {
  const sorted = [...matches].sort((a, b) => a.first.charStart - b.first.charStart);
  return sorted.some((match, index) => index > 0 && match.first.charStart < sorted[index - 1].last.charEnd);
}
