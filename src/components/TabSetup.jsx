import { useState, useRef } from 'react';
import { Upload, Database, FileSpreadsheet, X, Settings, HelpCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Tooltip from './Tooltip';
import BenchmarkBadge, { BenchmarkBar } from './BenchmarkBadge';
import { formatCurrency, formatNumber } from '../utils/calculations';
import { parseSampleData } from '../data/sampleData';

export default function TabSetup({ config, setConfig, customers, setCustomers, settings, setSettings, lang }) {
  const t = lang === 'fr' ? FR : EN;
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);

  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
          const parsed = results.data.map(row => ({
            customer_id: row.customer_id || row.Customer_ID || row.id,
            total_ordered_TTC: parseFloat(row.total_ordered_TTC || row.revenue || row.ltv || 0),
            number_of_orders: parseInt(row.number_of_orders || row.orders || 0),
          })).filter(r => r.customer_id);
          if (parsed.length === 0) { setError(t.noData); return; }
          setCustomers(parsed);
          setFileName(file.name);
        },
        error: () => setError(t.parseError),
      });
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        const parsed = data.map(row => ({
          customer_id: row.customer_id || row.Customer_ID || row.id || '',
          total_ordered_TTC: parseFloat(row.total_ordered_TTC || row.revenue || row.ltv || 0),
          number_of_orders: parseInt(row.number_of_orders || row.orders || 0),
        })).filter(r => r.customer_id);
        if (parsed.length === 0) { setError(t.noData); return; }
        setCustomers(parsed);
        setFileName(file.name);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError(t.formatError);
    }
  };

  const resetToSample = () => {
    setCustomers(parseSampleData());
    setFileName(null);
    setError(null);
  };

  const totalRevenue = customers.reduce((s, c) => s + c.total_ordered_TTC, 0);
  const totalOrders = customers.reduce((s, c) => s + c.number_of_orders, 0);
  const activeCustomers = customers.filter(c => c.total_ordered_TTC > 0).length;

  return (
    <div className="space-y-5">
      {/* Program Config — compact cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ConfigCard
          title={t.tierBasis}
          tooltip={t.tierBasisTooltip}
          options={[
            { value: 'spend', label: t.spendBased, emoji: '💰' },
            { value: 'points', label: t.pointsBased, emoji: '⭐' },
          ]}
          selected={config.tierBasis}
          onChange={v => update('tierBasis', v)}
        />
        <ConfigCard
          title={t.missions}
          tooltip={t.missionsTooltip}
          options={[
            { value: true, label: t.withMissions, emoji: '✅' },
            { value: false, label: t.noMissions, emoji: '❌' },
          ]}
          selected={config.hasMissions}
          onChange={v => update('hasMissions', v)}
        />
        <ConfigCard
          title={t.rewards}
          tooltip={t.rewardsTooltip}
          options={[
            { value: 'burn', label: t.burn, emoji: '🎁' },
            { value: 'perks', label: t.perks, emoji: '🏆' },
            { value: 'both', label: t.both, emoji: '🔀' },
          ]}
          selected={config.rewardType}
          onChange={v => update('rewardType', v)}
        />
        <ConfigCard
          title={t.expiration}
          tooltip={t.expirationTooltip}
          options={[
            { value: false, label: t.noExpiry, emoji: '♾️' },
            { value: true, label: t.withExpiry, emoji: '⏳' },
          ]}
          selected={config.pointsExpire}
          onChange={v => update('pointsExpire', v)}
        />
      </div>

      {config.pointsExpire && (
        <div className="bg-[#EEEDE6] rounded-xl border border-[#D9D5CB] p-4 flex items-center gap-4">
          <label className="text-xs text-[#8A7D6B]">{t.delay}</label>
          <input
            type="number" min={1} max={60} value={config.expirationMonths}
            onChange={e => update('expirationMonths', parseInt(e.target.value) || 12)}
            className="w-20 px-2 py-1 border border-[#D9D5CB] rounded-lg text-sm text-center"
          />
          <span className="text-xs text-[#8A7D6B]">{t.months}</span>
          <div className="flex gap-2 ml-2">
            {['rolling', 'fixed'].map(type => (
              <button key={type} onClick={() => update('expirationType', type)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${config.expirationType === type ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648]'}`}>
                {type === 'rolling' ? t.rolling : t.fixed}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <BenchmarkBadge benchmarkKey="expirationMonths" value={config.expirationMonths} lang={lang} />
          </div>
        </div>
      )}

      {/* Data Import + Key Params side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Data Import */}
        <div className="bg-[#EEEDE6] rounded-xl border border-[#D9D5CB] p-5">
          <h3 className="font-semibold text-[#52473C] text-sm mb-3">{t.dataSource}</h3>

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#D9D5CB] rounded-xl text-sm text-[#8A7D6B] hover:border-primary hover:text-primary transition-colors"
            >
              <Upload size={16} />
              {t.uploadFile}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            <button
              onClick={resetToSample}
              className="flex items-center gap-2 px-4 py-3 bg-primary-50 text-primary rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors"
            >
              <Database size={16} /> {t.sampleData}
            </button>
          </div>

          {fileName && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#EEEDE6] rounded-lg mb-3">
              <FileSpreadsheet size={14} className="text-primary" />
              <span className="text-xs text-[#645648] flex-1 truncate">{fileName}</span>
              <button onClick={resetToSample} className="text-[#8A7D6B] hover:text-danger"><X size={12} /></button>
            </div>
          )}
          {error && <div className="text-xs text-danger bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</div>}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat value={formatNumber(customers.length)} label={t.totalCustomers} />
            <MiniStat value={formatCurrency(totalRevenue)} label={t.totalRevenue} />
            <MiniStat value={formatNumber(totalRevenue / (activeCustomers || 1))} label="LTV moy." suffix="€" />
          </div>
        </div>

        {/* Key Params */}
        <div className="bg-[#EEEDE6] rounded-xl border border-[#D9D5CB] p-5 space-y-4">
          <h3 className="font-semibold text-[#52473C] text-sm">{t.keyParams}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#8A7D6B] mb-1 block">{t.aov}</label>
              <div className="relative">
                <input type="number" value={settings.aov}
                  onChange={e => setSettings(p => ({ ...p, aov: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 pr-8 border border-[#D9D5CB] rounded-lg text-sm" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8A7D6B]">€</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#8A7D6B] mb-1 block">{t.margin}</label>
              <div className="relative">
                <input type="number" value={settings.grossMargin}
                  onChange={e => setSettings(p => ({ ...p, grossMargin: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 pr-8 border border-[#D9D5CB] rounded-lg text-sm" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8A7D6B]">%</span>
              </div>
              <BenchmarkBadge benchmarkKey="grossMargin" value={settings.grossMargin} lang={lang} />
            </div>
          </div>

          {/* Cashback Rate */}
          <div className="pt-3 border-t border-[#D9D5CB]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-[#645648]">{t.cashbackRate}</label>
                <Tooltip text={t.cashbackTooltip} />
              </div>
              <span className="text-lg font-bold text-primary">{settings.cashbackRate}%</span>
            </div>
            <input type="range" min={0.5} max={10} step={0.5}
              value={settings.cashbackRate}
              onChange={e => setSettings(p => ({ ...p, cashbackRate: parseFloat(e.target.value) }))}
            />
            <BenchmarkBar benchmarkKey="cashbackRate" value={settings.cashbackRate} />
            <div className="mt-2">
              <BenchmarkBadge benchmarkKey="cashbackRate" value={settings.cashbackRate} lang={lang} />
            </div>

            {/* Margin context */}
            {settings.grossMargin > 0 && (
              <div className="mt-2 text-[11px] text-[#8A7D6B]">
                = {((settings.cashbackRate / settings.grossMargin) * 100).toFixed(1)}% {t.ofMargin}
                {settings.cashbackRate > settings.grossMargin * 0.08 && (
                  <span className="ml-2 text-danger font-medium">
                    {lang === 'fr' ? '⚠ > 8% de la marge' : '⚠ > 8% of margin'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigCard({ title, tooltip, options, selected, onChange }) {
  return (
    <div className="bg-[#EEEDE6] rounded-xl border border-[#D9D5CB] p-3">
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs font-semibold text-[#645648]">{title}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="flex flex-col gap-1">
        {options.map(opt => (
          <button key={String(opt.value)} onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
              ${selected === opt.value
                ? 'bg-primary-50 text-primary border border-primary-200'
                : 'text-[#8A7D6B] hover:bg-[#EEEDE6] border border-transparent'}`}
          >
            <span>{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ value, label, suffix }) {
  return (
    <div className="text-center p-2 bg-[#EEEDE6] rounded-lg">
      <div className="text-sm font-bold text-[#52473C]">{value}{suffix}</div>
      <div className="text-[10px] text-[#8A7D6B] mt-0.5">{label}</div>
    </div>
  );
}

const FR = {
  tierBasis: 'Base des paliers', tierBasisTooltip: 'Montant dépensé ou points accumulés.',
  spendBased: 'Dépenses (€)', pointsBased: 'Points',
  missions: 'Missions', missionsTooltip: 'Gagner des points via des actions hors achats.',
  withMissions: 'Avec missions', noMissions: 'Sans missions',
  rewards: 'Récompenses', rewardsTooltip: 'Burn (points), Perks (avantages par palier) ou les deux.',
  burn: 'Points brûlés', perks: 'Avantages VIP', both: 'Les deux',
  expiration: 'Expiration', expirationTooltip: 'Les points expirent-ils ?',
  noExpiry: 'Non', withExpiry: 'Oui',
  delay: 'Délai', months: 'mois', rolling: 'Glissant', fixed: 'Fixe',
  dataSource: 'Données clients',
  uploadFile: 'Importer CSV / XLSX',
  sampleData: 'Données démo',
  noData: 'Aucune donnée trouvée.', parseError: 'Erreur de parsing.', formatError: 'Format non supporté.',
  totalCustomers: 'Clients', totalRevenue: 'CA total',
  keyParams: 'Paramètres clés',
  aov: 'Panier moyen (AOV)', margin: 'Marge brute',
  cashbackRate: 'Taux de cashback (palier de base)',
  cashbackTooltip: '% de la valeur d\'achat retourné en points. Multiplié par le multiplicateur de chaque palier.',
  ofMargin: 'de la marge',
};

const EN = {
  tierBasis: 'Tier basis', tierBasisTooltip: 'Total spend or accumulated points.',
  spendBased: 'Total spend (€)', pointsBased: 'Points',
  missions: 'Missions', missionsTooltip: 'Earn points via actions beyond purchases.',
  withMissions: 'With missions', noMissions: 'No missions',
  rewards: 'Rewards', rewardsTooltip: 'Burn (spend points), Perks (tier benefits) or both.',
  burn: 'Points burned', perks: 'VIP perks', both: 'Both',
  expiration: 'Expiration', expirationTooltip: 'Do points expire?',
  noExpiry: 'No', withExpiry: 'Yes',
  delay: 'Delay', months: 'months', rolling: 'Rolling', fixed: 'Fixed',
  dataSource: 'Customer data',
  uploadFile: 'Import CSV / XLSX',
  sampleData: 'Demo data',
  noData: 'No data found.', parseError: 'Parse error.', formatError: 'Format not supported.',
  totalCustomers: 'Customers', totalRevenue: 'Total revenue',
  keyParams: 'Key parameters',
  aov: 'Avg order value (AOV)', margin: 'Gross margin',
  cashbackRate: 'Cashback rate (base tier)',
  cashbackTooltip: '% of purchase value returned as points. Multiplied by each tier\'s multiplier.',
  ofMargin: 'of margin',
};
