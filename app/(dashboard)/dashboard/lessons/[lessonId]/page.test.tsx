import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LessonDetailPage from './page';
import { ApiError } from '../../../../../hooks/useApiClient';

const request = jest.fn();
const update = jest.fn();
const replace = jest.fn();
const lesson = { id: 'lesson-1', title: 'Test lesson', description: '', currentPublicationId: null as string | null, items: [{ id: 'text-1', text: 'A cat.', order: 0 }] };
jest.mock('next/navigation', () => ({ useParams: () => ({ lessonId: 'lesson-1' }), useRouter: () => ({ replace }) }));
jest.mock('../../../../../hooks/useLesson', () => ({ useLesson: () => ({ data: { lesson }, isLoading: false }) }));
jest.mock('../../../../../hooks/useLessonMutations', () => ({ useLessonMutations: () => ({ updateLesson: { mutateAsync: update, isPending: false }, createItem: { isPending: false } }) }));
jest.mock('../../../../../hooks/useApiClient', () => ({ ...jest.requireActual('../../../../../hooks/useApiClient'), useApiClient: () => ({ request }) }));
jest.mock('../../../../../components/lesson-text/TextAuthoringPanel', () => ({ TextAuthoringPanel: ({ onBusyChange }: { onBusyChange: (id: string, busy: boolean) => void }) => <button onClick={() => onBusyChange('text-1', true)}>Make unsaved text edit</button> }));
function setup() { return render(<QueryClientProvider client={new QueryClient()}><LessonDetailPage /></QueryClientProvider>); }
beforeEach(() => { request.mockReset(); update.mockReset(); update.mockResolvedValue({}); lesson.currentPublicationId = null; });
it('publishes with one endpoint and no release IDs, after saving metadata', async () => {
  request.mockResolvedValue({ publicationId: 'published' }); setup();
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
  await screen.findByText(/now available in the learning app/);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith('/admin/lessons/lesson-1/publish', { method: 'POST', body: '{}' });
  expect(update).toHaveBeenCalledWith({ lessonId: 'lesson-1', data: { title: 'Test lesson', description: '' } });
});
it('shows progress and disables duplicate clicks for the whole operation', async () => {
  let finish!: (value: unknown) => void;
  request.mockReturnValue(new Promise(resolve => { finish = resolve; })); setup();
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
  const pending = await screen.findByRole('button', { name: 'Preparing clips and publishing…' });
  expect(pending).toBeDisabled(); await userEvent.click(pending); expect(request).toHaveBeenCalledTimes(1);
  finish({}); await screen.findByText(/now available in the learning app/);
});
it('highlights the text returned in structured readiness errors', async () => {
  request.mockRejectedValue(new ApiError('Complete the highlighted texts', 422, { texts: [{ textId: 'text-1', order: 0, message: 'Add an Armenian translation.' }] })); setup();
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
  expect(await screen.findByText('Add an Armenian translation.')).toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'Text 1' })).toHaveClass('border-rose-400');
});
it('blocks publication of unsaved text and offers update/unpublish for an existing publication', async () => {
  lesson.currentPublicationId = 'existing'; setup();
  expect(screen.getByRole('button', { name: 'Unpublish lesson' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Make unsaved text edit' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Update published lesson' })).toBeDisabled());
  expect(request).not.toHaveBeenCalled();
});
