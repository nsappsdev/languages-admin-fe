import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OccurrenceSelection } from '../OccurrenceSelection';
import { OccurrencesResponse, WordOccurrenceDto } from '../../../lib/textAuthoringTypes';

const word = (id: string, ordinal: number, sentenceId: string, charStart: number, selected: boolean): WordOccurrenceDto => ({
  id, ordinal, sentenceId, charStart, charEnd: charStart + 3, text: 'cat', selected,
  mappingStatus: 'MAPPED', speechStartSample: 0, speechEndSample: 10, cutStartSample: null, cutEndSample: null,
  entryId: selected ? `entry-${id}` : null, translations: [], clipAssetId: null,
});

const alignment: OccurrencesResponse = {
  alignmentId: 'alignment-current', status: 'OK',
  sentences: [
    { id: 's1', text: 'The cat sat.', charStart: 0, charEnd: 12, occurrenceIds: [1] },
    { id: 's2', text: 'A cat watched.', charStart: 13, charEnd: 27, occurrenceIds: [5] },
  ],
  occurrences: [word('cat-first', 1, 's1', 4, false), word('cat-second', 5, 's2', 15, true)],
};

it('renders the two aligned sentences with their punctuation and separate repeated occurrences', async () => {
  const onToggle = jest.fn();
  const onFocusOccurrence = jest.fn();
  render(<OccurrenceSelection occurrences={alignment} pendingOccurrenceId={null} focusedOccurrenceId={null} onToggle={onToggle} onFocusOccurrence={onFocusOccurrence} />);
  const first = screen.getByRole('region', { name: 'Sentence 1' });
  const second = screen.getByRole('region', { name: 'Sentence 2' });
  expect(first.textContent).toContain('The cat sat.');
  expect(first.textContent).not.toContain('watched');
  expect(second.textContent).toContain('A cat watched.');
  await userEvent.click(within(first).getByRole('button', { name: /select occurrence/i }));
  expect(onToggle).toHaveBeenCalledWith('cat-first', true);
  await userEvent.click(within(second).getByRole('button', { name: /show occurrence/i }));
  expect(onFocusOccurrence).toHaveBeenLastCalledWith('cat-second');
  expect(onToggle).toHaveBeenCalledTimes(1); // focusing an existing selection must not deselect it
});

it('keeps sentences readable while review blocks selection', () => {
  render(<OccurrenceSelection occurrences={{ ...alignment, status: 'NEEDS_REVIEW' }} pendingOccurrenceId={null} focusedOccurrenceId={null} onToggle={jest.fn()} onFocusOccurrence={jest.fn()} />);
  expect(screen.getByRole('region', { name: 'Sentence 2' }).textContent).toContain('A cat watched.');
  expect(screen.getByText(/manual alignment correction is not available/i)).toBeTruthy();
  for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
});

it('blocks another selection while a selection request is pending', () => {
  render(<OccurrenceSelection occurrences={alignment} pendingOccurrenceId="cat-first" focusedOccurrenceId={null} onToggle={jest.fn()} onFocusOccurrence={jest.fn()} />);
  for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
});

it('keeps immediately trailing punctuation with its word without changing selection identity or sentence text', async () => {
  const onToggle = jest.fn();
  const punctuated: OccurrencesResponse = {
    ...alignment,
    sentences: [{ id: 's1', text: 'Cat, cat.', charStart: 0, charEnd: 9, occurrenceIds: [0, 1] }],
    occurrences: [word('cat-one', 0, 's1', 0, false), word('cat-two', 1, 's1', 5, false)],
  };
  render(<OccurrenceSelection occurrences={punctuated} pendingOccurrenceId={null} focusedOccurrenceId={null} onToggle={onToggle} onFocusOccurrence={jest.fn()} />);
  const first = screen.getByRole('button', { name: /position 0/i });
  const last = screen.getByRole('button', { name: /position 1/i });
  expect(first.parentElement?.className).toContain('whitespace-nowrap');
  expect(first.parentElement?.textContent).toBe('Cat,');
  expect(last.parentElement?.textContent).toBe('cat.');
  expect(last.parentElement?.parentElement?.textContent).toBe('Cat, cat.');
  expect(last.textContent).toBe('cat');
  await userEvent.click(last);
  expect(onToggle).toHaveBeenCalledWith('cat-two', true);
});
