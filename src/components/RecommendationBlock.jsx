import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';

export default function RecommendationBlock({ stepKey, brandName, body, lang }) {
  const storageKey = `vip_reco_dismissed_step${stepKey}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true'; }
    catch { return false; }
  });

  if (dismissed || !body) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, 'true'); } catch { /* noop */ }
  };

  const t = lang === 'fr';

  return (
    <div style={{ backgroundColor: '#F5F3FF', borderLeft: '3px solid #6B4EFF', borderRadius: 16, padding: '16px 20px' }}
      className="mb-3">
      <div className="flex items-start gap-3">
        <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
            {t ? `Recommandation pour ${brandName || 'votre marque'}` : `Recommendation for ${brandName || 'your brand'}`}
          </div>
          <p className="text-[13px] text-[#374151] leading-relaxed">{body}</p>
        </div>
        <button onClick={handleDismiss}
          className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors shrink-0 mt-0.5">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
