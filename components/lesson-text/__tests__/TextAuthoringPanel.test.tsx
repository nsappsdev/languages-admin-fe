import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AuthProvider } from '../../providers/AuthProvider';
import { TextAuthoringPanel } from '../TextAuthoringPanel';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    blob: async () => new Blob(['fake-audio-bytes']),
  } as unknown as Response;
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AuthProvider>
    );
  };
}

/** A tiny in-memory fake server so refetches after mutations see updated state. */
function createFakeServer() {
  const state = {
    contentRevision: { id: 'rev-1', text: 'Hello world.' } as null | { id: string; text: string },
    narration: null as null | { id: string; assetId: string; provider: string; model: string; voiceId: string; createdAt: string },
    alignmentId: null as string | null,
    entries: {} as Record<string, { selected: boolean; translations: { languageCode: string; translation: string }[]; clipAssetId: string | null }>,
  };

  const OCCURRENCE_ID = 'occ-1';

  const handle = async (url: string, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.endsWith('/admin/lessons/lesson-1/texts/item-1') && method === 'GET') {
      return jsonResponse(200, {
        text: {
          id: 'item-1',
          lessonId: 'lesson-1',
          draftVersion: 1,
          contentRevision: state.contentRevision,
          narration: state.narration,
          alignmentSummary: state.alignmentId ? { id: state.alignmentId, status: 'OK' } : null,
          audioGenerationConfigured: true,
        },
      });
    }

    if (url.includes('/content-revisions') && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      state.contentRevision = { id: 'rev-1', text: body.text };
      return jsonResponse(201, { revision: { id: 'rev-1', textId: 'item-1', sequence: 1, text: body.text, textSha256: 'x', sourceLanguage: 'en' }, textVersion: 2 });
    }

    if (url.includes('/narration-jobs') && method === 'POST') {
      state.narration = { id: 'narration-1', assetId: 'asset-narration-1', provider: 'elevenlabs', model: 'eleven_multilingual_v2', voiceId: 'v1', createdAt: new Date().toISOString() };
      state.alignmentId = 'alignment-1';
      state.entries[OCCURRENCE_ID] = { selected: false, translations: [], clipAssetId: null };
      return jsonResponse(202, { job: { id: 'job-narration-1', status: 'QUEUED' }, replay: false });
    }

    if (url.includes('/audio-jobs/job-narration-1') && method === 'GET') {
      return jsonResponse(200, { job: { id: 'job-narration-1', textId: 'item-1', kind: 'GENERATE_NARRATION', status: 'SUCCEEDED', attempt: 1, resultAssetId: 'asset-narration-1', resultId: 'alignment-1', error: null } });
    }

    if (url.includes('/occurrences') && method === 'GET') {
      const entry = state.entries[OCCURRENCE_ID];
      return jsonResponse(200, {
        alignmentId: state.alignmentId,
        status: 'OK',
        sentences: [{ id: 'sentence-0', text: 'Hello world.', charStart: 0, charEnd: 12, occurrenceIds: [0] }],
        occurrences: [
          {
            id: OCCURRENCE_ID,
            ordinal: 0,
            text: 'Hello',
            charStart: 0,
            charEnd: 5,
            sentenceId: 'sentence-0',
            speechStartSample: 0,
            speechEndSample: 100,
            cutStartSample: null,
            cutEndSample: null,
            mappingStatus: 'MAPPED',
            entryId: entry?.selected ? 'entry-1' : null,
            selected: entry?.selected ?? false,
            translations: entry?.translations.map((t, i) => ({ id: `tr-${i}`, ...t })) ?? [],
            clipAssetId: entry?.clipAssetId ?? null,
          },
        ],
      });
    }

    if (url.includes('/selection') && method === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      const change = body.changes[0];
      state.entries[change.occurrenceId] = {
        selected: change.selected,
        translations: state.entries[change.occurrenceId]?.translations ?? [],
        clipAssetId: state.entries[change.occurrenceId]?.clipAssetId ?? null,
      };
      return jsonResponse(200, { entries: [] });
    }

    if (url.includes('/vocabulary/entry-1') && method === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      state.entries[OCCURRENCE_ID].translations = body.translations;
      return jsonResponse(200, { entry: {} });
    }

    if (url.includes('/audio-assets/') && url.includes('/content')) {
      return jsonResponse(200, {});
    }

    if (url.includes('/readiness') && method === 'GET') {
      const entry = state.entries[OCCURRENCE_ID];
      const selected = entry?.selected ? 1 : 0;
      const hasTranslation = Boolean(entry?.translations.length);
      const hasClip = Boolean(entry?.clipAssetId);
      return jsonResponse(200, {
        readiness: {
          narrationValid: Boolean(state.narration),
          alignmentStatus: state.alignmentId ? 'OK' : 'MISSING',
          selectedCount: selected,
          selectedMissingTranslationCount: selected && !hasTranslation ? 1 : 0,
          selectedMissingClipCount: selected && !hasClip ? 1 : 0,
          eligibleEntryIds: selected && hasTranslation && hasClip ? ['entry-1'] : [],
          canPublish: Boolean(state.narration) && (!selected || hasTranslation),
          readyForPublication: Boolean(state.narration) && (!selected || (hasTranslation && hasClip)),
          reasonCodes: !state.narration ? ['NARRATION_MISSING'] : !selected ? ['NO_WORDS_SELECTED'] : [],
        },
      });
    }

    throw new Error(`Unhandled fake server request: ${method} ${url}`);
  };

  return { handle, state, OCCURRENCE_ID };
}

describe('TextAuthoringPanel', () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('saves and explicitly generates, selects one occurrence, and saves an Armenian translation without separate approval or clip actions', async () => {
    const server = createFakeServer();
    fetchMock.mockImplementation(((input: RequestInfo | URL, init?: RequestInit) => server.handle(String(input), init)) as typeof fetch);
    const onBusyChange = jest.fn();
    const user = userEvent.setup();
    render(<TextAuthoringPanel lessonId="lesson-1" textId="item-1" onBusyChange={onBusyChange} />, { wrapper: createWrapper() });
    const generate = await screen.findByRole('button', { name: 'Save and generate narration' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('narration-jobs'))).toBe(false);
    await user.click(generate);
    const select = await screen.findByRole('button', { name: /select occurrence "hello"/i });
    expect(select.getAttribute('aria-pressed')).toBe('false');
    await user.click(select);
    const input = await screen.findByRole('textbox', { name: /translation for hello/i });
    await user.type(input, 'բարեւ');
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith('item-1', true));
    await user.click(screen.getByRole('button', { name: /save translation/i }));
    await waitFor(() => expect(server.state.entries['occ-1'].translations).toEqual([{ languageCode: 'hy', translation: 'բարեւ' }]));
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith('item-1', false));
    expect(await screen.findByText('Ready to publish')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve|extract/i })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => /clip-jobs|releases/.test(String(url)))).toBe(false);
    const text = screen.getByRole('textbox', { name: 'Full text' });
    await user.type(text, ' Edited.');
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith('item-1', true));
    expect(screen.getByRole('button', { name: /show occurrence/i })).toBeDisabled();
  });

  it('keeps generation disabled when ElevenLabs is not configured', async () => {
    const server = createFakeServer();
    fetchMock.mockImplementation((async (input, init) => {
      const result = await server.handle(String(input), init);
      if (String(input).endsWith('/texts/item-1')) {
        const body = await result.json(); body.text.audioGenerationConfigured = false;
        return jsonResponse(200, body);
      }
      return result;
    }) as typeof fetch);
    render(<TextAuthoringPanel lessonId="lesson-1" textId="item-1" />, { wrapper: createWrapper() });
    expect(await screen.findByText(/ElevenLabs narration is not configured/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and generate narration' })).toBeDisabled();
  });
});
