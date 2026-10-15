import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ArrowUpLeft, FileText, Layers3 } from 'lucide-react'

export function MotionRegion({ children, className = '', motionKey = '', ...props }) {
  const root = useRef(null)
  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const targets = [...root.current.querySelectorAll('[data-enter]')]
        .filter(target => target.closest('[data-motion-region]') === root.current)
      if (targets.length) gsap.fromTo(targets, { y: 24, opacity: 0 }, {
        y: 0, opacity: 1, duration: .7, stagger: .075, ease: 'power3.out', clearProps: 'transform,opacity',
      })
    }, root)
    return () => media.revert()
  }, [motionKey])
  return <div ref={root} data-motion-region className={className} {...props}>{children}</div>
}

export function PageHeading({ eyebrow, title, description, children }) {
  return <div className="fx-page-heading" data-enter>
    <div><span className="fx-eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {children && <div className="fx-heading-actions">{children}</div>}
  </div>
}

export function Brand({ compact = false }) {
  return <span className={`fx-brand ${compact ? 'compact' : ''}`}>
    <span className="fx-brand-mark"><Layers3 size={25} strokeWidth={1.8} /></span>
    <span><b>fawter<span>x</span></b>{!compact && <small>INVOICE WORKSPACE</small>}</span>
  </span>
}

export function EmptyIllustration() {
  return <div className="fx-empty-art" aria-hidden="true"><FileText size={32} strokeWidth={1.3} /><span><ArrowUpLeft size={15} /></span></div>
}
