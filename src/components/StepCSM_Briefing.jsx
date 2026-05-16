import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Building2, Phone, Globe, MapPin, TrendingUp, Target, AlertTriangle, MessageSquareQuote, Sparkles, CheckCircle2, Loader2, Users2, Wrench, Calendar, Mail } from 'lucide-react';
import { buildCsmOnboardingAnswers } from '../data/csmPresets';

const INDUSTRY_OPTIONS = [
  { value: 'fashion', labelFr: 'Mode', labelEn: 'Fashion' },
  { value: 'beauty', labelFr: 'Beaute', labelEn: 'Beauty' },
  { value: 'food', labelFr: 'Alimentation', labelEn: 'Food & Beverage' },
  { value: 'health', labelFr: 'Sante / Bien-etre', labelEn: 'Health & Wellness' },
  { value: 'electronics', labelFr: 'Electronique', labelEn: 'Electronics' },
  { value: 'sports', labelFr: 'Sport', labelEn: 'Sports' },
  { value: 'home', labelFr: 'Maison', labelEn: 'Home & Garden' },
  { value: 'other', labelFr: 'Autre', labelEn: 'Other' },
];

const PRICE_RANGE_OPTIONS = [
  { value: 'low', labelFr: '< 30\u20ac', labelEn: '< \u20ac30' },
  { value: 'medium', labelFr: '30-80\u20ac', labelEn: '\u20ac30-80' },
  { value: 'high', labelFr: '80-200\u20ac', labelEn: '\u20ac80-200' },
  { value: 'premium', labelFr: '> 200\u20ac', labelEn: '> \u20ac200' },
];

const GOAL_OPTIONS = [
  { value: 'retention', labelFr: 'Fidelisation', labelEn: 'Retention' },
  { value: 'referral', labelFr: 'Parrainage', labelEn: 'Referral' },
  { value: 'aov', labelFr: 'Augmenter le panier', labelEn: 'Increase AOV' },
  { value: 'engagement', labelFr: 'Engagement', labelEn: 'Engagement' },
];

const FR = {
  title: 'Briefing client',
  subtitle: 'Contexte du client avant de lancer le calculateur.',
  hubspotSection: 'Donnees HubSpot',
  firefliesSection: 'Insights Fireflies',
  preconfigSection: 'Pre-configuration',
  preconfigDesc: 'Ces parametres ont ete deduits des donnees HubSpot et Fireflies. Vous pouvez les ajuster.',
  industry: 'Secteur',
  priceRange: 'Gamme de prix',
  goals: 'Objectifs',
  launch: 'Lancer le calculateur',
  back: 'Retour',
  csvTip: 'Pour des projections precises, pensez a importer le fichier transactionnel du client a l\'etape Import.',
  mrr: 'MRR',
  annualRevenue: 'CA Annuel',
  sector: 'Secteur',
  phase: 'Phase',
  contacts: 'Contacts',
  plan: 'Plan',
  platform: 'Plateforme',
  country: 'Pays',
  noFireflies: 'Aucun call trouve pour ce client',
  firefliesLoading: 'Analyse des calls en cours...',
  summary: 'Resume',
  topics: 'Sujets mentionnes',
  painPoints: 'Points de friction',
  actions: 'Actions en cours',
  keyQuotes: 'Citations cles',
  meetings: (n) => `${n} meeting${n > 1 ? 's' : ''} trouve${n > 1 ? 's' : ''}`,
  lastMeeting: 'Dernier',
};

const EN = {
  title: 'Client Briefing',
  subtitle: 'Client context before launching the calculator.',
  hubspotSection: 'HubSpot Data',
  firefliesSection: 'Fireflies Insights',
  preconfigSection: 'Pre-configuration',
  preconfigDesc: 'These parameters were inferred from HubSpot and Fireflies data. You can adjust them.',
  industry: 'Industry',
  priceRange: 'Price range',
  goals: 'Goals',
  launch: 'Launch calculator',
  back: 'Back',
  csvTip: 'For precise projections, consider importing the client\'s transaction file at the Import step.',
  mrr: 'MRR',
  annualRevenue: 'Annual Revenue',
  sector: 'Sector',
  phase: 'Phase',
  contacts: 'Contacts',
  plan: 'Plan',
  platform: 'Platform',
  country: 'Country',
  noFireflies: 'No calls found for this client',
  firefliesLoading: 'Analyzing calls...',
  summary: 'Summary',
  topics: 'Topics mentioned',
  painPoints: 'Pain points',
  actions: 'Actions in progress',
  keyQuotes: 'Key quotes',
  meetings: (n) => `${n} meeting${n > 1 ? 's' : ''} found`,
  lastMeeting: 'Last',
};

function mapInsightsToGoals(insights) {
  if (!insights) return [];
  const goals = [];
  if (insights.loyaltyMentioned) goals.push('retention');
  if (insights.referralMentioned) goals.push('referral');
  if (insights.vipTiersMentioned) goals.push('aov');
  if (insights.goals?.some(g => g.toLowerCase().includes('engagement'))) goals.push('engagement');
  if (insights.goals?.some(g => /r[eé]tention/i.test(g) || /fid[eé]li/i.test(g))) {
    if (!goals.includes('retention')) goals.push('retention');
  }
  return [...new Set(goals)];
}

function formatMoney(v, suffix = '\u20ac') {
  if (!v || v === 0) return '-';
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M${suffix}`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k${suffix}`;
  return `${v}${suffix}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function StepCSM_Briefing({ selectedClient, clientDetails, firefliesInsights, firefliesLoading, lang, onLaunch, onBack }) {
  const t = lang === 'fr' ? FR : EN;
  const company = clientDetails?.company || {};
  const contacts = clientDetails?.contacts || selectedClient?.contacts || [];

  // Build initial pre-config from HubSpot data
  const initialAnswers = useMemo(() => buildCsmOnboardingAnswers(company), [company]);

  const [industry, setIndustry] = useState(initialAnswers.industry || 'other');
  const [priceRange, setPriceRange] = useState(initialAnswers.priceRange || 'medium');
  const [goals, setGoals] = useState(() => mapInsightsToGoals(firefliesInsights?.insights));

  // Update goals when Fireflies data arrives asynchronously
  const insightsKey = firefliesInsights?.meetingsFound || 0;
  useEffect(() => {
    if (firefliesInsights?.insights) {
      setGoals(prev => {
        const mapped = mapInsightsToGoals(firefliesInsights.insights);
        const merged = [...prev];
        for (const g of mapped) {
          if (!merged.includes(g)) merged.push(g);
        }
        return merged;
      });
    }
  }, [insightsKey]);

  const toggleGoal = (val) => {
    setGoals(prev => prev.includes(val) ? prev.filter(g => g !== val) : [...prev, val]);
  };

  const handleLaunch = () => {
    onLaunch({ industry, priceRange, goals });
  };

  const clientName = selectedClient?.name || company.name || '';
  const domain = company.domain || selectedClient?.domain || '';
  const plan = company.plan || selectedClient?.plan || '';
  const mrrValue = company.mrrCsm || parseFloat(company.mrr_csm) || 0;
  const mrrSource = company.mrrSource || 'none';
  const [manualMrr, setManualMrr] = useState('');
  const annualRevenue = parseFloat(company.annualrevenue || company.annualRevenue || company.annual_revenue) || 0;
  const lifecycle = company.lifecyclestage || company.lifecycle_stage || '';
  const platform = company.platform || company.ecommerce_platform || '';
  const country = company.country || '';
  const industryRaw = company.industry || company.industries || '';

  const ins = firefliesInsights?.insights;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="section-subheader">{lang === 'fr' ? 'MODE CSM' : 'CSM MODE'}</div>
        <h2 className="text-[28px] font-bold text-[#52473C]">{t.title}</h2>
        <p className="text-[15px] text-[#645648] mt-0.5">{t.subtitle}</p>
      </div>

      {/* Section 1: HubSpot Data */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <div className="section-subheader mb-3" style={{ color: '#2965FE' }}>
          <Building2 size={12} className="inline mr-1" />
          {t.hubspotSection}
        </div>

        {/* Client identity */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[16px] font-bold text-white"
            style={{ backgroundColor: '#2965FE' }}>
            {getInitials(clientName)}
          </div>
          <div className="flex-1">
            <div className="text-[18px] font-bold text-[#52473C]">{clientName}</div>
            <div className="flex items-center gap-2 text-[13px] text-[#8A7D6B] mt-0.5">
              {domain && <><Globe size={12} className="inline" /> {domain}</>}
              {platform && <><span className="text-[#D9D5CB]">|</span> {platform}</>}
              {country && <><span className="text-[#D9D5CB]">|</span> <MapPin size={12} className="inline" /> {country}</>}
            </div>
          </div>
          {plan && (
            <span className="pill pill-purple text-[11px] font-semibold">{plan}</span>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {mrrSource === 'none' && !manualMrr ? (
            <div className="bg-[#EEEDE6] rounded-xl px-4 py-3 text-center">
              <div className="text-[11px] text-[#8A7D6B] mb-1 flex items-center justify-center gap-1">
                <TrendingUp size={14} /> {t.mrr}
              </div>
              <input type="number" placeholder="MRR €" value={manualMrr}
                onChange={e => setManualMrr(e.target.value)}
                className="w-full text-center text-[14px] font-bold text-[#52473C] bg-white border border-[#D9D5CB] rounded-lg px-2 py-1" />
            </div>
          ) : (
            <KPICard
              label={t.mrr}
              value={formatMoney(manualMrr ? parseFloat(manualMrr) : mrrValue)}
              icon={<TrendingUp size={14} />}
              subtitle={mrrSource === 'deals_mrr' || mrrSource === 'deals_total' || mrrSource === 'app_spend' ? (lang === 'fr' ? '(estimé)' : '(estimated)') : null}
            />
          )}
          <KPICard label={t.annualRevenue} value={formatMoney(annualRevenue)} icon={<TrendingUp size={14} />} />
          <KPICard label={t.sector} value={industryRaw || '-'} icon={<Target size={14} />} />
          <KPICard label={t.phase} value={lifecycle || '-'} icon={<CheckCircle2 size={14} />} />
        </div>

        {/* Contacts */}
        {contacts.length > 0 && (
          <div className="text-[13px] text-[#645648]">
            <span className="font-medium text-[#52473C]"><Users2 size={12} className="inline mr-1" />{t.contacts} :</span>{' '}
            {contacts.slice(0, 5).map((c, i) => (
              <span key={i}>
                {c.firstname || ''} {c.lastname || ''}{c.jobtitle ? ` (${c.jobtitle})` : ''}
                {i < Math.min(contacts.length, 5) - 1 ? ', ' : ''}
              </span>
            ))}
            {contacts.length > 5 && <span className="text-[#8A7D6B]"> +{contacts.length - 5}</span>}
          </div>
        )}
      </div>

      {/* Section 2: Fireflies Insights — disabled */}
      {false && (
        <div className="card" style={{ padding: '24px 28px' }}>
        <div className="section-subheader mb-3" style={{ color: '#06B6D4' }}>
          <Phone size={12} className="inline mr-1" />
          {t.firefliesSection}
        </div>

        {firefliesLoading && (
          <div className="flex items-center gap-2 text-[13px] text-[#8A7D6B] italic py-4">
            <Loader2 size={16} className="animate-spin text-[#06B6D4]" />
            {t.firefliesLoading}
          </div>
        )}

        {!firefliesLoading && (!firefliesInsights || (firefliesInsights.meetingsFound === 0 && !ins)) && (
          <p className="text-[13px] text-[#8A7D6B] italic py-2">{t.noFireflies}</p>
        )}

        {!firefliesLoading && firefliesInsights && (firefliesInsights.meetingsFound > 0 || ins) && (
          <div className="space-y-3">
            {/* Meeting count */}
            <div className="flex items-center gap-2 text-[12px] text-[#8A7D6B]">
              <span className="font-medium text-[#0E7490]">{t.meetings(firefliesInsights.meetingsFound)}</span>
              {firefliesInsights.lastMeetingDate && (
                <span>| {t.lastMeeting}: {firefliesInsights.lastMeetingDate}</span>
              )}
            </div>

            {/* Summary */}
            {firefliesInsights.summary && (
              <div>
                <div className="text-[11px] font-semibold text-[#0E7490] mb-1">
                  <Sparkles size={11} className="inline mr-1" />{t.summary}
                </div>
                <p className="text-[13px] text-[#645648] leading-relaxed">{firefliesInsights.summary}</p>
              </div>
            )}

            {/* Topics tags */}
            {ins && (
              <div>
                <div className="text-[11px] font-semibold text-[#0E7490] mb-1">
                  <Target size={11} className="inline mr-1" />{t.topics}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ins.loyaltyMentioned && <Tag label={lang === 'fr' ? 'Fidélité' : 'Loyalty'} active />}
                  {ins.referralMentioned && <Tag label={lang === 'fr' ? 'Parrainage' : 'Referral'} active />}
                  {ins.budgetMentioned && <Tag label="Budget" active />}
                  {ins.vipTiersMentioned && <Tag label={lang === 'fr' ? 'Paliers VIP' : 'VIP Tiers'} active />}
                  {ins.goals?.map((g, i) => <Tag key={i} label={g} />)}
                </div>
              </div>
            )}

            {/* Reward types */}
            {ins?.rewardTypes?.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-[#0E7490] mb-1">
                  🎁 {lang === 'fr' ? 'Récompenses discutées' : 'Rewards discussed'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ins.rewardTypes.map((r, i) => <Tag key={i} label={r} />)}
                </div>
              </div>
            )}

            {/* Integrations */}
            {ins?.integrations?.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-[#0E7490] mb-1">
                  <Wrench size={11} className="inline mr-1" /> {lang === 'fr' ? 'Intégrations' : 'Integrations'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ins.integrations.map((integ, i) => <Tag key={i} label={integ} active />)}
                </div>
              </div>
            )}

            {/* Timeline + Budget */}
            {(ins?.timeline || ins?.budgetInfo) && (
              <div className="flex flex-wrap gap-4 text-[12px] text-[#645648]">
                {ins.timeline && (
                  <span><Calendar size={11} className="inline mr-1 text-[#0E7490]" /><strong>{lang === 'fr' ? 'Planning' : 'Timeline'}:</strong> {ins.timeline}</span>
                )}
                {ins.budgetInfo && (
                  <span><TrendingUp size={11} className="inline mr-1 text-[#0E7490]" /><strong>Budget:</strong> {ins.budgetInfo}</span>
                )}
              </div>
            )}

            {/* Key decisions */}
            {ins?.keyDecisions?.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-[#0E7490] mb-1">
                  <CheckCircle2 size={11} className="inline mr-1" /> {lang === 'fr' ? 'Décisions clés' : 'Key decisions'}
                </div>
                <ul className="text-[12px] text-[#645648] space-y-0.5">
                  {ins.keyDecisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#059669] mt-0.5">✓</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pain points */}
            {ins?.painPoints?.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-[#0E7490] mb-1">
                  <AlertTriangle size={11} className="inline mr-1" />{t.painPoints}
                </div>
                <ul className="text-[12px] text-[#645648] space-y-0.5">
                  {ins.painPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#F59E0B] mt-0.5">&bull;</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contacts from meetings */}
            {firefliesInsights.contacts?.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-[#0E7490] mb-1">
                  <Users2 size={11} className="inline mr-1" /> {lang === 'fr' ? 'Contacts clés (meetings)' : 'Key contacts (meetings)'}
                </div>
                <div className="flex flex-wrap gap-2 text-[12px] text-[#645648]">
                  {firefliesInsights.contacts.map((c, i) => (
                    <span key={i} className="bg-[#F0FFFE] px-2 py-0.5 rounded-full">
                      {c.name}{c.role ? ` — ${c.role}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Section 3: Pre-configuration */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <div className="section-subheader mb-1" style={{ color: '#059669' }}>
          <Sparkles size={12} className="inline mr-1" />
          {t.preconfigSection}
        </div>
        <p className="text-[13px] text-[#8A7D6B] mb-4">{t.preconfigDesc}</p>

        <div className="grid grid-cols-2 gap-4">
          {/* Industry */}
          <div>
            <label className="text-[12px] font-medium text-[#645648] mb-1 block">{t.industry}</label>
            <select value={industry} onChange={e => setIndustry(e.target.value)}
              className="w-full px-3 py-2 text-[14px] rounded-lg border border-[#D9D5CB] bg-white text-[#52473C]">
              {INDUSTRY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'fr' ? opt.labelFr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Price range */}
          <div>
            <label className="text-[12px] font-medium text-[#645648] mb-1 block">{t.priceRange}</label>
            <select value={priceRange} onChange={e => setPriceRange(e.target.value)}
              className="w-full px-3 py-2 text-[14px] rounded-lg border border-[#D9D5CB] bg-white text-[#52473C]">
              {PRICE_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'fr' ? opt.labelFr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Goals checkboxes */}
        <div className="mt-4">
          <label className="text-[12px] font-medium text-[#645648] mb-2 block">{t.goals}</label>
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => toggleGoal(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border ${
                  goals.includes(opt.value)
                    ? 'bg-[#E8EFFE] text-primary border-primary/30'
                    : 'bg-white text-[#645648] border-[#D9D5CB] hover:bg-[#F5F4F0]'
                }`}>
                {goals.includes(opt.value) && <CheckCircle2 size={12} className="inline mr-1" />}
                {lang === 'fr' ? opt.labelFr : opt.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[14px] text-[#8A7D6B] hover:text-[#52473C] transition-colors">
          <ArrowLeft size={16} /> {t.back}
        </button>
        <button onClick={handleLaunch} className="btn-primary text-[15px] px-6 py-3">
          {t.launch} <ArrowRight size={16} className="ml-1" />
        </button>
      </div>

      {/* CSV tip */}
      <div className="text-center text-[12px] text-[#8A7D6B] italic pb-4">
        {t.csvTip}
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, subtitle }) {
  return (
    <div className="bg-[#EEEDE6] rounded-xl px-4 py-3 text-center">
      <div className="text-[11px] text-[#8A7D6B] mb-1 flex items-center justify-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-[16px] font-bold text-[#52473C]">{value}</div>
      {subtitle && <div className="text-[10px] text-[#8A7D6B] italic">{subtitle}</div>}
    </div>
  );
}

function Tag({ label, active }) {
  return (
    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
      active
        ? 'bg-[#CFFAFE] text-[#0E7490]'
        : 'bg-[#F0FFFE] text-[#8A7D6B]'
    }`}>
      {active && <CheckCircle2 size={10} className="inline mr-0.5" />}
      {label}
    </span>
  );
}
