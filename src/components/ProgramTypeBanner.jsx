import { Crown, Zap, Users } from 'lucide-react';

const PROGRAM_CONFIG = {
  luxury: {
    Icon: Crown,
    color: '#B8860B',
    bgColor: '#FFFBEB',
    borderColor: '#FEF3C7',
    labelFr: 'Programme Prestige',
    labelEn: 'Prestige Program',
    descFr: 'Perks exclusifs \u00b7 Paliers sur CA \u00b7 Pas de points',
    descEn: 'Exclusive perks \u00b7 Spend tiers \u00b7 No points',
  },
  mid: {
    Icon: Zap,
    color: '#6B4EFF',
    bgColor: '#F3F0FF',
    borderColor: '#E8E1FF',
    labelFr: 'Programme \u00c9quilibr\u00e9',
    labelEn: 'Balanced Program',
    descFr: 'Points + missions \u00b7 Perks & r\u00e9ductions',
    descEn: 'Points + missions \u00b7 Perks & discounts',
  },
  mass: {
    Icon: Users,
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#D1FAE5',
    labelFr: 'Programme Engagement',
    labelEn: 'Engagement Program',
    descFr: 'Points \u00b7 Toutes missions \u00b7 Bons & r\u00e9compenses',
    descEn: 'Points \u00b7 All missions \u00b7 Vouchers & rewards',
  },
};

function BrandAvatar({ brandName, brandLogo, size = 20 }) {
  if (brandLogo) {
    return (
      <img src={brandLogo} alt={brandName} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    );
  }
  const initials = (brandName || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: '#6B4EFF', color: 'white', fontSize: size * 0.45, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initials}
    </span>
  );
}

export default function ProgramTypeBanner({ programType, brandName, brandLogo, lang, onEdit }) {
  const t = lang === 'fr';
  const cfg = PROGRAM_CONFIG[programType] || PROGRAM_CONFIG.mid;
  const { Icon } = cfg;

  return (
    <div style={{ backgroundColor: cfg.bgColor, borderBottom: `1px solid ${cfg.borderColor}` }}>
      <div className="max-w-[1100px] mx-auto px-6 py-2.5 flex items-center gap-3 text-[12px]">
        <Icon size={14} style={{ color: cfg.color }} />
        <span className="font-bold" style={{ color: cfg.color }}>
          {t ? cfg.labelFr : cfg.labelEn}
        </span>
        {brandName && (
          <>
            <span className="text-gray-300">|</span>
            <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={20} />
            <span className="text-[#6B7280]">{brandName}</span>
          </>
        )}
        <span className="text-gray-300">|</span>
        <span className="text-[#9CA3AF]">{t ? cfg.descFr : cfg.descEn}</span>
        {onEdit && (
          <button onClick={onEdit} className="ml-auto font-medium hover:underline" style={{ color: cfg.color }}>
            {t ? 'Modifier' : 'Edit'}
          </button>
        )}
      </div>
    </div>
  );
}
