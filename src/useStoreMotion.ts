import { useEffect } from 'react'

export default function useStoreMotion(filter: string, sort: string) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let observer: IntersectionObserver | undefined
    const targets = [...document.querySelectorAll<HTMLElement>(
      '.product,.occasion,.pause-photo,.care .faq,.section-top,.pause-copy,.occasion-grid,.care>div,.closing h2',
    )]
    const refresh = () => {
      observer?.disconnect()
      if (media.matches || !('IntersectionObserver' in window)) {
        targets.forEach((element) => element.classList.add('motion-in', 'shown'))
        return
      }
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('motion-in', 'shown')
          observer?.unobserve(entry.target)
        }
      }, { threshold: 0.08, rootMargin: '0px 0px 24px 0px' })
      targets.forEach((element, index) => {
        element.classList.add(element.matches('.product,.occasion,.pause-photo,.care .faq') ? 'motion-ready' : 'reveal')
        element.style.setProperty('--motion-delay', element.matches('.product') ? (index % 4) * 70 + 'ms' : '0ms')
        observer?.observe(element)
      })
    }
    refresh()
    media.addEventListener('change', refresh)
    return () => {
      observer?.disconnect()
      media.removeEventListener('change', refresh)
    }
  }, [filter, sort])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const hero = document.querySelector<HTMLElement>('.hero-photo')
    let frame = 0
    const paint = () => {
      frame = 0
      if (!hero) return
      if (media.matches) {
        hero.style.removeProperty('--hero-drift')
        return
      }
      const bounds = hero.getBoundingClientRect()
      if (bounds.bottom > 0 && bounds.top < innerHeight)
        hero.style.setProperty('--hero-drift', Math.max(-10, Math.min(10, -bounds.top * 0.025)).toFixed(2) + 'px')
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    media.addEventListener('change', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      media.removeEventListener('change', schedule)
    }
  }, [])
}
