import type { NoteDto } from '@repo/api';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useApi } from '../api-context.js';

export const NotesPage = () => {
  const api = useApi();
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    const response = await api.call('notes.list', {});
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setError(null);
    setNotes(response.data.notes);
  }, [api]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await api.call('notes.create', {
      title,
      body,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setError(null);
    setTitle('');
    setBody('');
    await loadNotes();
  };

  return (
    <section>
      <h1>Notes</h1>

      <form onSubmit={onSubmit} aria-label="create-note-form">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          data-testid="title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
        />

        <label htmlFor="body">Body</label>
        <textarea
          id="body"
          data-testid="body-input"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Body"
        />

        <button data-testid="create-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </button>
      </form>

      {error ? (
        <p role="alert" data-testid="notes-error-message">
          {error}
        </p>
      ) : null}

      {notes.length === 0 ? (
        <p data-testid="empty-state">No notes yet.</p>
      ) : (
        <ul data-testid="notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <strong>{note.title}</strong>
              {note.body ? <p>{note.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
