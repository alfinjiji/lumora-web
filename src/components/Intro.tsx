import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

declare global {
  interface Window {
    auraflareIntroFallback?: number
  }
}

export default function Intro({ onFinish }: { onFinish(): void }) {
  const [quote, setQuote] = useState('')
  const [leaving, setLeaving] = useState(false)
  const skip = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timers: number[] = []
    const later = (callback: () => void, delay: number) =>
      timers.push(window.setTimeout(callback, delay))
    const finish = () => {
      root.classList.remove('intro-pending')
      root.classList.add('entrance-visible')
      onFinish()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
      } else if (event.key === 'Tab') {
        event.preventDefault()
        skip.current?.focus({ preventScroll: true })
      }
    }
    const onMotion = () => {
      if (media.matches) finish()
    }
    clearTimeout(window.auraflareIntroFallback)
    root.classList.remove('entrance-visible')
    root.classList.add('intro-pending')
    skip.current?.focus({ preventScroll: true })
    document.addEventListener('keydown', onKey)
    media.addEventListener('change', onMotion)
    const fullQuote = 'A little light. A slower moment.'
    for (let index = 0; index < fullQuote.length; index++)
      later(() => setQuote(fullQuote.slice(0, index + 1)), 1500 + index * 55)
    later(() => {
      setLeaving(true)
      root.classList.remove('intro-pending')
      root.classList.add('entrance-visible')
    }, 4050)
    later(finish, 5000)
    return () => {
      timers.forEach(clearTimeout)
      document.removeEventListener('keydown', onKey)
      media.removeEventListener('change', onMotion)
      root.classList.remove('intro-pending')
    }
  }, [onFinish])

  return (
    <section
      id="opening"
      className={'opening-overlay' + (leaving ? ' opening-reveal' : '')}
      role="dialog"
      aria-modal="true"
      aria-label="Auraflare introduction"
    >
      <div className="opening-kicker">THE CANDLE STUDIO</div>
      <div className="opening-mark-wrap">
        <div className="opening-mark" aria-label="Auraflare">
          {'Auraflare'.split('').map((letter, index) => (
            <span key={index} aria-hidden="true" style={{ '--letter': index } as CSSProperties}>
              {letter}
            </span>
          ))}
        </div>
      </div>
      <div className="opening-quote" aria-label="A little light. A slower moment.">
        <span className="typed-quote" aria-hidden="true">{quote}</span>
        <span className="typing-cursor" aria-hidden="true" />
      </div>
      <span className="opening-footnote">SMALL RITUALS. LOVELY MOMENTS.</span>
      <button ref={skip} className="skip-opening" type="button" onClick={onFinish}>
        Skip intro ↗
      </button>
    </section>
  )
}
