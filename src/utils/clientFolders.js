// ════════════════════════════════════════════════════════════════════
// Client folders — the programs of one client, grouped
// ════════════════════════════════════════════════════════════════════
//
// Folders are not stored: they are derived from the saved programs. HubSpot
// programs are grouped by company; the others by brand (its domain, or its
// name when it has none).

// Strip URL noise so "https://www.brand.com/fr?x" and "brand.com" match.
export function normalizeDomain(value) {
  if (!value) return '';
  return value.toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]
    .trim();
}

// Saved programs carry their key (folder_key); it is derived the same way.
export function folderKeyOf(program) {
  if (program.folder_key) return program.folder_key;
  if (program.hubspot_company_id) return `hs:${program.hubspot_company_id}`;
  const brand = normalizeDomain(program.client_domain) || (program.client_name || '').trim().toLowerCase();
  return `brand:${brand}`;
}

const byUpdatedDesc = (a, b) => (b.updated_at || '').localeCompare(a.updated_at || '');

// Folders sorted by last activity; each one's programs too. The folder shows
// the client details of its most recently edited program.
export function groupProgramsIntoFolders(programs) {
  const groups = new Map();
  for (const program of programs) {
    const key = folderKeyOf(program);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(program);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort(byUpdatedDesc);
      const latest = sorted[0];
      return {
        key,
        hubspotCompanyId: latest.hubspot_company_id || null,
        name: latest.client_name,
        domain: latest.client_domain || null,
        plan: latest.client_plan || null,
        updated_at: latest.updated_at,
        updatedBy: latest.updated_by || null,
        programs: sorted,
      };
    })
    .sort(byUpdatedDesc);
}

// Folders the CSM created or edited a program in.
export const isMyFolder = (folder, email) =>
  !!email && folder.programs.some(p => p.created_by === email || p.updated_by === email);

export function matchesFolderSearch(folder, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const domainQuery = normalizeDomain(q);
  return (folder.name || '').toLowerCase().includes(q)
    || (!!domainQuery && normalizeDomain(folder.domain).includes(domainQuery))
    || folder.programs.some(p => (p.program_name || '').toLowerCase().includes(q));
}

// Default name of the next program of a folder: "Programme 2", "Programme 3"…
export function nextProgramName(folder, lang = 'fr') {
  const base = lang === 'fr' ? 'Programme' : 'Program';
  const taken = new Set((folder?.programs || []).map(p => p.program_name));
  let n = (folder?.programs.length || 0) + 1;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// "Proposition A" → "Proposition A (copie)", then "(copie 2)"…
export function copyName(name, folder, lang = 'fr') {
  const word = lang === 'fr' ? 'copie' : 'copy';
  const taken = new Set((folder?.programs || []).map(p => p.program_name));
  let candidate = `${name} (${word})`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${name} (${word} ${n})`;
  return candidate;
}
