import { getBenchmarkStatus, getBenchmarkColor, getBenchmarkReco, BENCHMARKS } from '../data/benchmarks';

export default function BenchmarkBadge({ benchmarkKey, value, lang }) {
  const status = getBenchmarkStatus(benchmarkKey, value);
  const colors = getBenchmarkColor(status);
  const reco = getBenchmarkReco(benchmarkKey, value, lang);
  const b = BENCHMARKS[benchmarkKey];
  if (!b || !reco) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text} border ${colors.border}`} style={{ transition: 'all 0.15s ease' }}>
      <span className="font-bold">{status === 'ok' ? '\u2713' : status === 'high' ? '!' : '\u2193'}</span>
      <span>{reco}</span>
    </div>
  );
}

export function BenchmarkBar({ benchmarkKey, value }) {
  const b = BENCHMARKS[benchmarkKey];
  if (!b || !b.low) return null;

  const max = b.max || b.high * 1.5;
  const pct = Math.min((value / max) * 100, 100);
  const lowPct = (b.low / max) * 100;
  const medPct = (b.median / max) * 100;
  const highPct = (b.high / max) * 100;

  return (
    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5">
      <div className="absolute inset-y-0 left-0 bg-amber-100" style={{ width: `${lowPct}%` }} />
      <div className="absolute inset-y-0 bg-emerald-100" style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }} />
      <div className="absolute inset-y-0 bg-red-100" style={{ left: `${highPct}%`, right: 0 }} />
      <div
        className="absolute top-0 w-2.5 h-2.5 rounded-full border-2 border-white -translate-x-1/2"
        style={{ left: `${pct}%`, backgroundColor: '#6B4EFF', boxShadow: '0 1px 3px rgba(107,78,255,0.3)' }}
      />
      <div className="absolute top-0 bottom-0 w-px bg-gray-300" style={{ left: `${medPct}%` }} />
    </div>
  );
}
