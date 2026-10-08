import { useEffect, useMemo, useState } from 'react'
import {
  buildDailyPrompt,
  getLevelById,
  getTopicsByLevel,
  levels,
  topics,
} from './data/topics'
import { useJourney } from './hooks/useJourney'
import './App.css'

/**
 * Main FDE Journey learning companion app.
 */
export default function App() {
  const {
    state,
    ready,
    saveError,
    completedSet,
    progress,
    selectTopic,
    completeAndAdvance,
    toggleComplete,
    saveNote,
    checkInToday,
    moveBy,
  } = useJourney()

  const topic = topics.find((item) => item.id === state.currentId) ?? topics[0]
  const level = getLevelById(topic.levelId)
  const levelTopics = getTopicsByLevel(topic.levelId)
  const note = state.notes[String(topic.id)]?.text ?? ''
  const [draftNote, setDraftNote] = useState(note)
  const [copied, setCopied] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const prompt = useMemo(() => buildDailyPrompt(topic), [topic])

  useEffect(() => {
    setDraftNote(note)
  }, [note, topic.id])

  /**
   * Copies the daily teaching prompt to the clipboard.
   */
  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  /**
   * Persists the current draft note for this topic.
   */
  function handleSaveNote() {
    saveNote(topic.id, draftNote.trim())
  }

  const isDone = completedSet.has(topic.id)
  const levelDone = levelTopics.filter((item) => completedSet.has(item.id)).length

  if (!ready) {
    return (
      <div className="app">
        <div className="atmosphere" aria-hidden="true" />
        <p className="loading-line">Loading your journey from the project repo…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-block">
          <p className="brand">FDE JOURNEY</p>
          <p className="brand-sub">Your daily AI → Architect learning partner</p>
        </div>

        <div className="progress-chip" title={`${progress.done} of ${progress.total}`}>
          <div className="progress-meta">
            <span>{progress.done}</span>
            <span className="muted">/ {progress.total}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="progress-pct">{progress.percent}%</span>
        </div>

        <div className="streak-chip" title="Learning streak (Pakistan time)">
          <span className="streak-label">Streak</span>
          <strong>{progress.streak}</strong>
          <span className="muted">best {progress.longestStreak}</span>
        </div>

        <button
          type="button"
          className="nav-toggle"
          onClick={() => setNavOpen((open) => !open)}
          aria-expanded={navOpen}
        >
          {navOpen ? 'Close map' : 'Open map'}
        </button>
      </header>

      <div className={`shell ${navOpen ? 'shell-nav-open' : ''}`}>
        <aside className="map">
          <p className="map-label">Knowledge map</p>
          <div className="level-list">
            {levels.map((item) => {
              const items = getTopicsByLevel(item.id)
              const done = items.filter((t) => completedSet.has(t.id)).length
              const active = item.id === topic.levelId
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`level-btn tone-${item.tone} ${active ? 'active' : ''}`}
                  onClick={() => {
                    const firstOpen =
                      items.find((t) => !completedSet.has(t.id)) ?? items[0]
                    selectTopic(firstOpen.id)
                    setNavOpen(false)
                  }}
                >
                  <span className="level-num">L{item.id}</span>
                  <span className="level-title">{item.title}</span>
                  <span className="level-count">
                    {done}/{items.length}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="stage">
          <section className="hero-topic">
            <div className="hero-kicker">
              <span className={`tone-dot tone-${level?.tone ?? 'green'}`} />
              Level {level?.id} — {level?.title}
            </div>

            <h1>
              <span className="topic-id">#{topic.id}</span>
              {topic.title}
            </h1>

            {level?.note ? <p className="level-note">{level.note}</p> : null}

            <p className="hero-line">
              One learning objective at a time. Copy the prompt, study until you can answer the
              architect questions, leave a note, then move forward.
            </p>

            <div className="hero-actions">
              <button type="button" className="btn primary" onClick={handleCopyPrompt}>
                {copied ? 'Prompt copied' : 'Copy daily prompt'}
              </button>
              <button
                type="button"
                className={`btn ${isDone ? 'ghost' : 'accent'}`}
                onClick={completeAndAdvance}
              >
                {isDone ? 'Already done — jump next' : 'Mark done & continue'}
              </button>
              <button type="button" className="btn ghost" onClick={() => toggleComplete(topic.id)}>
                {isDone ? 'Undo complete' : 'Mark complete'}
              </button>
              <button type="button" className="btn ghost" onClick={checkInToday}>
                Check in today
              </button>
            </div>
          </section>

          <section className="panel prompt-panel">
            <div className="panel-head">
              <h2>Today&apos;s teaching prompt</h2>
              <button type="button" className="btn small ghost" onClick={handleCopyPrompt}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="prompt">{prompt}</pre>
          </section>

          <section className="panel checklist-panel">
            <h2>Architect checklist before moving on</h2>
            <ul>
              <li>What is it?</li>
              <li>Why does it exist?</li>
              <li>How does it work?</li>
              <li>When would I use it?</li>
              <li>When wouldn&apos;t I use it?</li>
              <li>What are its alternatives?</li>
              <li>What are its tradeoffs?</li>
              <li>How does it fit into an architecture?</li>
            </ul>
          </section>

          <section className="panel notes-panel">
            <div className="panel-head">
              <h2>Your notes / comments</h2>
              <button type="button" className="btn small accent" onClick={handleSaveNote}>
                Save note
              </button>
            </div>
            <textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="Capture your understanding, examples, questions, or architecture thoughts for this topic..."
              rows={7}
            />
            {state.notes[String(topic.id)]?.updatedAt ? (
              <p className="note-meta">
                Last saved {new Date(state.notes[String(topic.id)].updatedAt).toLocaleString()}
              </p>
            ) : (
              <p className="note-meta">Notes are saved in data/progress.json in this project.</p>
            )}
            {saveError ? <p className="note-meta save-error">{saveError}</p> : null}
          </section>

          <section className="panel queue-panel">
            <div className="panel-head">
              <h2>
                Level queue
                <span className="muted">
                  {' '}
                  · {levelDone}/{levelTopics.length}
                </span>
              </h2>
              <div className="queue-nav">
                <button type="button" className="btn small ghost" onClick={() => moveBy(-1)}>
                  Prev
                </button>
                <button type="button" className="btn small ghost" onClick={() => moveBy(1)}>
                  Next
                </button>
              </div>
            </div>
            <div className="queue">
              {levelTopics.map((item) => {
                const done = completedSet.has(item.id)
                const active = item.id === topic.id
                const hasNote = Boolean(state.notes[String(item.id)]?.text)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`queue-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                    onClick={() => selectTopic(item.id)}
                  >
                    <span className="q-id">#{item.id}</span>
                    <span className="q-title">{item.title}</span>
                    <span className="q-flags">
                      {hasNote ? 'note' : ''}
                      {done ? 'done' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
