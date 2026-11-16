import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SentenceAudioControls } from '../SentenceAudioControls';
jest.mock('../../vocabulary/RecordingPreview', () => ({ RecordingPreview: () => null }));

it('generates one sentence before any audio exists and distinguishes regeneration', () => {
  const onGenerate = jest.fn();
  const props = { text: 'One sentence. Another sentence.', recordings: [], disabled: false, onSave: jest.fn(), onDirtyChange: jest.fn(), onGenerate };
  const { rerender } = render(<SentenceAudioControls {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate sentence 2' }));
  expect(onGenerate).toHaveBeenCalledWith([14, 31], 1, false);
  fireEvent.click(screen.getByRole('button', { name: 'Generate all sentences' }));
  expect(onGenerate).toHaveBeenLastCalledWith([14, 31]);
  rerender(<SentenceAudioControls {...props} recordings={[{ text: 'One sentence.', charStart: 0, charEnd: 13, assetId: 'sentence-a', startSample: 0, endSample: 100 }]} plannedEnds={[14, 31]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate sentence 1' }));
  expect(onGenerate.mock.calls.at(-1)?.slice(1)).toEqual([0, true]);
});

it('saves a join without generating audio and preserves an unsuccessful save for retry', async () => {
  const onSave = jest.fn().mockRejectedValueOnce(new Error('Please retry')).mockResolvedValueOnce(undefined);
  const onGenerate = jest.fn();
  render(<SentenceAudioControls text="One sentence. Another sentence." recordings={[]} disabled={false} onSave={onSave} onGenerate={onGenerate} onDirtyChange={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Join sentence 1 with next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save sentence breaks' }));
  await screen.findByText('Please retry');
  expect(screen.getByRole('button', { name: 'Save sentence breaks' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save sentence breaks' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave).toHaveBeenCalledWith([31]);
  expect(onGenerate).not.toHaveBeenCalled();
});
