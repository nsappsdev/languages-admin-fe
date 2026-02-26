'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLesson } from '../../../../../hooks/useLesson';
import { useLessonMutations } from '../../../../../hooks/useLessonMutations';
import { useToast } from '../../../../../components/providers/ToastProvider';
import { LessonStatus, TaskType, TaskOption } from '../../../../../lib/apiTypes';

const LESSON_STATUSES: LessonStatus[] = ['DRAFT', 'PUBLISHED'];
const TASK_TYPES: TaskType[] = ['PICK_ONE', 'FILL_IN_BLANK', 'MATCH'];

const createOption = () => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  label: '',
  isCorrect: false,
});

type TaskOptionEdit = {
  id?: string;
  localId: string;
  label: string;
  isCorrect: boolean;
};

type TaskEditState = {
  prompt: string;
  type: TaskType;
  options: TaskOptionEdit[];
  order?: number;
};

const createEditableOption = (option?: TaskOption): TaskOptionEdit => ({
  id: option?.id,
  localId:
    option?.id ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)),
  label: option?.label ?? '',
  isCorrect: option?.isCorrect ?? false,
});

export default function LessonDetailPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId ?? '';
  const { data, isLoading, error } = useLesson(lessonId);
  const lesson = data?.lesson;
  const { updateLesson, createTask, deleteTask } = useLessonMutations();
  const { notify } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<LessonStatus>('DRAFT');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [taskEdits, setTaskEdits] = useState<Record<string, TaskEditState>>({});
  const [taskMessages, setTaskMessages] = useState<Record<string, string>>({});
  const [isReordering, setIsReordering] = useState(false);

  const [newTaskPrompt, setNewTaskPrompt] = useState('');
  const [newTaskType, setNewTaskType] = useState<TaskType>('PICK_ONE');
  const [newTaskOptions, setNewTaskOptions] = useState([createOption(), createOption()]);
  const [newTaskAnswers, setNewTaskAnswers] = useState('');
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);

useEffect(() => {
  if (lesson) {
    setTitle(lesson.title);
    setDescription(lesson.description ?? '');
    setStatus(lesson.status);
    const edits: Record<string, TaskEditState> = {};
    lesson.tasks.forEach((task) => {
      edits[task.id] = {
        prompt: task.prompt,
        type: task.type,
        options: (task.options ?? []).map((option) => createEditableOption(option)),
      };
    });
    setTaskEdits(edits);
    setTaskMessages({});
  }
}, [lesson]);

  useEffect(() => {
    setTaskFeedback(null);
  }, [newTaskPrompt, newTaskType]);

  const tasks = useMemo(() => lesson?.tasks ?? [], [lesson?.tasks]);

  const handleLessonSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lessonId) return;
    setFeedback(null);
    try {
      await updateLesson.mutateAsync({
        lessonId,
        data: { title, description, status },
      });
      setFeedback('Lesson saved');
      notify('Lesson updated');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to save lesson');
      notify('Failed to update lesson', 'error');
    }
  };

  const resetTaskForm = () => {
    setNewTaskPrompt('');
    setNewTaskOptions([createOption(), createOption()]);
    setNewTaskAnswers('');
    setNewTaskType('PICK_ONE');
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lessonId) return;
    setTaskFeedback(null);
    if (newTaskPrompt.trim().length < 4) {
      setTaskFeedback('Prompt must be at least 4 characters.');
      return;
    }
    if (
      newTaskType === 'PICK_ONE' &&
      newTaskOptions.some((option) => option.label.trim().length < 1)
    ) {
      setTaskFeedback('All options need labels.');
      return;
    }
    try {
      await createTask.mutateAsync({
        lessonId,
        prompt: newTaskPrompt,
        type: newTaskType,
        order: tasks.length,
        config:
          newTaskType === 'FILL_IN_BLANK'
            ? {
                correctAnswers: newTaskAnswers
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              }
            : {},
        options:
          newTaskType === 'PICK_ONE'
            ? newTaskOptions.map((option) => ({
                label: option.label,
                isCorrect: option.isCorrect,
              }))
            : undefined,
      });
      setTaskFeedback('Task added');
      notify('Task added');
      resetTaskForm();
    } catch (err) {
      setTaskFeedback(err instanceof Error ? err.message : 'Failed to add task');
      notify('Failed to add task', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!lessonId) return;
    try {
      await deleteTask.mutateAsync({ lessonId, taskId });
      notify('Task removed');
    } catch (err) {
      notify(
        err instanceof Error ? err.message : 'Failed to remove task',
        'error',
      );
    }
  };

  const canSubmitTask =
    newTaskPrompt.trim().length > 0 &&
    (newTaskType !== 'PICK_ONE' ||
      newTaskOptions.every((option) => option.label.trim().length > 0));

  const renderTaskOptions = () => {
    if (newTaskType !== 'PICK_ONE') return null;
    return (
      <div className="space-y-2">
        {newTaskOptions.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <input
              value={option.label}
              onChange={(e) =>
                setNewTaskOptions((opts) =>
                  opts.map((opt) => (opt.id === option.id ? { ...opt, label: e.target.value } : opt)),
                )
              }
              placeholder={`Option ${index + 1}`}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={option.isCorrect}
                onChange={(e) =>
                  setNewTaskOptions((opts) =>
                    opts.map((opt) =>
                      opt.id === option.id ? { ...opt, isCorrect: e.target.checked } : opt,
                    ),
                  )
                }
              />
              Correct
            </label>
            {newTaskOptions.length > 2 && (
              <button
                type="button"
                className="text-xs text-rose-600"
                onClick={() =>
                  setNewTaskOptions((opts) => opts.filter((opt) => opt.id !== option.id))
                }
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-brand-600"
          onClick={() => setNewTaskOptions((opts) => [...opts, createOption()])}
        >
          + Add option
        </button>
      </div>
    );
  };

  const renderAnswersInput = () => {
    if (newTaskType !== 'FILL_IN_BLANK') return null;
    return (
      <div>
        <label className="text-sm text-slate-700">Correct answers (comma separated)</label>
        <input
          value={newTaskAnswers}
          onChange={(e) => setNewTaskAnswers(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="small, medium"
        />
      </div>
    );
  };

  const handleTaskSave = useCallback(
    async (taskId: string) => {
      if (!lessonId) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const edit = taskEdits[taskId];
      if (!edit?.prompt) return;
      setTaskMessages((prev) => ({ ...prev, [taskId]: 'Saving…' }));
      try {
        const optionsPayload =
          edit.type === 'PICK_ONE'
            ? (edit.options ?? [])
                .filter((option) => option.label.trim().length > 0)
                .map((option) => ({
                  id: option.id,
                  label: option.label,
                  isCorrect: option.isCorrect,
                }))
            : [];
        await updateLesson.mutateAsync({
          lessonId,
          data: {
            tasks: [
              {
                id: taskId,
                prompt: edit.prompt,
                type: edit.type,
                order: task.order,
                options: optionsPayload,
              },
            ],
          },
        });
        setTaskMessages((prev) => ({ ...prev, [taskId]: 'Saved' }));
      } catch (err) {
        setTaskMessages((prev) => ({
          ...prev,
          [taskId]: err instanceof Error ? err.message : 'Failed to save',
        }));
      }
    },
    [lessonId, taskEdits, tasks, updateLesson],
  );

  const moveTask = async (taskId: string, direction: 'up' | 'down') => {
    if (!lesson || isReordering) return;
    const currentIndex = tasks.findIndex((task) => task.id === taskId);
    if (currentIndex === -1) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= tasks.length) return;
    const reordered = [...tasks];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, moved);

    setTaskEdits((prev) => {
      const updated: Record<string, TaskEditState> = { ...prev };
      reordered.forEach((task, index) => {
        if (updated[task.id]) {
          updated[task.id] = { ...updated[task.id], order: index };
        } else {
          updated[task.id] = {
            prompt: task.prompt,
            type: task.type,
            options: (task.options ?? []).map((option) => createEditableOption(option)),
            order: index,
          };
        }
      });
      return updated;
    });

    setIsReordering(true);
    try {
      await updateLesson.mutateAsync({
        lessonId,
        data: {
          tasks: reordered.map((task, idx) => ({
            id: task.id,
            prompt: taskEdits[task.id]?.prompt ?? task.prompt,
            type: taskEdits[task.id]?.type ?? task.type,
            order: idx,
          })),
        },
      });
      notify('Task order updated');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to reorder tasks', 'error');
    } finally {
      setIsReordering(false);
    }
  };

  const renderTaskBody = useMemo(() => {
    if (isLoading) return <p className="text-sm text-slate-500">Loading lesson…</p>;
    if (error) {
      return <p className="text-sm text-rose-600">Failed to load lesson: {error.message}</p>;
    }
    if (!lesson) {
      return <p className="text-sm text-rose-600">Lesson not found.</p>;
    }
    return (
      <div className="space-y-3">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-semibold text-slate-900">#{index + 1}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveTask(task.id, 'up')}
                  className="text-xs text-slate-500"
                  disabled={index === 0 || isReordering}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveTask(task.id, 'down')}
                  className="text-xs text-slate-500"
                  disabled={index === tasks.length - 1 || isReordering}
                >
                  ↓
                </button>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-xs text-rose-600"
                  disabled={deleteTask.isPending}
                >
                  Remove
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Prompt</label>
              <textarea
                value={taskEdits[task.id]?.prompt ?? ''}
                onChange={(e) =>
                  setTaskEdits((prev) => ({
                    ...prev,
                    [task.id]: {
                      prompt: e.target.value,
                      type: prev[task.id]?.type ?? task.type,
                      options: prev[task.id]?.options ?? [],
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Type</label>
              <select
                value={taskEdits[task.id]?.type ?? task.type}
                onChange={(e) =>
                  setTaskEdits((prev) => {
                    const nextType = e.target.value as TaskType;
                    const currentOptions = prev[task.id]?.options ?? [];
                    return {
                      ...prev,
                      [task.id]: {
                        prompt: prev[task.id]?.prompt ?? task.prompt,
                        type: nextType,
                        options:
                          nextType === 'PICK_ONE'
                            ? currentOptions.length
                              ? currentOptions
                              : [createEditableOption(), createEditableOption()]
                            : [],
                      },
                    };
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {(taskEdits[task.id]?.type ?? task.type) === 'PICK_ONE' && (
              <div className="space-y-2">
                {(taskEdits[task.id]?.options ?? []).map((option, idx) => (
                  <div key={option.localId} className="flex items-center gap-2">
                    <input
                      value={option.label}
                      onChange={(e) =>
                        setTaskEdits((prev) => ({
                          ...prev,
                          [task.id]: {
                            ...prev[task.id],
                            options: (prev[task.id]?.options ?? []).map((opt) =>
                              opt.localId === option.localId
                                ? { ...opt, label: e.target.value }
                                : opt,
                            ),
                          },
                        }))
                      }
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder={`Option ${idx + 1}`}
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) =>
                          setTaskEdits((prev) => ({
                            ...prev,
                            [task.id]: {
                              ...prev[task.id],
                              options: (prev[task.id]?.options ?? []).map((opt) =>
                                opt.localId === option.localId
                                  ? { ...opt, isCorrect: e.target.checked }
                                  : opt,
                              ),
                            },
                          }))
                        }
                      />
                      Correct
                    </label>
                    {(taskEdits[task.id]?.options ?? []).length > 2 && (
                      <button
                        type="button"
                        className="text-xs text-rose-600"
                        onClick={() =>
                          setTaskEdits((prev) => ({
                            ...prev,
                            [task.id]: {
                              ...prev[task.id],
                              options: (prev[task.id]?.options ?? []).filter(
                                (opt) => opt.localId !== option.localId,
                              ),
                            },
                          }))
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs text-brand-600"
                  onClick={() =>
                    setTaskEdits((prev) => ({
                      ...prev,
                      [task.id]: {
                        ...prev[task.id],
                        options: [
                          ...(prev[task.id]?.options ?? []),
                          createEditableOption(),
                        ],
                      },
                    }))
                  }
                >
                  + Add option
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleTaskSave(task.id)}
                className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
                disabled={updateLesson.isPending}
              >
                Save task
              </button>
              {taskMessages[task.id] && (
                <p className="text-xs text-slate-500">{taskMessages[task.id]}</p>
              )}
            </div>
          </div>
        ))}
        {!tasks.length && <p className="text-sm text-slate-500">No tasks yet.</p>}
      </div>
    );
  }, [
    deleteTask.isPending,
    error,
    handleTaskSave,
    isLoading,
    lesson,
    taskEdits,
    taskMessages,
    tasks,
    updateLesson.isPending,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/lessons" className="text-sm text-brand-600">
          ← Back to lessons
        </Link>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {lesson?.status ?? '—'}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={handleLessonSubmit}
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={4}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LessonStatus)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {LESSON_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          {feedback && <p className="text-sm text-slate-500">{feedback}</p>}
          <button
            type="submit"
            disabled={updateLesson.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {updateLesson.isPending ? 'Saving…' : 'Save lesson'}
          </button>
        </form>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
            <div className="mt-4">{renderTaskBody}</div>
          </section>

          <form
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            onSubmit={handleCreateTask}
          >
            <h3 className="text-base font-semibold text-slate-900">Add task</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700">Prompt</label>
              <textarea
                value={newTaskPrompt}
                onChange={(e) => setNewTaskPrompt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Type</label>
              <select
                value={newTaskType}
                onChange={(e) => {
                  setNewTaskType(e.target.value as TaskType);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {renderTaskOptions()}
            {renderAnswersInput()}
            {taskFeedback && <p className="text-sm text-slate-500">{taskFeedback}</p>}
            <button
              type="submit"
              disabled={!canSubmitTask || createTask.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {createTask.isPending ? 'Adding…' : 'Add task'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
