import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReaderPublication } from '../ReaderPublication';
const request = jest.fn();
const invalidateQueries = jest.fn();
jest.mock('../../../hooks/useApiClient', () => ({ useApiClient: () => ({ request }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }));
beforeEach(() => { request.mockReset(); invalidateQueries.mockReset(); });

it('requires every saved text to be approved before requesting publication', async () => {
  request.mockResolvedValueOnce({ lesson: { items: [{ id: 'text-1' }] } }).mockResolvedValueOnce({ text: { approvedTextReleaseId: null } });
  render(<ReaderPublication lessonId="lesson-1" />);
  fireEvent.click(screen.getByRole('button', { name: 'Publish to mobile' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Approve every saved text'));
  expect(request).toHaveBeenCalledTimes(2);
});
it('publishes exactly the approved versions returned by the server', async () => {
  request.mockResolvedValueOnce({ lesson: { items: [{ id: 'text-1' }] } }).mockResolvedValueOnce({ text: { approvedTextReleaseId: 'release-1' } }).mockResolvedValueOnce({ publicationId: 'pub-1' });
  render(<ReaderPublication lessonId="lesson-1" />);
  fireEvent.click(screen.getByRole('button', { name: 'Publish to mobile' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('available in the learning app'));
  expect(request).toHaveBeenLastCalledWith('/admin/lessons/lesson-1/reader-publications', { method: 'POST', body: JSON.stringify({ textReleaseIds: ['release-1'] }) });
});
