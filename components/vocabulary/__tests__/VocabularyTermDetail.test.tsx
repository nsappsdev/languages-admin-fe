import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VocabularyTermDetail } from '../VocabularyTermDetail';
import { LibraryTerm } from '../../../lib/vocabularyLibraryTypes';

const mockSave = jest.fn();
const mockReload = jest.fn();
const mockAudio = jest.fn((assetId: string) => ({ url: `blob:library-test-${assetId}`, isLoading: false, error: null }));
let mockTerm: LibraryTerm;
jest.mock('../../../hooks/useVocabularyLibrary', () => ({
  useVocabularyTerm: () => ({ data: mockTerm, refetch: mockReload }),
  useVocabularyPreference: () => ({ mutateAsync: mockSave, isPending: false }),
}));
jest.mock('../../../hooks/useAudioAsset', () => ({ useAudioAsset: (assetId: string) => mockAudio(assetId) }));
beforeEach(() => {
  jest.clearAllMocks(); mockSave.mockResolvedValue({ saved: true });
  mockTerm = { id: 'term', text: 'look after', language: 'en', meanings: [{ id: 'meaning', translation: 'հոգ տանել', preferences: [], recordings: [
    { id: 'one', voiceId: 'voice-a', model: 'model', available: true, asset: { id: 'asset-one', frameCount: 24000, sampleRate: 24000 },
      usages: [{ lessonId: 'lesson-a', lessonTitle: 'Morning story', textId: 'text-a', textReleaseId: 'release-a', occurrenceId: 'word-a', sentence: 'We look after the cat.', current: true }] },
    { id: 'two', voiceId: 'voice-a', model: 'model', available: true, asset: { id: 'asset-two', frameCount: 12000, sampleRate: 24000 },
      usages: [{ lessonId: 'lesson-b', lessonTitle: 'Evening story', textId: 'text-b', textReleaseId: 'release-b', occurrenceId: 'word-b', sentence: 'They look after the dog.', current: false }] },
  ] }] };
});

it('loads audio only for the requested preview and keeps lesson provenance visible', async () => {
  render(<VocabularyTermDetail termId="term" />);
  expect(mockAudio).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /^Preview recording 1/ }));
  expect(mockAudio).toHaveBeenCalledWith('asset-one');
  expect(screen.getByLabelText('Recording of look after')).toHaveAttribute('src', 'blob:library-test-asset-one');
  expect(screen.getByRole('link', { name: 'Morning story' })).toHaveAttribute('href', '/dashboard/lessons/lesson-a');
  expect(screen.getByText('Earlier publication')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /^Close recording 1/ }));
  expect(screen.queryByLabelText('Recording of look after')).not.toBeInTheDocument();
});

it('chooses and clears a preferred recording with a conflict guard', async () => {
  const view = render(<VocabularyTermDetail termId="term" />);
  await userEvent.click(screen.getByRole('button', { name: /^Prefer recording 2/ }));
  expect(mockSave).toHaveBeenCalledWith({ meaningId: 'meaning', voiceId: 'voice-a', recordingId: 'two', expectedRecordingId: null });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Preferred recording saved'));
  mockTerm.meanings[0].preferences = [{ voiceId: 'voice-a', recordingId: 'two' }];
  view.rerender(<VocabularyTermDetail termId="term" />);
  await userEvent.click(screen.getByRole('button', { name: 'Use each lesson’s recording' }));
  expect(mockSave).toHaveBeenLastCalledWith({ meaningId: 'meaning', voiceId: 'voice-a', recordingId: null, expectedRecordingId: 'two' });
});

it('reports a stale preference and offers a reload instead of hiding the error', async () => {
  mockSave.mockRejectedValue(new Error('The preferred recording changed. Reload and choose again.'));
  render(<VocabularyTermDetail termId="term" />);
  await userEvent.click(screen.getByRole('button', { name: /^Prefer recording 1/ }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The preferred recording changed'));
  await userEvent.click(screen.getByRole('button', { name: 'Reload recordings' }));
  expect(mockReload).toHaveBeenCalled();
});

it('disables unavailable recordings and reports media decoding failure', async () => {
  mockTerm.meanings[0].recordings[1].available = false;
  render(<VocabularyTermDetail termId="term" />);
  expect(screen.getByRole('button', { name: /^Prefer recording 2/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Preview recording 2/ })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: /^Preview recording 1/ }));
  fireEvent.error(screen.getByLabelText('Recording of look after'));
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to play this recording');
});
