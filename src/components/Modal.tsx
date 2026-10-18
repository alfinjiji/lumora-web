import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export default function Modal({
  open, onDismiss, id, className, label, children,
}: {
  open: boolean
  onDismiss(): void
  id: string
  className: string
  label: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
    return () => {
      if (element.open) element.close()
    }
  }, [open])
  return (
    <dialog
      ref={dialog}
      id={id}
      className={className}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      onClose={() => {
        if (open) onDismiss()
        requestAnimationFrame(() => {
          if (document.querySelector('dialog[open]')) return
          const active = document.activeElement
          if (active === document.body || active?.closest('dialog:not([open])'))
            document.getElementById('bag')?.focus({ preventScroll: true })
        })
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        ) onDismiss()
      }}
    >
      {children}
    </dialog>
  )
}
