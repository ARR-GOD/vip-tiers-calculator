import { useState } from 'react';
import { X, Phone, MessageSquareQuote, Target, AlertTriangle, Users2 } from 'lucide-react';

const FR = {
  title: 'Insights Fireflies',
  loyaltyMentioned: 'Le client a mentionné la fidélité en rendez-vous',
  referralMentioned: 'Le parrainage a été évoqué',
  budgetMentioned: 'Un budget a été discuté',
  painPoints: 'Points de friction',
  goals: 'Objectifs évoqués',
  competitors: 'Concurrents mentionnés',
  keyQuotes: 'Citations clés',
  meetings: (n) => `${n} meeting${n > 1 ? 's' : ''} analysé${n > 1 ? 's' : ''}`,
  lastMeeting: 'Dernier meeting',
};

const EN = {
  title: 'Fireflies Insights',
  loyaltyMentioned: 'Client mentioned loyalty in meetings',
  referralMentioned: 'Referral was discussed',
  budgetMentioned: 'Budget was discussed',
  painPoints: 'Pain points',
  goals: 'Goals mentioned',
  competitors: 'Competitors mentioned',
  keyQuotes: 'Key quotes',
  meetings: (n) => `${n} meeting${n > 1 ? 's' : ''} analyzed`,
  lastMeeting: 'Last meeting',
};

export default function FirefliesInsightBanner({ insights, stepKey, lang }) {
  const storageKey = `vip_fireflies_dismissed_${stepKey}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true'; }
    catch { return false; }
  });

  if (dismissed || !insights || !insights.insights) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, 'true'); } catch { /* noop */ }
  };

  const t = lang === 'fr' ? FR : EN;
  const ins = insights.insights;

  // Determine what to show based on stepKey
  const showLoyalty = stepKey === 'missions' && ins.loyaltyMentioned;
  const showReferral = stepKey === 'missions' && ins.referralMentioned;
  const showSummary = stepKey === 'dashboard';
  const showPainPoints = stepKey === 'dashboard' && ins.painPoints?.length > 0;
  const showGoals = stepKey === 'dashboard' && ins.goals?.length > 0;
  const showCompetitors = stepKey === 'dashboard' && ins.competitorsMentioned?.length > 0;
  const showQuotes = stepKey === 'dashboard' && ins.keyQuotes?.length > 0;

  // Don't render if nothing relevant for this step
  if (stepKey === 'missions' && !showLoyalty && !showReferral) return null;
  if (stepKey === 'dashboard' && !showSummary && !showPainPoints && !showGoals) return null;

  return (
    <div style={{ backgroundColor: '#ECFEFF', borderLeft: '3px solid #06B6D4', borderRadius: 10, padding: '16px 20px' }}
      className="mb-3">
      <div className="flex items-start gap-3">
        <Phone size={16} style={{ color: '#06B6D4' }} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#0E7490' }}>
              {t.title}
            </div>
            <span className="text-[10px] text-[#8A7D6B]">
              {t.meetings(insights.meetingsFound)}
              {insights.lastMeetingDate && ` · ${t.lastMeeting}: ${insights.lastMeetingDate}`}
            </span>
          </div>

          {/* Missions step: loyalty/referral flags */}
          {showLoyalty && (
            <p className="text-[13px] text-[#645648] leading-relaxed mb-1">
              <Target size={12} className="inline mr-1 text-[#06B6D4]" />
              {t.loyaltyMentioned}
            </p>
          )}
          {showReferral && (
            <p className="text-[13px] text-[#645648] leading-relaxed mb-1">
              <Users2 size={12} className="inline mr-1 text-[#06B6D4]" />
              {t.referralMentioned}
            </p>
          )}

          {/* Dashboard step: full summary */}
          {showSummary && insights.summary && (
            <p className="text-[13px] text-[#645648] leading-relaxed mb-2">{insights.summary}</p>
          )}

          {showPainPoints && (
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-[#0E7490] mb-0.5">
                <AlertTriangle size={11} className="inline mr-1" />
                {t.painPoints}
              </div>
              <div className="flex flex-wrap gap-1">
                {ins.painPoints.map((p, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[#CFFAFE] text-[#0E7490]">{p}</span>
                ))}
              </div>
            </div>
          )}

          {showGoals && (
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-[#0E7490] mb-0.5">
                <Target size={11} className="inline mr-1" />
                {t.goals}
              </div>
              <div className="flex flex-wrap gap-1">
                {ins.goals.map((g, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[#CFFAFE] text-[#0E7490]">{g}</span>
                ))}
              </div>
            </div>
          )}

          {showCompetitors && (
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-[#0E7490] mb-0.5">{t.competitors}</div>
              <span className="text-[12px] text-[#645648]">{ins.competitorsMentioned.join(', ')}</span>
            </div>
          )}

          {showQuotes && (
            <div>
              <div className="text-[11px] font-semibold text-[#0E7490] mb-0.5">
                <MessageSquareQuote size={11} className="inline mr-1" />
                {t.keyQuotes}
              </div>
              {ins.keyQuotes.slice(0, 3).map((q, i) => (
                <p key={i} className="text-[12px] text-[#645648] italic leading-relaxed">"{q}"</p>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleDismiss}
          className="text-[#8A7D6B] hover:text-[#645648] transition-colors shrink-0 mt-0.5">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
