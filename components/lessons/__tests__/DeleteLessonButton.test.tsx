import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeleteLessonButton } from '../DeleteLessonButton';
import { ApiError } from '../../../hooks/useApiClient';

const request = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
jest.mock('../../../hooks/useApiClient', () => ({ ...jest.requireActual('../../../hooks/useApiClient'), useApiClient: () => ({ request }) }));

function setup(disabled = false) {
  const queries = new QueryClient();
  queries.setQueryData(['lesson', 'lesson-1'], { lesson: { id: 'lesson-1' } });
  const invalidate = jest.spyOn(queries, 'invalidateQueries');
  render(<QueryClientProvider client={queries}><DeleteLessonButton lessonId="lesson-1" title="A different way home" disabled={disabled} /></QueryClientProvider>);
  return { queries, invalidate };
}
beforeEach(() => { request.mockReset(); replace.mockReset(); });

it('requires confirmation, explains retention and lets the admin cancel without deleting', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Delete lesson' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete lesson?' });
  expect(dialog).toHaveTextContent('A different way home');
  expect(dialog).toHaveTextContent('Shared vocabulary recordings and saved learning history will be kept.');
  expect(request).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete lesson' })).toHaveFocus();
  expect(request).not.toHaveBeenCalled();
});

it('deletes once, blocks dismissal while pending, clears cached detail and returns to the list', async () => {
  let finish!: (value: unknown) => void;
  request.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { queries, invalidate } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Delete lesson' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete lesson' }));
  const pending = within(dialog).getByRole('button', { name: 'Working...' });
  expect(pending).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await userEvent.click(pending);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith('/lessons/lesson-1', { method: 'DELETE' });
  expect(replace).not.toHaveBeenCalled();
  finish(null);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/lessons'));
  expect(queries.getQueryData(['lesson', 'lesson-1'])).toBeUndefined();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['lessons'] });
});

it('keeps server failures visible inside the dialog and allows a retry', async () => {
  request.mockRejectedValueOnce(new ApiError('Audio is still being prepared.', 409, {})).mockResolvedValueOnce(null);
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Delete lesson' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete lesson' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Audio is still being prepared.');
  expect(replace).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete lesson' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/lessons'));
  expect(request).toHaveBeenCalledTimes(2);
});

it('handles a lesson already deleted by another admin', async () => {
  request.mockRejectedValue(new ApiError('Lesson not found', 404, {}));
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Delete lesson' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete lesson' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/lessons'));
});

it('does not open during another lesson operation and supports Escape cancellation', async () => {
  const { unmount } = render(<QueryClientProvider client={new QueryClient()}><DeleteLessonButton lessonId="lesson-1" title="Lesson" disabled /></QueryClientProvider>);
  expect(screen.getByRole('button', { name: 'Delete lesson' })).toBeDisabled();
  unmount(); setup();
  await userEvent.click(screen.getByRole('button', { name: 'Delete lesson' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});
