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
    contentRevision: null as null | { id: string; text: string },
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
          legacyText: 'Hello world.',
          contentRevision: state.contentRevision,
          narration: state.narration,
          alignmentSummary: state.alignmentId ? { id: state.alignmentId, status: 'OK' } : null,
          approvedTextReleaseId: null,
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

    if (url.includes('/clip-jobs') && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      (createFakeServer as unknown as { lastClipRequestOccurrenceIds?: string[] }).lastClipRequestOccurrenceIds = body.occurrenceIds;
      state.entries[OCCURRENCE_ID].clipAssetId = 'asset-clip-1';
      return jsonResponse(202, { job: { id: 'job-clip-1', status: 'QUEUED' }, replay: false });
    }

    if (url.includes('/audio-jobs/job-clip-1') && method === 'GET') {
      return jsonResponse(200, { job: { id: 'job-clip-1', textId: 'item-1', kind: 'EXTRACT_CLIPS', status: 'SUCCEEDED', attempt: 1, resultAssetId: null, resultId: null, error: null } });
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
          readyForApproval: Boolean(state.narration) && (!selected || (hasTranslation && hasClip)),
          reasonCodes: !state.narration ? ['NARRATION_MISSING'] : !selected ? ['NO_WORDS_SELECTED'] : [],
        },
      });
    }

    if (url.includes('/releases') && method === 'POST') {
      return jsonResponse(201, { release: { id: 'release-1' } });
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

  it('drives the full workflow: disabled-until-saved, unchecked-by-default selection, scoped translation, selected-only extraction, gated approval', async () => {
    const server = createFakeServer();
    fetchMock.mockImplementation(((input: RequestInfo | URL, init?: RequestInit) =>
      server.handle(typeof input === 'string' ? input : input.toString(), init)) as typeof fetch);

    const user = userEvent.setup();
    render(<TextAuthoringPanel lessonId="lesson-1" textId="item-1" />, { wrapper: createWrapper() });

    // --- Generate is disabled until text is saved ---
    const generateButton = await screen.findByRole('button', { name: /generate narration/i });
    expect(generateButton).toBeDisabled();
    expect(screen.getByText(/save the text before generating narration/i)).toBeInTheDocument();

    const saveTextButton = screen.getByRole('button', { name: /save text/i });
    expect(saveTextButton).not.toBeDisabled(); // the first V2 revision can preserve legacy text

    const textarea = screen.getByDisplayValue('Hello world.');
    await user.clear(textarea);
    await user.type(textarea, 'Hello world!');

    await user.click(saveTextButton);
    await waitFor(() => expect(generateButton).not.toBeDisabled());

    // --- Generate narration; job resolves immediately in the fake server ---
    await user.click(generateButton);

    // --- Occurrences render unchecked by default ---
    const checkbox = await screen.findByRole('button', { name: /select occurrence "hello"/i });
    expect(checkbox.getAttribute('aria-pressed')).toBe('false');

    // --- Select the occurrence ---
    await user.click(checkbox);
    await waitFor(() => expect(checkbox.getAttribute('aria-pressed')).toBe('true'));

    // --- Readiness shows selected-but-incomplete ---
    await waitFor(() => {
      expect(screen.getByText(/missing translation: 1/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /approve text version/i })).toBeDisabled();

    // --- Translation is saved to this entry only (PATCH .../vocabulary/entry-1) ---
    const translationInput = screen.getByRole('textbox', { name: /translation for hello at position 0/i });
    await user.click(screen.getByText('Full narration'));
    await user.click(screen.getByRole('button', { name: /show occurrence "hello"/i }));
    expect(document.activeElement).toBe(translationInput);
    await user.click(screen.getByText('Full narration'));
    await user.click(screen.getByRole('button', { name: /show occurrence "hello"/i }));
    expect(document.activeElement).toBe(translationInput);
    await user.type(translationInput, 'բարև');
    await user.click(screen.getByRole('button', { name: /save translation/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/lessons/lesson-1/texts/item-1/vocabulary/entry-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    // --- Extract clips only requests the selected occurrence id, not "all" ---
    const extractButton = await screen.findByRole('button', { name: /extract missing clips/i });
    await user.click(extractButton);

    await waitFor(() => {
      const clipCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/clip-jobs'));
      expect(clipCall).toBeTruthy();
      const body = JSON.parse(String((clipCall as [unknown, RequestInit])[1]?.body));
      expect(body.occurrenceIds).toEqual([server.OCCURRENCE_ID]);
    });

    // --- Once translated + clipped, approval becomes available ---
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve text version/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /approve text version/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/lessons/lesson-1/texts/item-1/releases'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('explains why generation is disabled when the provider is not configured', async () => {
    fetchMock.mockImplementation((async () =>
      jsonResponse(200, {
        text: {
          id: 'item-1',
          lessonId: 'lesson-1',
          draftVersion: 1,
          legacyText: 'Hi.',
          contentRevision: { id: 'rev-1', textId: 'item-1', sequence: 1, text: 'Hi.', textSha256: 'x', sourceLanguage: 'en' },
          narration: null,
          alignmentSummary: null,
          approvedTextReleaseId: null,
          audioGenerationConfigured: false,
        },
      })) as unknown as typeof fetch);

    render(<TextAuthoringPanel lessonId="lesson-1" textId="item-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/not configured on this server/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /generate narration/i })).toBeDisabled();
  });
});
