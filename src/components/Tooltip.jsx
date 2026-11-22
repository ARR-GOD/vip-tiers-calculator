import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

const GAP = 8;      // space between the icon and the bubble
const MARGIN = 8;   // minimum distance to the viewport edges

// Rendered in document.body with fixed positioning, so no scrolling or
// overflow-hidden container can clip it. Opens below the icon, above it when
// there isn't enough room, and stays inside the viewport horizontally.
export default function Tooltip({ text, children }) {
  const anchorRef = useRef(null);
  const bubbleRef = useRef(null);
  const [open, setOpen] = useState(false);

  // Position the bubble once it is in the DOM and its size is known.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !bubbleRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const bubble = bubbleRef.current;
    const { width, height } = bubble.getBoundingClientRect();
    const fitsBelow = anchor.bottom + GAP + height <= window.innerHeight - MARGIN;
    const top = fitsBelow ? anchor.bottom + GAP : Math.max(MARGIN, anchor.top - GAP - height);
    const centered = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.min(Math.max(MARGIN, centered), window.innerWidth - MARGIN - width);
    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
    bubble.style.setProperty('--arrow-left', `${anchor.left + anchor.width / 2 - left}px`);
    bubble.dataset.placement = fitsBelow ? 'bottom' : 'top';
    bubble.style.visibility = 'visible';
  }, [open, text]);

  // A fixed bubble would drift away from its icon on scroll: close it instead.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className="inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children || <HelpCircle size={13} className="text-[#8A7D6B] hover:text-[#52473C] cursor-help ml-0.5 transition-colors" />}
      {open && createPortal(
        <span ref={bubbleRef} role="tooltip" className="tooltip-bubble" style={{ visibility: 'hidden' }}>
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
