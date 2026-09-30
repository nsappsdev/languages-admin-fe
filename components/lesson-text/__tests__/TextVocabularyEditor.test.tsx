import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextVocabularyEditor } from '../TextVocabularyEditor';
import { WordOccurrenceDto } from '../../../lib/textAuthoringTypes';

jest.mock('../../../hooks/useAudioAsset', () => ({
  useAudioAsset: () => ({ url: 'blob:automated-test-clip', error: null, isLoading: false }),
}));

const occurrence: WordOccurrenceDto = {
  id: 'cat-first', text: 'cat', ordinal: 1, sentenceId: 's1', charStart: 4, charEnd: 7,
  speechStartSample: 100, speechEndSample: 200, cutStartSample: null, cutEndSample: null,
  selected: true, entryId: 'entry-first', mappingStatus: 'MAPPED', clipAssetId: 'clip-first',
  translations: [{ id: 'translation-first', languageCode: 'am', translation: 'կատու' }],
};

function setup() {
  const onSaveTranslation = jest.fn();
  render(<TextVocabularyEditor selectedOccurrences={[occurrence]} sentences={[{ id: 's1', text: 'The cat sat.', charStart: 0, charEnd: 12, occurrenceIds: [1] }]}
    onSaveTranslation={onSaveTranslation} onExtractClips={jest.fn()} isExtracting={false} savingEntryId={null}
    focusedOccurrenceId={null} focusRequest={0} onRemove={jest.fn()} isSelecting={false} />);
  return { onSaveTranslation, audio: screen.getByTestId('clip-player-cat-first') as HTMLAudioElement };
}

it('uses real media metadata and media events for the compact clip control', async () => {
  const { audio } = setup();
  expect(screen.getByRole('button', { name: /play clip for cat/i }).textContent).toContain('Clip');
  Object.defineProperty(audio, 'duration', { value: 0.325, configurable: true });
  fireEvent.loadedMetadata(audio);
  expect(screen.getByRole('button', { name: /play clip for cat/i }).textContent).toContain('0.33s');

  const play = jest.spyOn(audio, 'play').mockResolvedValue(undefined);
  await userEvent.click(screen.getByRole('button', { name: /play clip for cat/i }));
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.play(audio);
  expect(screen.getByRole('button', { name: /pause clip for cat/i })).toBeTruthy();
  fireEvent.ended(audio);
  expect(screen.getByRole('button', { name: /play clip for cat/i })).toBeTruthy();
});

it('reports rejected playback and allows retry', async () => {
  const { audio } = setup();
  jest.spyOn(audio, 'play').mockRejectedValue(new Error('Playback rejected'));
  await userEvent.click(screen.getByRole('button', { name: /play clip for cat/i }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not play'));
  expect((screen.getByRole('button', { name: /play clip for cat/i }) as HTMLButtonElement).disabled).toBe(false);
});

it('saves the specific occurrence translation with Enter', async () => {
  const { onSaveTranslation } = setup();
  const input = screen.getByRole('textbox', { name: /translation for cat/i });
  await userEvent.clear(input);
  await userEvent.type(input, 'կատվիկ{Enter}');
  expect(onSaveTranslation).toHaveBeenCalledWith('entry-first', 'կատվիկ');
});
