import { useState, useRef } from 'react';
import { Upload, Database, FileSpreadsheet, X } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Tooltip from './Tooltip';
import BenchmarkBadge, { BenchmarkBar } from './BenchmarkBadge';
import { formatCurrency, formatNumber } from '../utils/calculations';
import { parseSampleData } from '../data/sampleData';

export default function Step1_DataSettings({ config, setConfig, customers, setCustomers, settings, setSettings, lang }) {
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
            total_ordered_TTC: parseFloat(row.total_ordered_TTC || row.revenue || row.ltv || row['amount spent'] || 0),
            number_of_orders: parseInt(row.number_of_orders || row.orders || 0) || Math.max(1, Math.floor((parseFloat(row['amount spent'] || 0)) / 60)),
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
          total_ordered_TTC: parseFloat(row.total_ordered_TTC || row.revenue || row.ltv || row['amount spent'] || 0),
          number_of_orders: parseInt(row.number_of_orders || row.orders || 0) || Math.max(1, Math.floor((parseFloat(row['amount spent'] || 0)) / 60)),
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

  const resetToSample = () => { setCustomers(parseSampleData()); setFileName(null); setError(null); };

  const totalRevenue = customers.reduce((s, c) => s + c.total_ordered_TTC, 0);
  const activeCustomers = customers.filter(c => c.total_ordered_TTC > 0).length;

  return (
    <div className="space-y-5">
      <div>
        <div className="section-subheader">{lang === 'fr' ? 'ÉTAPE 2' : 'STEP 2'}</div>
        <h2 className="text-[22px] font-bold text-[#111827]">{t.title}</h2>
        <p className="text-[15px] text-[#6B7280] mt-0.5">{t.subtitle}</p>
      </div>

      {/* Program Config */}
      <div>
        <div className="section-header">{lang === 'fr' ? 'CONFIGURATION DU PROGRAMME' : 'PROGRAM CONFIGURATION'}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ConfigCard title={t.tierBasis} tooltip={t.tierBasisTip}
            options={[{ value: 'spend', label: t.spend }, { value: 'points', label: t.points }]}
            selected={config.tierBasis} onChange={v => update('tierBasis', v)} />
          <ConfigCard title={t.missions} tooltip={t.missionsTip}
            options={[{ value: true, label: t.withMissions }, { value: false, label: t.noMissions }]}
            selected={config.hasMissions} onChange={v => update('hasMissions', v)} />
          <ConfigCard title={t.rewards} tooltip={t.rewardsTip}
            options={[{ value: 'burn', label: t.burn }, { value: 'perks', label: t.perks }, { value: 'both', label: t.both }]}
            selected={config.rewardType} onChange={v => update('rewardType', v)} />
          <ConfigCard title={t.expiration} tooltip={t.expirationTip}
            options={[{ value: false, label: t.noExpiry }, { value: true, label: t.withExpiry }]}
            selected={config.pointsExpire} onChange={v => update('pointsExpire', v)} />
        </div>
      </div>

      {config.pointsExpire && (
        <div className="card flex flex-wrap items-center gap-4" style={{ padding: 16 }}>
          <label className="text-[13px] text-[#6B7280]">{t.delay}</label>
          <input type="number" min={1} max={60} value={config.expirationMonths}
            onChange={e => update('expirationMonths', parseInt(e.target.value) || 12)}
            className="w-20 px-2 py-1.5 text-[13px] text-center" />
          <span className="text-[13px] text-[#9CA3AF]">{t.months}</span>
          <div className="flex gap-1.5 ml-2">
            {['rolling', 'fixed'].map(type => (
              <button key={type} onClick={() => update('expirationType', type)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all
                  ${config.expirationType === type ? 'bg-primary text-white' : 'bg-gray-100 text-[#6B7280]'}`}>
                {type === 'rolling' ? t.rolling : t.fixed}
              </button>
            ))}
          </div>
          <div className="ml-auto"><BenchmarkBadge benchmarkKey="expirationMonths" value={config.expirationMonths} lang={lang} /></div>
        </div>
      )}

      {/* Data + Params */}
      <div>
        <div className="section-header">{lang === 'fr' ? 'DONNÉES & PARAMÈTRES' : 'DATA & PARAMETERS'}</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card" style={{ padding: 24 }}>
            <div className="section-subheader">{t.dataSource.toUpperCase()}</div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-[13px] text-[#6B7280] hover:border-primary hover:text-primary transition-all">
                <Upload size={16} /> {t.uploadFile}
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
              <button onClick={resetToSample}
                className="flex items-center gap-2 px-4 py-3 bg-primary-50 text-primary rounded-xl text-[13px] font-medium hover:bg-primary-100 transition-all">
                <Database size={16} /> {t.sampleData}
              </button>
            </div>
            {fileName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg mb-3">
                <FileSpreadsheet size={14} className="text-primary" />
                <span className="text-[12px] text-[#6B7280] flex-1 truncate">{fileName}</span>
                <button onClick={resetToSample} className="text-gray-400 hover:text-red-500 transition-all"><X size={12} /></button>
              </div>
            )}
            {error && <div className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</div>}
            <div className="grid grid-cols-3 gap-3">
              <MiniStat value={formatNumber(customers.length)} label={t.totalCustomers} />
              <MiniStat value={formatCurrency(totalRevenue)} label={t.totalRevenue} />
              <MiniStat value={formatNumber(totalRevenue / (activeCustomers || 1))} label="LTV" suffix="€" />
            </div>
          </div>

          <div className="card space-y-4" style={{ padding: 24 }}>
            <div className="section-subheader">{t.keyParams.toUpperCase()}</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] text-[#6B7280] mb-1 block">{t.aov}</label>
                <div className="relative">
                  <input type="number" value={settings.aov}
                    onChange={e => setSettings(p => ({ ...p, aov: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 pr-8 text-[15px]" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9CA3AF]">€</span>
                </div>
              </div>
              <div>
                <label className="text-[12px] text-[#6B7280] mb-1 block">{t.margin}</label>
                <div className="relative">
                  <input type="number" value={settings.grossMargin}
                    onChange={e => setSettings(p => ({ ...p, grossMargin: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 pr-8 text-[15px]" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9CA3AF]">%</span>
                </div>
                <BenchmarkBadge benchmarkKey="grossMargin" value={settings.grossMargin} lang={lang} />
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-[12px] font-medium text-[#374151]">{t.cashbackRate}</label>
                  <Tooltip text={t.cashbackTip} />
                </div>
                <span className="text-[18px] font-bold text-primary">{settings.cashbackRate}%</span>
              </div>
              <input type="range" min={0.5} max={10} step={0.5} value={settings.cashbackRate}
                onChange={e => setSettings(p => ({ ...p, cashbackRate: parseFloat(e.target.value) }))} />
              <BenchmarkBar benchmarkKey="cashbackRate" value={settings.cashbackRate} />
              <div className="mt-2"><BenchmarkBadge benchmarkKey="cashbackRate" value={settings.cashbackRate} lang={lang} /></div>
              {settings.grossMargin > 0 && (
                <div className="mt-2 text-[11px] text-[#9CA3AF]">
                  = {((settings.cashbackRate / settings.grossMargin) * 100).toFixed(1)}% {t.ofMargin}
                  {settings.cashbackRate > settings.grossMargin * 0.08 && (
                    <span className="ml-2 text-red-500 font-medium">{'>'}8% {t.ofMargin}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigCard({ title, tooltip, options, selected, onChange }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[12px] font-semibold text-[#374151]">{title}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="flex flex-col gap-1">
        {options.map(opt => (
          <button key={String(opt.value)} onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all border
              ${selected === opt.value
                ? 'bg-primary-50 text-primary border-primary-200'
                : 'text-[#6B7280] hover:bg-gray-50 border-transparent'}`}>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ value, label, suffix }) {
  return (
    <div className="text-center p-2.5 bg-gray-50 rounded-lg">
      <div className="text-[15px] font-bold text-[#111827]">{value}{suffix}</div>
      <div className="text-[11px] text-[#9CA3AF] mt-0.5">{label}</div>
    </div>
  );
}

const FR = {
  title: 'Données & Paramètres', subtitle: 'Importez vos données clients et configurez le programme.',
  tierBasis: 'Base des paliers', tierBasisTip: 'Montant dépensé ou points accumulés.',
  spend: 'Dépenses (€)', points: 'Points',
  missions: 'Missions', missionsTip: 'Gagner des points via des actions hors achats.',
  withMissions: 'Avec missions', noMissions: 'Sans missions',
  rewards: 'Récompenses', rewardsTip: 'Burn (points), Perks (palier) ou les deux.',
  burn: 'Points brûlés', perks: 'Avantages VIP', both: 'Les deux',
  expiration: 'Expiration', expirationTip: 'Les points expirent-ils ?',
  noExpiry: 'Non', withExpiry: 'Oui',
  delay: 'Délai', months: 'mois', rolling: 'Glissant', fixed: 'Fixe',
  dataSource: 'Données clients', uploadFile: 'Importer CSV / XLSX', sampleData: 'Données démo',
  noData: 'Aucune donnée trouvée.', parseError: 'Erreur de parsing.', formatError: 'Format non supporté.',
  totalCustomers: 'Clients', totalRevenue: 'CA total',
  keyParams: 'Paramètres clés', aov: 'Panier moyen (AOV)', margin: 'Marge brute',
  cashbackRate: 'Taux de cashback (base)', cashbackTip: '% de la valeur d\'achat retourné en points.',
  ofMargin: 'de la marge',
};

const EN = {
  title: 'Data & Settings', subtitle: 'Import your customer data and configure the program.',
  tierBasis: 'Tier basis', tierBasisTip: 'Total spend or accumulated points.',
  spend: 'Total spend (€)', points: 'Points',
  missions: 'Missions', missionsTip: 'Earn points via non-purchase actions.',
  withMissions: 'With missions', noMissions: 'No missions',
  rewards: 'Rewards', rewardsTip: 'Burn (points), Perks (tier benefits) or both.',
  burn: 'Points burned', perks: 'VIP perks', both: 'Both',
  expiration: 'Expiration', expirationTip: 'Do points expire?',
  noExpiry: 'No', withExpiry: 'Yes',
  delay: 'Delay', months: 'months', rolling: 'Rolling', fixed: 'Fixed',
  dataSource: 'Customer data', uploadFile: 'Import CSV / XLSX', sampleData: 'Demo data',
  noData: 'No data found.', parseError: 'Parse error.', formatError: 'Unsupported format.',
  totalCustomers: 'Customers', totalRevenue: 'Total revenue',
  keyParams: 'Key parameters', aov: 'Avg order value (AOV)', margin: 'Gross margin',
  cashbackRate: 'Cashback rate (base)', cashbackTip: '% of purchase value returned as points.',
  ofMargin: 'of margin',
};
