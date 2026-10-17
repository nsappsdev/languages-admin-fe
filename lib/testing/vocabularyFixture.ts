import { OccurrencesResponse } from '../textAuthoringTypes';

export const importFixture: OccurrencesResponse = {
  alignmentId: 'alignment-1', draftVersion: 4, status: 'OK',
  sentences: [{ id: 's1', text: 'We look after cats. Look after cats.', charStart: 0, charEnd: 36, occurrenceIds: [0, 1, 2, 3, 4, 5, 6] }],
  occurrences: [...'We look after cats. Look after cats.'.matchAll(/\p{L}+/gu)].map((match, ordinal) => ({
    id: `word-${ordinal}`, ordinal, text: match[0], charStart: match.index!, charEnd: match.index! + match[0].length,
    sentenceId: 's1', mappingStatus: 'MAPPED', selected: false, entryId: null, translations: [], clipAssetId: null,
    speechStartSample: ordinal * 100, speechEndSample: ordinal * 100 + 80, cutStartSample: null, cutEndSample: null,
  })),
};
