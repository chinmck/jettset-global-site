"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Note = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorEmail: string;
};

type Task = {
  id: string;
  body: string;
  dueDate: string | null;
  done: boolean;
  createdAt: string;
};

async function responseMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || fallback;
}

export function GuestRelationship({ enquiryId }: { enquiryId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [notePending, setNotePending] = useState(false);
  const [taskPending, setTaskPending] = useState(false);
  const [changingTask, setChangingTask] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/partner/enquiries/${enquiryId}/notes`, { signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error(await responseMessage(response, "Notes could not be loaded."));
        return response.json() as Promise<{ notes: Note[] }>;
      }),
      fetch(`/api/partner/enquiries/${enquiryId}/tasks`, { signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error(await responseMessage(response, "Tasks could not be loaded."));
        return response.json() as Promise<{ tasks: Task[] }>;
      }),
    ]).then(([noteData, taskData]) => {
      setNotes(noteData.notes);
      setTasks(taskData.tasks);
    }).catch((error: Error) => {
      if (error.name !== "AbortError") setMessage(error.message || "Guest activity could not be loaded.");
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [enquiryId]);

  const orderedTasks = useMemo(() => [...tasks].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  }), [tasks]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!noteBody.trim() || notePending) return;
    setNotePending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/partner/enquiries/${enquiryId}/notes`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: noteBody }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "The note could not be added."));
      const { note } = await response.json() as { note: Note };
      setNotes((current) => [note, ...current]);
      setNoteBody("");
      setMessage("Note added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The note could not be added.");
    } finally { setNotePending(false); }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskBody.trim() || taskPending) return;
    setTaskPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/partner/enquiries/${enquiryId}/tasks`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: taskBody, due_date: dueDate }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "The task could not be added."));
      const { task } = await response.json() as { task: Task };
      setTasks((current) => [...current, task]);
      setTaskBody("");
      setDueDate("");
      setMessage("Follow-up added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The task could not be added.");
    } finally { setTaskPending(false); }
  }

  async function toggleTask(task: Task) {
    if (changingTask) return;
    setChangingTask(task.id);
    setMessage("");
    try {
      const response = await fetch(`/api/partner/tasks/${task.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ done: !task.done }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "The task could not be updated."));
      const { task: updated } = await response.json() as { task: Task };
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The task could not be updated.");
    } finally { setChangingTask(null); }
  }

  return <div className="hub-relationship-grid">
    <section className="hub-panel hub-relationship-section" aria-labelledby="guest-notes-heading">
      <span className="hub-eyebrow">Conversation record</span>
      <h2 id="guest-notes-heading">Notes</h2>
      <form className="hub-compact-form" onSubmit={addNote}>
        <label htmlFor="guest-note">Add a private working note</label>
        <textarea id="guest-note" maxLength={2000} required value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="What was discussed, or what should happen next?" />
        <button className="hub-button" type="submit" disabled={notePending}>{notePending ? "Adding…" : "Add note →"}</button>
      </form>
      <div className="hub-note-list">
        {loading ? <p className="hub-muted">Loading notes…</p> : notes.length ? notes.map((note) => <article className="hub-note" key={note.id}><p>{note.body}</p><small>{note.authorName || note.authorEmail} · {new Date(note.createdAt).toLocaleString("en-GB")}</small></article>) : <p className="hub-muted">Nothing here yet — add your first note.</p>}
      </div>
    </section>
    <section className="hub-panel hub-relationship-section" aria-labelledby="guest-tasks-heading">
      <span className="hub-eyebrow">Next steps</span>
      <h2 id="guest-tasks-heading">Follow-ups</h2>
      <form className="hub-compact-form" onSubmit={addTask}>
        <label htmlFor="guest-task">Add a follow-up</label>
        <input id="guest-task" maxLength={500} required value={taskBody} onChange={(event) => setTaskBody(event.target.value)} placeholder="Arrange a call or confirm journey details" />
        <label htmlFor="guest-task-due">Due date <span className="hub-muted">(optional)</span></label>
        <input id="guest-task-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        <button className="hub-button" type="submit" disabled={taskPending}>{taskPending ? "Adding…" : "Add follow-up →"}</button>
      </form>
      <div className="hub-task-list">
        {loading ? <p className="hub-muted">Loading follow-ups…</p> : orderedTasks.length ? orderedTasks.map((task) => <label className={`hub-task${task.done ? " is-done" : ""}`} key={task.id}><input type="checkbox" checked={task.done} disabled={changingTask === task.id} onChange={() => toggleTask(task)} /><span><strong>{task.body}</strong>{task.dueDate && <small>Due {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("en-GB")}</small>}</span></label>) : <p className="hub-muted">Nothing outstanding for this guest.</p>}
      </div>
    </section>
    {message && <p className="hub-relationship-message" role="status" aria-live="polite">{message}</p>}
  </div>;
}
