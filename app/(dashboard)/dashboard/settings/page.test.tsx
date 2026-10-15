import { fireEvent, render, screen } from '@testing-library/react';
import SettingsPage from './page';

const mutate = jest.fn();
const mockSettingsData = { settings: { wordRepetitionPauseMs: 800 } };
jest.mock('../../../../hooks/useSettings', () => ({ useSettings: () => ({
  data: mockSettingsData, isLoading: false, isError: false,
}) }));
jest.mock('../../../../hooks/useSettingsMutations', () => ({ useSettingsMutations: () => ({ updateSettings: { mutate, isPending: false, isError: false } }) }));
beforeEach(() => mutate.mockReset());

it('saves the 400 ms preset in milliseconds without changing repetition counts', () => {
  render(<SettingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Use 400 ms' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(mutate.mock.calls[0][0]).toMatchObject({ wordRepetitionPauseMs: 400,
    readingModes: [{ id: 'introduction' }, { id: 'teaching', unknownWordRepetitions: 5 }, { id: 'deep_learning', unknownWordRepetitions: 5, sentenceRepetitions: 2 }] });
  expect(screen.getByText('0.40 s')).toBeInTheDocument();
});

it.each(['', '-1', '3001', '12.5'])('prevents saving an invalid pause %s', value => {
  render(<SettingsPage />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pause between repeated words (milliseconds)' }), { target: { value } });
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('0 to 3000');
  expect(mutate).not.toHaveBeenCalled();
});

it('allows zero without silently replacing it with the default pause', () => {
  render(<SettingsPage />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pause between repeated words (milliseconds)' }), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(mutate.mock.calls[0][0].wordRepetitionPauseMs).toBe(0);
});
