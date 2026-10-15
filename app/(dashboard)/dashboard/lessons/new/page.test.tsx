import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const pushMock = jest.fn();
const requestMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock('../../../../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    request: requestMock,
  }),
}));

const NewLessonPage = require('./page').default;

describe('NewLessonPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    requestMock.mockReset();
  });

  it('creates a lesson from item text without requiring manual phrase timings', async () => {
    requestMock.mockResolvedValue({ lesson: { id: 'lesson-1' } });

    render(<NewLessonPage />);

    expect(screen.queryByText('Initialize whole text')).toBeNull();
    expect(screen.queryByText('Phrase Timings')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'New lesson' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
      target: { value: 'A full pasted lesson text.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create lesson' }));

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith(
        '/lessons',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    const [, options] = requestMock.mock.calls[0];
    const payload = JSON.parse(String(options.body));
    expect(payload.items).toEqual([{ text: 'A full pasted lesson text.' }]);
    expect(payload.status).toBeUndefined();
    expect(pushMock).toHaveBeenCalledWith('/dashboard/lessons/lesson-1');
  });
});
