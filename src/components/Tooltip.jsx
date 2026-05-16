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
      {children || <HelpCircle size={13} className="text-[#8A7D6B] hover:text-[#52473C] cursor-help ml-0.5 transition-colors" />}
      {show && (
        <span
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-white text-[12px] leading-[1.5] rounded-[10px] whitespace-normal w-max max-w-[300px] pointer-events-none"
          style={{
            backgroundColor: '#2B251F',
            boxShadow: '0 12px 24px -6px rgba(15,15,15,0.22)',
            animation: 'fadeIn 120ms ease-out',
          }}
        >
          {text}
          <span
            className="absolute top-full left-1/2 -ml-1 border-4 border-transparent"
            style={{ borderTopColor: '#2B251F' }}
          />
        </span>
      )}
    </span>
  );
}
