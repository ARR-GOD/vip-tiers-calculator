import { useState, useRef } from 'react';
import { Upload, Lock, CheckCircle, Database, FileSpreadsheet, X } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseSampleData } from '../data/sampleData';
import { formatCurrency, formatNumber } from '../utils/calculations';
import RecommendationBlock from './RecommendationBlock';
import { getRecommendation } from '../utils/recommendations';

export default function StepData_Import({ customers, setCustomers, lang, brandAnalysis, config, settings }) {
  const t = lang === 'fr';
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const reco = getRecommendation(1, { brandAnalysis, config, settings, customers, lang });

  const processFile = (file) => {
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
          if (parsed.length === 0) { setError(t ? 'Aucune donnée trouvée.' : 'No data found.'); return; }
          setCustomers(parsed);
          setFileName(file.name);
        },
        error: () => setError(t ? 'Erreur de parsing.' : 'Parse error.'),
      });
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          const parsed = data.map(row => ({
            customer_id: row.customer_id || row.Customer_ID || row.id || '',
            total_ordered_TTC: parseFloat(row.total_ordered_TTC || row.revenue || row.ltv || row['amount spent'] || 0),
            number_of_orders: parseInt(row.number_of_orders || row.orders || 0) || Math.max(1, Math.floor((parseFloat(row['amount spent'] || 0)) / 60)),
          })).filter(r => r.customer_id);
          if (parsed.length === 0) { setError(t ? 'Aucune donnée trouvée.' : 'No data found.'); return; }
          setCustomers(parsed);
          setFileName(file.name);
        } catch {
          setError(t ? 'Erreur de lecture du fichier.' : 'File read error.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError(t ? 'Format non supporté. Utilisez CSV ou XLSX.' : 'Unsupported format. Use CSV or XLSX.');
    }
  };

  const handleFile = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };

  const resetToSample = () => { setCustomers(parseSampleData()); setFileName(null); setError(null); };

  const totalRevenue = customers.reduce((s, c) => s + c.total_ordered_TTC, 0);
  const activeCustomers = customers.filter(c => c.total_ordered_TTC > 0).length;
  const hasImported = !!fileName;

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div>
        <div className="section-subheader">{t ? 'ÉTAPE 2 — DONNÉES CLIENTS' : 'STEP 2 — CUSTOMER DATA'}</div>
        <h2 className="text-[28px] font-bold text-[#111827]">
          {t ? 'Importez vos données clients' : 'Import your customer data'}
        </h2>
        <p className="text-[15px] text-[#6B7280] mt-0.5">
          {t ? 'Chargez votre fichier pour des projections basées sur vos vrais clients.' : 'Upload your file for projections based on your real customers.'}
        </p>
      </div>

      <RecommendationBlock stepKey={1} brandName={brandAnalysis?.brand_name} body={reco?.body} lang={lang} />

      {/* Upload Zone */}
      <div
        className={`card flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'ring-2 ring-primary' : ''}`}
        style={{ padding: '48px 32px', borderStyle: 'dashed', borderWidth: 2, borderColor: isDragging ? '#6B4EFF' : '#E5E7EB', backgroundColor: isDragging ? '#F5F3FF' : '#ffffff' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={48} className={`mb-4 ${isDragging ? 'text-primary' : 'text-gray-300'}`} />
        <p className="text-[15px] font-medium text-[#374151]">
          {t ? 'Glissez votre fichier CSV ou XLSX ici' : 'Drag your CSV or XLSX file here'}
        </p>
        <p className="text-[13px] text-[#9CA3AF] mt-1">{t ? 'ou' : 'or'}</p>
        <button
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="btn-primary mt-3"
        >
          {t ? 'Parcourir' : 'Browse files'}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
      </div>

      {error && (
        <div className="text-[13px] text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
      )}

      {/* File loaded — Stats */}
      {hasImported && (
        <div className="card" style={{ borderLeft: '3px solid #10B981' }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-emerald-500" />
            <span className="text-[13px] font-medium text-[#111827]">{fileName}</span>
            <button onClick={resetToSample} className="ml-auto text-gray-400 hover:text-red-500 transition-all"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat value={formatNumber(customers.length)} label={t ? 'Clients' : 'Customers'} />
            <MiniStat value={formatCurrency(totalRevenue)} label={t ? 'CA total' : 'Total revenue'} />
            <MiniStat value={`${formatNumber(Math.round(totalRevenue / (activeCustomers || 1)))}€`} label="LTV" />
          </div>
        </div>
      )}

      {/* Expected format */}
      <div className="card">
        <div className="section-subheader">{t ? 'FORMAT ATTENDU' : 'EXPECTED FORMAT'}</div>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium text-[#6B7280]">customer_id</th>
                <th className="text-right px-4 py-2 font-medium text-[#6B7280]">total_ordered_TTC</th>
                <th className="text-right px-4 py-2 font-medium text-[#6B7280]">number_of_orders</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="px-4 py-2 text-[#374151]">CLI_001</td>
                <td className="px-4 py-2 text-right text-[#374151]">234.50</td>
                <td className="px-4 py-2 text-right text-[#374151]">4</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-[#374151]">CLI_002</td>
                <td className="px-4 py-2 text-right text-[#374151]">1 200.00</td>
                <td className="px-4 py-2 text-right text-[#374151]">12</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Privacy */}
      <div className="card" style={{ backgroundColor: '#F9FAFB', padding: '12px 16px' }}>
        <div className="flex items-start gap-2.5">
          <Lock size={14} className="text-[#9CA3AF] shrink-0 mt-0.5" />
          <div>
            <span className="text-[12px] text-[#6B7280] font-medium block">
              {t ? "Vos données restent dans votre navigateur. Rien n'est envoyé à un serveur." : 'Your data stays in your browser. Nothing is sent to a server.'}
            </span>
            <span className="text-[11px] text-[#9CA3AF] block mt-1">
              {t
                ? 'Le champ customer_id peut être un identifiant anonyme — ne partagez pas de données personnelles (nom, email, téléphone).'
                : 'The customer_id field can be an anonymous identifier — do not share personal data (name, email, phone).'}
            </span>
          </div>
        </div>
      </div>

      {/* Secondary actions */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <button onClick={resetToSample} className="btn-ghost">
          <Database size={16} />
          {t ? 'Utiliser les données de démonstration' : 'Use demo data'}
        </button>
      </div>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="text-center p-2.5 bg-gray-50 rounded-lg">
      <div className="text-[15px] font-bold text-[#111827]">{value}</div>
      <div className="text-[11px] text-[#9CA3AF] mt-0.5">{label}</div>
    </div>
  );
}
