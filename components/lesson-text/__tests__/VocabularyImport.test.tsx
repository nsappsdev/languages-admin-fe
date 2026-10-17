import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VocabularyImport } from '../VocabularyImport';
import { importFixture } from '../../../lib/testing/vocabularyFixture';

function setup(data = importFixture, onImport = jest.fn().mockResolvedValue({ importedCount: 2 })) {
  const props = { data, onImport, onClose: jest.fn(), onDirtyChange: jest.fn(), pending: false };
  const view = render(<VocabularyImport {...props} />);
  return { ...view, props, onImport, user: userEvent.setup() };
}

it('previews pasted pairs, lets the admin choose a repeated occurrence, and applies one atomic request', async () => {
  const { user, onImport } = setup();
  await user.type(screen.getByRole('textbox'), 'look after → հոգ տանել');
  expect(onImport).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Preview matches' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  await user.click(screen.getAllByRole('checkbox')[1]);
  await user.click(screen.getByRole('button', { name: 'Import 1 entry' }));
  expect(onImport).toHaveBeenCalledWith({ alignmentId: 'alignment-1', expectedDraftVersion: 4,
    entries: [{ occurrenceId: 'word-1', endOccurrenceId: 'word-2', translation: 'հոգ տանել' }] });
  expect(await screen.findByRole('status')).toHaveTextContent('Imported 1 learning entry');
});

it('uploads CSV and does not silently overwrite an existing Armenian translation', async () => {
  const data = JSON.parse(JSON.stringify(importFixture)) as typeof importFixture;
  Object.assign(data.occurrences[1], { selected: true, endOccurrenceId: 'word-2', translations: [{ id: 't', languageCode: 'hy', translation: 'խնամել' }] });
  const { user } = setup(data);
  const file = new File(['word,translation\nlook after,հոգ տանել'], 'vocabulary.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => 'word,translation\nlook after,հոգ տանել' });
  await user.upload(screen.getByLabelText('Upload vocabulary CSV'), file);
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('word,translation\nlook after,հոգ տանել'));
  await user.click(screen.getByRole('button', { name: 'Preview matches' }));
  expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
  expect(screen.getByText('Replace “խնամել”')).toBeInTheDocument();
});

it('blocks stale previews and overlaps, and preserves input after a server error', async () => {
  const onImport = jest.fn().mockRejectedValue(new Error('The server is unavailable. Try again.'));
  const { user, rerender, props } = setup(importFixture, onImport);
  await user.type(screen.getByRole('textbox'), 'look after → հոգ տանել');
  await user.click(screen.getByRole('button', { name: 'Preview matches' }));
  rerender(<VocabularyImport {...props} data={{ ...importFixture, draftVersion: 5 }} />);
  expect(screen.getByRole('button', { name: 'Import 2 entries' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Refresh preview' }));
  await user.click(screen.getByRole('button', { name: 'Import 2 entries' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('server is unavailable');
  expect(screen.getByRole('textbox')).toHaveValue('look after → հոգ տանել');
  await user.type(screen.getByRole('textbox'), '\nafter → հետո');
  await user.click(screen.getByRole('button', { name: 'Preview matches' }));
  expect(screen.getByRole('button', { name: 'Import 4 entries' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('overlap');
});
