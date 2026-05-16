import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Lock, CheckCircle, Database, FileSpreadsheet, X, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseSampleData } from '../data/sampleData';
import { formatCurrency, formatNumber } from '../utils/calculations';

// Handles French/European number formats: "214,88", "39 591 758,20", "1.234,56"
function parseEuroNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  let s = String(value).trim().replace(/\s/g, '');
  if (!s) return 0;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present — last one is the decimal separator
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Normalize a header for tolerant matching: lowercase, strip accents, collapse spaces/underscores/hyphens
function normalizeKey(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s_\-:.]+/g, ' ')
    .trim();
}

// Resolve a field by (1) normalized exact alias, (2) normalized prefix match,
// (3) substring match for multi-word aliases (handles "Total number of orders" → "number of orders")
function getRowField(row, aliases, prefixes = []) {
  const keys = Object.keys(row);
  const normMap = new Map(keys.map(k => [normalizeKey(k), k]));
  // 1. Exact normalized match
  for (const a of aliases) {
    const k = normMap.get(normalizeKey(a));
    if (k && row[k] !== undefined && row[k] !== '') return row[k];
  }
  // 2. Prefix match (e.g. "Somme de Price: Total" starts with "somme de")
  if (prefixes.length) {
    for (const p of prefixes) {
      const np = normalizeKey(p);
      for (const [nk, k] of normMap) {
        if (nk.startsWith(np) && row[k] !== undefined && row[k] !== '') return row[k];
      }
    }
  }
  // 3. Substring match for multi-word aliases only — single-word aliases are too generic
  for (const a of aliases) {
    const na = normalizeKey(a);
    if (!na.includes(' ')) continue;
    for (const [nk, k] of normMap) {
      if (nk.includes(na) && row[k] !== undefined && row[k] !== '') return row[k];
    }
  }
  return undefined;
}

const ID_ALIASES = [
  'customer_id', 'customer id', 'customerid',
  'id', 'client_id', 'client id', 'user_id', 'user id',
  'Étiquettes de lignes', 'Row Labels',
  'email', 'customer email', 'customeremail', 'email address', 'mail',
];
const REVENUE_ALIASES = [
  'total_ordered_TTC', 'revenue', 'ltv', 'lifetime value',
  'amount spent', 'amount', 'amountspent', 'amount_spent',
  'total spent', 'total', 'spent',
  'total amount spent', 'totalamountspent', 'total amount',
  'ca', 'chiffre d affaires', 'montant', 'montant total',
];
const REVENUE_PREFIXES = ['Somme de', 'Sum of'];
const ORDERS_ALIASES = [
  'number_of_orders', 'number of orders', 'numberoforders',
  'orders', 'order count', 'orders count',
  'total number of orders', 'totalnumberoforders', 'total orders', 'totalorders',
  'nb commandes', 'nombre commandes', 'nb orders', 'nombre de commandes',
];
const ORDERS_PREFIXES = ['Nombre de', 'Count of', 'Nb de'];

const PIVOT_NOISE_IDS = new Set(['(vide)', '(blank)', 'Total général', 'Total general', 'Grand Total']);

function isPivotNoise(id) {
  if (!id) return true;
  const s = String(id).trim();
  if (!s) return true;
  if (PIVOT_NOISE_IDS.has(s)) return true;
  if (/^total\s/i.test(s)) return true;
  return false;
}

// ── Column-role auto-detection ──
// Score each column on how likely it represents id / revenue / orders.
// Returns { id, revenue, orders } header names (or null if unscoreable).
export function detectColumnRoles(headers, rows, sampleSize = 200) {
  const visibleHeaders = headers.filter(h => h !== undefined && h !== '');
  if (visibleHeaders.length === 0) return { id: null, revenue: null, orders: null };
  const sample = rows.slice(0, Math.min(sampleSize, rows.length));

  const scores = visibleHeaders.map(h => {
    const values = sample.map(r => r[h]).filter(v => v !== undefined && v !== '' && v !== null);
    if (values.length === 0) return { header: h, id: 0, revenue: 0, orders: 0 };

    // Cardinality (% unique values)
    const uniqueRatio = new Set(values).size / values.length;

    // Numeric parse: how many values cleanly parse as positive numbers
    const numbers = [];
    for (const v of values) {
      const n = parseEuroNumber(v);
      if (n > 0 && !isNaN(n)) numbers.push(n);
    }
    const numericRatio = numbers.length / values.length;
    const avg = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
    const max = numbers.length ? Math.max(...numbers) : 0;
    const decimalCount = numbers.filter(n => n !== Math.floor(n)).length;
    const decimalRatio = numbers.length ? decimalCount / numbers.length : 0;
    const intCount = numbers.filter(n => Number.isInteger(n)).length;
    const smallIntCount = numbers.filter(n => Number.isInteger(n) && n >= 1 && n <= 1000).length;

    // Heuristic ID-shape: long numeric strings, emails, alphanumeric patterns
    const idShapeCount = values.filter(v => {
      const s = String(v).trim();
      if (/@/.test(s)) return true;
      if (/^\d{6,}$/.test(s)) return true;
      if (/^[A-Z]{1,4}[_-]?\d{2,}$/i.test(s)) return true;
      if (/^[a-z0-9_-]{6,}$/i.test(s) && !numbers.length) return true;
      return false;
    }).length;
    const idShapeRatio = idShapeCount / values.length;

    // ID score: high uniqueness + ID-shape bonus, penalty if mostly numeric in revenue range
    let idScore = uniqueRatio * 0.6 + idShapeRatio * 0.5;
    if (numericRatio > 0.95 && avg > 50 && avg < 100000 && decimalRatio > 0.2) idScore -= 0.3;

    // Revenue score: mostly numeric, has decimals (or large values), avg > 5
    let revenueScore = numericRatio * 0.4;
    if (decimalRatio > 0.1) revenueScore += 0.4;
    if (avg > 20 && avg < 1e7) revenueScore += 0.3;
    if (max > 100) revenueScore += 0.1;
    // Penalty if column is also a great ID candidate (high uniqueness + ID shape)
    if (idShapeRatio > 0.7 && uniqueRatio > 0.95) revenueScore -= 0.5;

    // Orders score: small positive integers, mostly < 1000
    let ordersScore = 0;
    if (numericRatio > 0.8) {
      const intRatio = numbers.length ? intCount / numbers.length : 0;
      const smallRatio = numbers.length ? smallIntCount / numbers.length : 0;
      ordersScore = intRatio * 0.4 + smallRatio * 0.6;
      if (max > 0 && max < 1000) ordersScore += 0.2;
      if (decimalRatio < 0.05) ordersScore += 0.2;
    }
    // Penalty if column looks like ID
    if (idShapeRatio > 0.7) ordersScore -= 0.4;

    return { header: h, id: idScore, revenue: revenueScore, orders: ordersScore };
  });

  // Greedy assignment: highest score per role, exclude used columns
  const used = new Set();
  const result = { id: null, revenue: null, orders: null };
  for (const role of ['id', 'revenue', 'orders']) {
    let best = null;
    for (const s of scores) {
      if (used.has(s.header)) continue;
      if (!best || s[role] > best[role]) best = s;
    }
    if (best && best[role] > 0) {
      result[role] = best.header;
      used.add(best.header);
    }
  }
  return result;
}

// Try alias-based resolution first, fall back to auto-detection. Returns
// { mapping: { id, revenue, orders }, source: 'alias' | 'detection' | 'mixed' }.
export function autoMapColumns(headers, rows) {
  const sample = rows.slice(0, 100);
  const probe = sample[0] || {};

  const aliasResolved = {
    id: getRowFieldKey(probe, ID_ALIASES),
    revenue: getRowFieldKey(probe, REVENUE_ALIASES, REVENUE_PREFIXES),
    orders: getRowFieldKey(probe, ORDERS_ALIASES, ORDERS_PREFIXES),
  };

  const allFromAlias = aliasResolved.id && aliasResolved.revenue && aliasResolved.orders;
  if (allFromAlias) return { mapping: aliasResolved, source: 'alias' };

  const detected = detectColumnRoles(headers, rows);
  const mapping = {
    id: aliasResolved.id || detected.id,
    revenue: aliasResolved.revenue || detected.revenue,
    orders: aliasResolved.orders || detected.orders,
  };
  const source = aliasResolved.id || aliasResolved.revenue || aliasResolved.orders ? 'mixed' : 'detection';
  return { mapping, source };
}

// Like getRowField but returns the key name (not the value) — used for mapping
function getRowFieldKey(row, aliases, prefixes = []) {
  const keys = Object.keys(row);
  const normMap = new Map(keys.map(k => [normalizeKey(k), k]));
  for (const a of aliases) {
    const k = normMap.get(normalizeKey(a));
    if (k) return k;
  }
  if (prefixes.length) {
    for (const p of prefixes) {
      const np = normalizeKey(p);
      for (const [nk, k] of normMap) {
        if (nk.startsWith(np)) return k;
      }
    }
  }
  for (const a of aliases) {
    const na = normalizeKey(a);
    if (!na.includes(' ')) continue;
    for (const [nk, k] of normMap) {
      if (nk.includes(na)) return k;
    }
  }
  return null;
}

// Map a raw row using an explicit column mapping (from auto-detection or user override).
function mapRowWithMapping(row, mapping) {
  const rawId = mapping.id ? row[mapping.id] : undefined;
  const revenueRaw = mapping.revenue ? row[mapping.revenue] : undefined;
  const ordersRaw = mapping.orders ? row[mapping.orders] : undefined;
  const customer_id = rawId !== undefined && rawId !== null ? String(rawId).trim() : '';
  const total_ordered_TTC = parseEuroNumber(revenueRaw);
  const ordersParsed = parseInt(parseEuroNumber(ordersRaw), 10) || 0;
  const number_of_orders = ordersParsed || Math.max(1, Math.floor(total_ordered_TTC / 60));
  return { customer_id, total_ordered_TTC, number_of_orders };
}

export default function StepData_Import({ customers, setCustomers, lang, brandAnalysis, config, settings, onPrev, onNext }) {
  const t = lang === 'fr';
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  // Raw import state — set after parse, before final mapping is applied
  const [rawImport, setRawImport] = useState(null); // { headers, rows, fileName }
  const [mapping, setMapping] = useState(null);     // { id, revenue, orders }
  const [autoSource, setAutoSource] = useState(null); // 'alias' | 'detection' | 'mixed' | null

  // Keep customers in sync with (rawImport, mapping). Re-runs when user edits mapping.
  useEffect(() => {
    if (!rawImport || !mapping) return;
    if (!mapping.id || !mapping.revenue) return; // need at least id + revenue
    const parsed = rawImport.rows
      .map(row => mapRowWithMapping(row, mapping))
      .filter(r => r.customer_id && !isPivotNoise(r.customer_id));
    if (parsed.length === 0) {
      setError(t ? 'Aucune donnée trouvée avec ce mapping.' : 'No data found with this mapping.');
      return;
    }
    setError(null);
    setCustomers(parsed);
    setFileName(rawImport.fileName);
  }, [rawImport, mapping]); // eslint-disable-line react-hooks/exhaustive-deps

  const ingestParsedRows = (rows, fname) => {
    if (!rows || rows.length === 0) {
      setError(t ? 'Fichier vide.' : 'Empty file.');
      return;
    }
    // Derive the headers from the first row (Papa Parse + sheet_to_json both yield objects).
    const headers = Object.keys(rows[0] || {}).filter(h => h !== undefined && h !== '');
    const { mapping: autoMap, source } = autoMapColumns(headers, rows);
    setRawImport({ headers, rows, fileName: fname });
    setMapping(autoMap);
    setAutoSource(source);
  };

  const processFile = async (file) => {
    if (!file) return;
    setError(null);
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      try {
        let text = await file.text();
        // Strip a single-cell title row (e.g. "BP-Data") that precedes the real header.
        const nl = text.indexOf('\n');
        if (nl !== -1) {
          const firstLine = text.slice(0, nl).replace(/\r$/, '').replace(/^﻿/, '');
          const secondLineEnd = text.indexOf('\n', nl + 1);
          const secondLine = text.slice(nl + 1, secondLineEnd === -1 ? undefined : secondLineEnd).replace(/\r$/, '');
          const hasSep = s => /[;,\t]/.test(s);
          if (firstLine.trim() && !hasSep(firstLine) && hasSep(secondLine)) {
            text = text.slice(nl + 1);
          }
        }
        Papa.parse(text, {
          header: true, skipEmptyLines: true,
          complete: (results) => ingestParsedRows(results.data, file.name),
          error: () => setError(t ? 'Erreur de parsing.' : 'Parse error.'),
        });
      } catch {
        setError(t ? 'Erreur de lecture du fichier.' : 'File read error.');
      }
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          ingestParsedRows(data, file.name);
        } catch {
          setError(t ? 'Erreur de lecture du fichier.' : 'File read error.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError(t ? 'Format non supporté. Utilisez CSV ou XLSX.' : 'Unsupported format. Use CSV or XLSX.');
    }
  };

  const updateMappingField = (field, headerName) => {
    setMapping(prev => ({ ...prev, [field]: headerName || null }));
  };

  const previewRows = useMemo(() => {
    if (!rawImport || !mapping) return [];
    return rawImport.rows
      .slice(0, 3)
      .map(r => mapRowWithMapping(r, mapping));
  }, [rawImport, mapping]);

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

  const resetToSample = () => {
    setCustomers(parseSampleData());
    setFileName(null);
    setError(null);
    setRawImport(null);
    setMapping(null);
    setAutoSource(null);
  };

  const totalRevenue = customers.reduce((s, c) => s + c.total_ordered_TTC, 0);
  const activeCustomers = customers.filter(c => c.total_ordered_TTC > 0).length;
  const hasImported = !!fileName;

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div>
        <div className="section-subheader">{t ? 'ÉTAPE 2 — DONNÉES CLIENTS' : 'STEP 2 — CUSTOMER DATA'}</div>
        <h2 className="text-[28px] font-bold text-[#52473C]">
          {t ? 'Importez vos données clients' : 'Import your customer data'}
        </h2>
        <p className="text-[15px] text-[#645648] mt-0.5">
          {t ? 'Chargez votre fichier pour des projections basées sur vos vrais clients.' : 'Upload your file for projections based on your real customers.'}
        </p>
      </div>

      {/* Upload Zone */}
      <div
        className={`card flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'ring-2 ring-primary' : ''}`}
        style={{ padding: '48px 32px', borderStyle: 'dashed', borderWidth: 2, borderColor: isDragging ? '#2965FE' : '#D9D5CB', backgroundColor: isDragging ? '#E8EFFE' : '#EEEDE6' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={48} className={`mb-4 ${isDragging ? 'text-primary' : 'text-[#8A7D6B]'}`} />
        <p className="text-[15px] font-medium text-[#645648]">
          {t ? 'Glissez votre fichier CSV ou XLSX ici' : 'Drag your CSV or XLSX file here'}
        </p>
        <p className="text-[13px] text-[#8A7D6B] mt-1">{t ? 'ou' : 'or'}</p>
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

      {/* Column Mapping — shown after a file is parsed, lets user override auto-detection */}
      {rawImport && mapping && (
        <div className="card" style={{ borderLeft: '3px solid #2965FE' }}>
          <div className="flex items-center gap-2 mb-3">
            <Wand2 size={16} className="text-primary" />
            <span className="text-[13px] font-semibold text-[#52473C]">
              {t ? 'Mapping des colonnes' : 'Column mapping'}
            </span>
            {autoSource && (
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ backgroundColor: autoSource === 'alias' ? '#D1FAE5' : '#FEF3C7', color: autoSource === 'alias' ? '#065F46' : '#92400E' }}>
                {autoSource === 'alias'
                  ? (t ? 'Détecté par nom' : 'Detected by name')
                  : autoSource === 'mixed'
                  ? (t ? 'Détection partielle' : 'Partial detection')
                  : (t ? 'Auto-détecté' : 'Auto-detected')}
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#8A7D6B] mb-3">
            {t
              ? 'Vérifie que les bonnes colonnes de ton fichier sont assignées. Modifie si besoin.'
              : 'Check that your file’s columns are correctly assigned. Override if needed.'}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'id', label: t ? 'Customer ID' : 'Customer ID', required: true },
              { key: 'revenue', label: t ? 'Total dépensé (€)' : 'Total spent (€)', required: true },
              { key: 'orders', label: t ? 'Nb commandes' : 'Number of orders', required: false },
            ].map(field => (
              <div key={field.key}>
                <label className="text-[11px] text-[#645648] font-medium mb-1 block">
                  {field.label}
                  {!field.required && <span className="text-[#A89C8D] ml-1">({t ? 'optionnel' : 'optional'})</span>}
                </label>
                <select
                  value={mapping[field.key] || ''}
                  onChange={e => updateMappingField(field.key, e.target.value)}
                  className="w-full px-2 py-1.5 text-[12px] rounded-lg border border-[#D9D5CB] bg-white focus:border-primary focus:outline-none"
                >
                  <option value="">{t ? '— aucune —' : '— none —'}</option>
                  {rawImport.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Preview of first 3 mapped rows */}
          <div className="mt-3 pt-3 border-t border-[#E5E1D8]">
            <div className="text-[10px] uppercase tracking-wider text-[#8A7D6B] mb-2">
              {t ? 'APERÇU' : 'PREVIEW'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-[#EEEDE6] border-b border-[#D9D5CB]">
                    <th className="text-left px-3 py-1.5 font-medium text-[#645648]">customer_id</th>
                    <th className="text-right px-3 py-1.5 font-medium text-[#645648]">total_ordered_TTC</th>
                    <th className="text-right px-3 py-1.5 font-medium text-[#645648]">number_of_orders</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-[#F0EEE7] last:border-0">
                      <td className="px-3 py-1 text-[#645648] truncate max-w-[180px]">{row.customer_id || '—'}</td>
                      <td className="px-3 py-1 text-right text-[#645648]">
                        {row.total_ordered_TTC ? formatCurrency(row.total_ordered_TTC) : '—'}
                      </td>
                      <td className="px-3 py-1 text-right text-[#645648]">{row.number_of_orders || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!mapping.id || !mapping.revenue) && (
              <div className="mt-2 text-[11px] text-[#D97706]">
                {t
                  ? '⚠️ Sélectionne au moins les colonnes Customer ID et Total dépensé.'
                  : '⚠️ Select at least Customer ID and Total spent columns.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* File loaded — Stats */}
      {hasImported && (
        <div className="card" style={{ borderLeft: '3px solid #10B981' }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-emerald-500" />
            <span className="text-[13px] font-medium text-[#52473C]">{fileName}</span>
            <button onClick={resetToSample} className="ml-auto text-[#8A7D6B] hover:text-red-500 transition-all"><X size={14} /></button>
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
              <tr className="bg-[#EEEDE6] border-b border-[#D9D5CB]">
                <th className="text-left px-4 py-2 font-medium text-[#645648]">customer_id</th>
                <th className="text-right px-4 py-2 font-medium text-[#645648]">total_ordered_TTC</th>
                <th className="text-right px-4 py-2 font-medium text-[#645648]">number_of_orders</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E5E1D8]">
                <td className="px-4 py-2 text-[#645648]">CLI_001</td>
                <td className="px-4 py-2 text-right text-[#645648]">234.50</td>
                <td className="px-4 py-2 text-right text-[#645648]">4</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-[#645648]">CLI_002</td>
                <td className="px-4 py-2 text-right text-[#645648]">1 200.00</td>
                <td className="px-4 py-2 text-right text-[#645648]">12</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Privacy */}
      <div className="card" style={{ backgroundColor: '#EEEDE6', padding: '12px 16px' }}>
        <div className="flex items-start gap-2.5">
          <Lock size={14} className="text-[#8A7D6B] shrink-0 mt-0.5" />
          <div>
            <span className="text-[12px] text-[#645648] font-medium block">
              {t ? "Vos données restent dans votre navigateur. Rien n'est envoyé à un serveur." : 'Your data stays in your browser. Nothing is sent to a server.'}
            </span>
            <span className="text-[11px] text-[#8A7D6B] block mt-1">
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

      {/* Inline nav */}
      <div className="flex justify-between pt-6">
        {onPrev ? (
          <button onClick={onPrev} className="btn-secondary">
            <ChevronLeft size={16} /> {t ? 'Précédent' : 'Previous'}
          </button>
        ) : <span />}
        {onNext && (
          <button onClick={onNext} className="btn-primary">
            {t ? 'Suivant' : 'Next'} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="text-center p-2.5 bg-[#EEEDE6] rounded-lg">
      <div className="text-[15px] font-bold text-[#52473C]">{value}</div>
      <div className="text-[11px] text-[#8A7D6B] mt-0.5">{label}</div>
    </div>
  );
}
