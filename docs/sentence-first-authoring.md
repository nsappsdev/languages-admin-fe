# Sentence-first editor — 2026-11-14

The workflow is save title/description/text, review and save sentence breaks, then generate all sentences or any individual sentence. Full-text audio controls are removed. Recorded sentences have Listen and Regenerate actions; unrecorded sentences have Generate sentence. Sentence timing issues and uncertain requests identify the affected sentence.

Learning words and phrases immediately shows the saved text with selectable words. Import is active before audio exists, matches repeated words/phrases against the source, highlights imported selections, and reports unmatched rows and missing translations without blocking valid rows. The arbitrary 500-row/occurrence limit is removed; existing file-size and translation-size validation remains. Replacing a saved translation still requires checking it in the preview.

Word & phrase audio now offers “Prepare audio from sentences”. It extracts each selected occurrence from its own sentence recording and reports extraction/reuse totals. It requires completed sentence audio and valid timing, but no provider configuration or new speech request. Existing standalone recordings are not used for sentence lessons. The local “14 law” was updated with 13 extracted clips and unchanged sentence audio after the tone mismatch was reported.

Validated with TypeScript, ESLint, Next.js production build, and 74 tests. Local browser checks imported two phrase occurrences before audio, reported one unmatched and one untranslated row, confirmed both highlights and saved Armenian translations, and saved a join independently of generation. Local backend/database use the new sentence-first migration; production is unchanged. The companion mobile update is required for version 3 publications.
