import { useState, useEffect } from 'react';
import { Globe, ArrowRight, Pencil, Check, X, RotateCcw } from 'lucide-react';

const LOADING_MESSAGES_FR = [
  '🔍 Analyse de votre site en cours...',
  '🎨 Détection du ton de marque...',
  '🛍️ Estimation du panier moyen...',
  '📊 Identification de l\'industrie...',
  '💡 Génération des recommandations...',
  '✨ Finalisation de votre profil...',
];
const LOADING_MESSAGES_EN = [
  '🔍 Analyzing your website...',
  '🎨 Detecting brand tone...',
  '🛍️ Estimating average order value...',
  '📊 Identifying industry...',
  '💡 Generating recommendations...',
  '✨ Finalizing your profile...',
];

const POSITIONING_LABELS = {
  premium: { fr: 'Premium', en: 'Premium', color: '#B8860B' },
  'mid-market': { fr: 'Milieu de gamme', en: 'Mid-Market', color: '#6B4EFF' },
  mass: { fr: 'Grand public', en: 'Mass Market', color: '#10B981' },
};

const PROGRAM_LABELS = {
  luxury: {
    fr: 'Prestige', en: 'Prestige',
    descFr: 'Pas de points, perks exclusifs, paliers sur le CA',
    descEn: 'No points, exclusive perks, spend-based tiers',
  },
  mid: {
    fr: 'Équilibré', en: 'Balanced',
    descFr: 'Points + missions, mix perks & réductions',
    descEn: 'Points + missions, mix perks & discounts',
  },
  mass: {
    fr: 'Engagé', en: 'Engaged',
    descFr: 'Points, toutes missions, bons & récompenses',
    descEn: 'Points, all missions, vouchers & rewards',
  },
};

const PROGRAM_TO_POSITIONING = {
  luxury: 'premium',
  mid: 'mid-market',
  mass: 'mass',
};

const TONE_LABELS = { luxury: 'Luxe', friendly: 'Amical', playful: 'Ludique', professional: 'Professionnel' };

export default function StepBrand_Analyzer({ lang, onComplete, onSkip, initialData }) {
  const t = lang === 'fr';
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState(initialData ? 'results' : 'input'); // input | loading | results | error
  const [editValues, setEditValues] = useState(initialData || null);
  const [error, setError] = useState('');
  const [originalDetectedType, setOriginalDetectedType] = useState(initialData?._originalDetectedProgram || initialData?.recommended_program || null);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setPhase('loading');
    setError('');

    try {
      const res = await fetch('/api/analyze-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur ${res.status}`);
      }

      const data = await res.json();
      setEditValues(data);
      setOriginalDetectedType(data.recommended_program);
      setPhase('results');
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  };

  const handleComplete = () => {
    // Preserve original detected type for future edits
    onComplete({ ...editValues, _originalDetectedProgram: originalDetectedType });
  };

  // ── INPUT / ERROR PHASE ──
  if (phase === 'input' || phase === 'error') {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="text-center">
          <div className="section-subheader">ANALYSE</div>
          <h2 className="text-[28px] font-bold text-[#111827]">
            {t ? 'Analysez votre marque' : 'Analyze your brand'}
          </h2>
          <p className="text-[15px] text-[#6B7280] mt-1.5">
            {t
              ? "Entrez l'URL de votre site pour pré-configurer automatiquement votre programme."
              : 'Enter your website URL to auto-configure your program.'}
          </p>
        </div>

        <div className="card">
          <div className="section-subheader">{t ? 'URL DE VOTRE SITE' : 'YOUR WEBSITE URL'}</div>
          <div className="flex gap-3 mt-2">
            <div className="flex-1 relative">
              <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="www.votre-marque.com"
                className="w-full pl-10 pr-4 py-3 text-[15px]"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-lg text-[14px] font-semibold hover:bg-primary-dark disabled:opacity-40 transition-all"
            >
              {t ? 'Analyser' : 'Analyze'}
              <ArrowRight size={14} />
            </button>
          </div>

          {phase === 'error' && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-600 text-[13px]">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button onClick={onSkip} className="text-[13px] text-[#6B7280] hover:text-primary transition-colors">
            {t ? 'Passer et configurer manuellement →' : 'Skip and configure manually →'}
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING PHASE ──
  if (phase === 'loading') {
    return <LoadingPhase url={url} lang={lang} />;
  }

  // ── RESULTS PHASE ──
  const posKey = PROGRAM_TO_POSITIONING[editValues.recommended_program] || editValues.positioning || 'mid-market';
  const pos = POSITIONING_LABELS[posKey] || POSITIONING_LABELS['mid-market'];

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {/* Header */}
      <div className="text-center">
        <div className="section-subheader">ANALYSE</div>
        <div className="flex items-center justify-center gap-3 mt-1">
          {editValues.brand_logo ? (
            <img src={editValues.brand_logo} alt={editValues.brand_name} className="brand-avatar" />
          ) : editValues.brand_name ? (
            <span className="brand-avatar-initials" style={{ backgroundColor: '#6B4EFF' }}>
              {editValues.brand_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          ) : null}
          <h2 className="text-[28px] font-bold text-[#111827]">
            {editValues.brand_name || url}
          </h2>
        </div>
        {editValues.brand_description && (
          <p className="text-[15px] text-[#6B7280] mt-1">{editValues.brand_description}</p>
        )}
      </div>

      {/* Program Type Selector (Change 3) */}
      <div className="card">
        <div className="section-subheader">{t ? 'TYPE DE PROGRAMME' : 'PROGRAM TYPE'}</div>
        <p className="text-[12px] text-[#9CA3AF] mb-3">
          {t ? "C'est un choix stratégique, pas juste une détection automatique." : "This is a strategic choice, not just automatic detection."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {['luxury', 'mid', 'mass'].map(type => {
            const label = PROGRAM_LABELS[type];
            const isSelected = editValues.recommended_program === type;
            const isDetected = originalDetectedType === type;
            return (
              <button key={type}
                onClick={() => setEditValues(prev => ({ ...prev, recommended_program: type }))}
                className={`selection-card text-left ${isSelected ? 'selected' : ''}`}
                style={{ padding: '12px 16px' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#111827]">{t ? label.fr : label.en}</span>
                  {isDetected && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ backgroundColor: '#F5F3FF', color: '#6B4EFF' }}>
                      {t ? 'Détecté' : 'Detected'}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[#6B7280] mt-0.5">{t ? label.descFr : label.descEn}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detected Parameters */}
      <div className="card">
        <div className="section-subheader">{t ? 'PARAMÈTRES DÉTECTÉS' : 'DETECTED PARAMETERS'}</div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <IndustrySelect
            label={t ? 'Secteur' : 'Industry'}
            value={editValues.industry}
            onChange={(v) => setEditValues(prev => ({ ...prev, industry: v }))}
            lang={lang}
          />
          <EditableField
            label={t ? 'Panier moyen' : 'Avg Order Value'}
            value={`${editValues.estimated_aov}€`}
            onChange={(v) => setEditValues(prev => ({ ...prev, estimated_aov: parseInt(v) || 60 }))}
          />
          <EditableField
            label={t ? 'Marge brute' : 'Gross Margin'}
            value={`${Math.round(editValues.estimated_margin * 100)}%`}
            onChange={(v) => setEditValues(prev => ({ ...prev, estimated_margin: (parseInt(v) || 50) / 100 }))}
          />
          <EditableField
            label={t ? 'Ton de marque' : 'Brand Tone'}
            value={t ? (TONE_LABELS[editValues.brand_tone] || editValues.brand_tone) : editValues.brand_tone}
            onChange={(v) => setEditValues(prev => ({ ...prev, brand_tone: v }))}
          />
        </div>
      </div>

      {/* Tier Names */}
      {editValues.suggested_tier_names?.length > 0 && (
        <div className="card">
          <div className="section-subheader">{t ? 'NOMS DES PALIERS' : 'TIER NAMES'}</div>
          <div className="flex gap-3 mt-2">
            {editValues.suggested_tier_names.map((name, i) => (
              <div key={i} className="flex-1 p-3 rounded-lg bg-gray-50 text-center">
                <div className="text-[10px] text-[#9CA3AF] uppercase mb-1">
                  {t ? `Palier ${i + 1}` : `Tier ${i + 1}`}
                </div>
                <input
                  value={name}
                  onChange={(e) => {
                    const newNames = [...editValues.suggested_tier_names];
                    newNames[i] = e.target.value;
                    setEditValues(prev => ({ ...prev, suggested_tier_names: newNames }));
                  }}
                  className="w-full text-center text-[15px] font-semibold text-[#111827] bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Missions */}
      {editValues.suggested_missions?.length > 0 && (
        <div className="card">
          <div className="section-subheader">{t ? 'MISSIONS SUGGÉRÉES' : 'SUGGESTED MISSIONS'}</div>
          <div className="space-y-2 mt-2">
            {editValues.suggested_missions.map((mission, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F3F0FF' }}>
                <span className="text-primary text-[10px]">●</span>
                <span className="text-[13px] text-[#111827]">{mission}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <button
          onClick={() => { setPhase('input'); setEditValues(null); setOriginalDetectedType(null); }}
          className="flex items-center gap-2 text-[13px] text-[#6B7280] hover:text-primary transition-colors"
        >
          <RotateCcw size={14} />
          {t ? 'Recommencer' : 'Start over'}
        </button>
        <button
          onClick={handleComplete}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg text-[14px] font-semibold hover:bg-primary-dark transition-all"
        >
          {t ? "C'est correct, continuer" : 'Looks good, continue'}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Loading Phase with animated messages ──
function LoadingPhase({ url, lang }) {
  const t = lang === 'fr';
  const messages = t ? LOADING_MESSAGES_FR : LOADING_MESSAGES_EN;
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 0.5, 95));
    }, 200);

    // Message cycling with fade
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex(i => (i + 1) % messages.length);
        setVisible(true);
      }, 400);
    }, 1800);

    return () => { clearInterval(interval); clearInterval(progressInterval); };
  }, [messages.length]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center" style={{ minHeight: 300 }}>
      {/* Progress bar */}
      <div className="w-full max-w-xs mb-8">
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%`, backgroundColor: '#6B4EFF' }} />
        </div>
      </div>

      {/* Animated message */}
      <p className="text-[16px] font-medium text-[#111827] h-8 flex items-center"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        {messages[msgIndex]}
      </p>

      <p className="text-[13px] text-[#9CA3AF] mt-3">{url}</p>
    </div>
  );
}

// ── Industry Multi-Select ──
const INDUSTRY_OPTIONS = [
  { id: 'fashion', fr: 'Mode', en: 'Fashion' },
  { id: 'beauty', fr: 'Beauté', en: 'Beauty' },
  { id: 'food', fr: 'Alimentation', en: 'Food & Beverage' },
  { id: 'health', fr: 'Santé / Compléments', en: 'Health / Supplements' },
  { id: 'electronics', fr: 'Électronique', en: 'Electronics' },
  { id: 'sports', fr: 'Sport', en: 'Sports' },
  { id: 'home', fr: 'Maison', en: 'Home & Garden' },
  { id: 'jewelry', fr: 'Bijoux / Accessoires', en: 'Jewelry / Accessories' },
  { id: 'kids', fr: 'Enfants / Bébé', en: 'Kids / Baby' },
  { id: 'pets', fr: 'Animaux', en: 'Pets' },
  { id: 'other', fr: 'Autre', en: 'Other' },
];

function IndustrySelect({ label, value, onChange, lang }) {
  const t = lang === 'fr';
  const [open, setOpen] = useState(false);

  // Normalize value to array
  const selected = Array.isArray(value)
    ? value
    : value ? [value] : [];

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id];
    onChange(next.length === 1 ? next[0] : next);
  };

  const displayLabel = selected.length === 0
    ? (t ? 'Sélectionner' : 'Select')
    : selected.map(id => {
        const opt = INDUSTRY_OPTIONS.find(o => o.id === id);
        return opt ? (t ? opt.fr : opt.en) : id;
      }).join(', ');

  return (
    <div className="relative">
      <div className="text-[11px] text-[#9CA3AF] uppercase tracking-wider mb-1">{label}</div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[15px] font-medium text-[#111827] w-full text-left group"
      >
        <span className="truncate">{displayLabel}</span>
        <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-56 max-h-52 overflow-y-auto">
          {INDUSTRY_OPTIONS.map(opt => {
            const isActive = selected.includes(opt.id);
            return (
              <button key={opt.id}
                onClick={() => toggle(opt.id)}
                className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-[13px] transition-all ${isActive ? 'bg-primary-50 text-primary font-medium' : 'text-[#374151] hover:bg-gray-50'}`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${isActive ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                  {isActive && '✓'}
                </span>
                {t ? opt.fr : opt.en}
              </button>
            );
          })}
          <button onClick={() => setOpen(false)} className="w-full mt-1 pt-1 border-t border-gray-100 text-[12px] text-primary font-medium text-center py-1">
            {t ? 'Fermer' : 'Done'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline Editable Field ──
function EditableField({ label, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div>
        <div className="text-[11px] text-[#9CA3AF] uppercase tracking-wider mb-1">{label}</div>
        <div className="flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 px-2 py-1 border border-gray-200 rounded text-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          />
          <button onClick={commit} className="text-emerald-500 hover:text-emerald-700 p-1"><Check size={14} /></button>
          <button onClick={cancel} className="text-gray-400 hover:text-gray-600 p-1"><X size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="group cursor-pointer" onClick={() => { setDraft(value); setEditing(true); }}>
      <div className="text-[11px] text-[#9CA3AF] uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-[15px] font-medium text-[#111827]">{value}</span>
        <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
