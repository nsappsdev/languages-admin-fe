# Languages admin

Create a lesson with one or more texts. Save and explicitly generate ElevenLabs narration, select word occurrences, add Armenian translations, then publish once. Publication prepares missing word clips from the full narration and makes the lesson available immediately in the learning app.

`NEXT_PUBLIC_API_BASE_URL` selects the API. Provider credentials belong only on the server. Use `npm test`, `npm run lint`, `npm run build`, and `npx tsc --noEmit` to verify changes. See [the backend authoring contract](../backend/AUDIO_AUTHORING.md).

## Vocabulary workspace

After narration is aligned, use **Import words & translations** to paste two spreadsheet columns, `word → Armenian translation` pairs, or a UTF-8 CSV with `word,translation` columns (optional header). The preview matches whole words and consecutive phrases in the current text, ignoring case and whitespace differences. Every repeated occurrence has its own checkbox and sentence context. Existing differing translations are unchecked by default; unmatched rows and overlapping selections are reported before import. One request applies up to 500 selected occurrences atomically. If another edit changes the draft, refresh the preview.

For manual phrases, choose **Select a phrase**, click its first and last words in one sentence, then **Add phrase**. Remove overlapping selected words first. A phrase has one translation and one repetition span, extracted from the existing narration when publishing. No extra provider request is needed. Changing a saved range clears its old meaning; previously published lessons remain immutable.

Lesson details, individual texts, and completed vocabulary entries can collapse. Search words or Armenian translations, or show only entries missing translations. Filtering and collapsing preserve unsaved translation drafts and keep publication blocked until they are saved.

The matching backend branch requires migration `20261017090000_vocabulary_phrase_ranges` before these features are used. Existing single-word selections and the schema-version-2 learner API remain supported.
