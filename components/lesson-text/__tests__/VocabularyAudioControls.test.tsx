import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VocabularyAudioControls } from '../VocabularyAudioControls';

const mockRequest = jest.fn();
const mockBusy = jest.fn();
let mockJob: { job?: unknown };
jest.mock('../../../hooks/useApiClient', () => ({ useApiClient: () => ({ request: mockRequest }) }));
jest.mock('../../../hooks/useAudioJob', () => ({ useAudioJob: () => ({ data: mockJob }) }));
jest.mock('../../vocabulary/RecordingPreview', () => ({ RecordingPreview: () => <audio aria-label="Saved word preview" /> }));
const plan = { draftVersion: 8, reuseCount: 1, generateCount: 1, audioGenerationConfigured: true, entries: [
  { entryId: 'one', text: 'bus stop', translation: 'կանգառ', recordingId: 'saved', assetId: 'saved-audio' },
  { entryId: 'two', text: 'shelter', translation: 'ապաստարան', recordingId: null, assetId: null },
] };
function mount(disabled = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><VocabularyAudioControls lessonId="lesson" textId="text" draftVersion={8} disabled={disabled} onBusyChange={mockBusy} /></QueryClientProvider>);
}
beforeEach(() => { jest.clearAllMocks(); mockJob = {}; mockRequest.mockImplementation(async (_url, options) => options?.method === 'POST' ? { job: { id: 'word-job', status: 'QUEUED' } } : plan); });

it('shows reuse and generation decisions before queuing one explicit job', async () => {
  mount();
  expect(mockRequest).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Check vocabulary audio' }));
  await screen.findByText('1 entries can reuse audio · 1 new recordings needed');
  expect(screen.getByText('Reuse saved audio')).toBeInTheDocument();
  expect(screen.getByText('Generate new audio')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Listen' }));
  expect(screen.getByLabelText('Saved word preview')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reuse saved audio & generate 1 new recordings' }));
  await waitFor(() => expect(mockBusy).toHaveBeenCalledWith(true));
  expect(mockRequest).toHaveBeenCalledWith('/admin/lessons/lesson/texts/text/vocabulary/audio-jobs', expect.objectContaining({ method: 'POST',
    headers: { 'Idempotency-Key': expect.any(String) }, body: JSON.stringify({ expectedDraftVersion: 8 }) }));
  expect(screen.getByRole('button', { name: /Reuse saved audio & generate/ })).toBeDisabled();
});

it('allows all saved recordings to be reused without provider configuration', async () => {
  mockRequest.mockResolvedValue({ ...plan, generateCount: 0, reuseCount: 2, audioGenerationConfigured: false });
  mount(); await userEvent.click(screen.getByRole('button', { name: 'Check vocabulary audio' }));
  expect(await screen.findByRole('button', { name: 'Use saved vocabulary audio' })).toBeEnabled();
});

it('blocks changes when translations or the source text are unsaved', () => {
  mount(true); expect(screen.getByRole('button', { name: 'Check vocabulary audio' })).toBeDisabled();
  expect(mockRequest).not.toHaveBeenCalled();
});

it('shows the reuse and generation totals after a finished job', () => {
  mockJob = { job: { id: 'job', status: 'SUCCEEDED', resultId: JSON.stringify({ reusedCount: 3, generatedCount: 2 }) } };
  mount(); expect(screen.getByRole('status')).toHaveTextContent('3 entries reused saved audio; 2 new recordings generated');
});
