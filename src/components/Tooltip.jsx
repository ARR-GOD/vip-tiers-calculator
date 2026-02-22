import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export default function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children || <HelpCircle size={13} className="text-[#9CA3AF] cursor-help ml-0.5" />}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#111827] text-white text-[12px] leading-relaxed rounded-lg whitespace-normal w-max max-w-[260px] pointer-events-none" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {text}
          <span className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-[#111827]" />
        </span>
      )}
    </span>
  );
}
