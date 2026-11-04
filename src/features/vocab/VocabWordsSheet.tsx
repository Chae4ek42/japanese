import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './words-sheet.css'

export function VocabWordsSheet({ open, onClose, children, actions }: {
  open: boolean
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dragStart = useRef<number | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [drag, setDrag] = useState(0)
  const [closing, setClosing] = useState(false)
  const id = useId()

  useEffect(() => {
    const viewport = window.visualViewport
    const dialog = dialogRef.current
    if (!viewport || !dialog) return
    const sync = () => {
      dialog.style.setProperty('--vocab-sheet-height', `${viewport.height}px`)
      dialog.style.setProperty('--vocab-sheet-bottom', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`)
      dialog.dataset.keyboard = String(window.innerHeight - viewport.height > 120)
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => { viewport.removeEventListener('resize', sync); viewport.removeEventListener('scroll', sync) }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      setClosing(false)
      setDrag(0)
      if (!dialog.open) {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        dialog.showModal()
      }
      closeRef.current?.focus({ preventScroll: true })
      return
    }
    if (!dialog.open) return
    const focused = document.activeElement
    if (focused instanceof HTMLInputElement && dialog.contains(focused)) focused.blur()
    setClosing(true)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200
    const timeout = window.setTimeout(() => {
      dialog.close()
      const previousFocus = returnFocusRef.current
      if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true })
      setClosing(false)
      setDrag(0)
    }, duration)
    return () => window.clearTimeout(timeout)
  }, [open])

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`vocab-words-sheet${closing ? ' is-closing' : ''}`}
      data-testid="vocab-words-sheet"
      role="dialog"
      aria-labelledby={`${id}-title`}
      style={drag > 0 ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      onCancel={(event) => { event.preventDefault(); onCloseRef.current() }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientY < bounds.top || event.clientX < bounds.left || event.clientX > bounds.right) onCloseRef.current()
      }}
    >
      <div className="vocab-sheet-handle" aria-hidden="true"
        onPointerDown={(event) => { dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={(event) => { if (dragStart.current !== null) setDrag(Math.max(0, event.clientY - dragStart.current)) }}
        onPointerUp={() => { dragStart.current = null; if (drag > 70) onCloseRef.current(); setDrag(0) }}
        onPointerCancel={() => { dragStart.current = null; setDrag(0) }}
      ><span /></div>
      <header className="vocab-sheet-heading">
        <h2 id={`${id}-title`}>Слова тренировки</h2>
        <button ref={closeRef} type="button" className="vocab-mobile-action" aria-label="Закрыть список слов" data-testid="vocab-words-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="vocab-sheet-content">{children}</div>
      {actions ? <footer className="vocab-sheet-actions">{actions}</footer> : null}
    </dialog>, document.body,
  )
}
