import { importMatchesOverlap, learningOccurrences, matchVocabularyImport, parseVocabularyImport } from './vocabularyImport';
import { importFixture } from './testing/vocabularyFixture';


it('reads quoted CSV, BOM, headers, spreadsheet tabs and arrow pairs without damaging Armenian', () => {
  expect(parseVocabularyImport('\uFEFFword,translation\r\n"look after","հոգ տանել, խնամել"').rows[0]).toMatchObject({ term: 'look after', translation: 'հոգ տանել, խնամել' });
  for (const separator of ['\t', ' → ']) expect(parseVocabularyImport(`look after${separator}հոգ տանել`).rows[0].translation).toBe('հոգ տանել');
  expect(parseVocabularyImport('word,translation\nlook after,հոգ տանել').errors).toEqual([]);
});

it('reports malformed, empty, duplicate and oversized imports before matching', () => {
  for (const input of ['', 'cat', 'cat,', 'cat,կատու,extra', 'cat,կատու\nCAT,այլ', 'word,translation', 'x'.repeat(200001)])
    expect(parseVocabularyImport(input).errors.length).toBeGreaterThan(0);
});

it('matches whole phrases case-insensitively and lists repeated occurrences separately', () => {
  const parsed = parseVocabularyImport('look after → հոգ տանել\ncat → կատու');
  const result = matchVocabularyImport(parsed.rows, importFixture);
  expect(result.matches.map(match => [match.first.id, match.last.id])).toEqual([['word-1', 'word-2'], ['word-4', 'word-5']]);
  expect(result.unmatched.map(row => row.term)).toEqual(['cat']); // never match a substring inside cats
});

it('marks existing translation replacements and selected-range conflicts', () => {
  const data = JSON.parse(JSON.stringify(importFixture)) as typeof importFixture;
  Object.assign(data.occurrences[1], { selected: true, endOccurrenceId: 'word-2', entryId: 'entry-1', translations: [{ id: 't', languageCode: 'hy', translation: 'խնամել' }] });
  const rows = parseVocabularyImport('look after → հոգ տանել\nafter → հետո').rows;
  const result = matchVocabularyImport(rows, data);
  expect(result.matches[0].replace).toBe(true);
  expect(result.matches.find(match => match.first.id === 'word-2')?.issue).toContain('Overlaps');
  expect(learningOccurrences(data)[0].text).toBe('look after');
  expect(importMatchesOverlap(result.matches)).toBe(true);
});

it('does not match a phrase across sentence boundaries', () => {
  const data = JSON.parse(JSON.stringify(importFixture)) as typeof importFixture;
  data.sentences = [{ id: 's1', text: 'Look.', charStart: 0, charEnd: 5, occurrenceIds: [0] }, { id: 's2', text: 'After.', charStart: 6, charEnd: 12, occurrenceIds: [1] }];
  data.occurrences = [{ ...data.occurrences[0], text: 'Look', charStart: 0, charEnd: 4 }, { ...data.occurrences[1], text: 'After', sentenceId: 's2', charStart: 6, charEnd: 11 }];
  expect(matchVocabularyImport(parseVocabularyImport('look after → հոգ տանել').rows, data).matches).toEqual([]);
});
