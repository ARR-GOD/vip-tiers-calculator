import { describe, it, expect } from 'vitest';
import {
  normalizeDomain, folderKeyOf, groupProgramsIntoFolders, isMyFolder, matchesFolderSearch, nextProgramName, copyName,
} from './clientFolders';

const program = (id, fields) => ({
  id, program_name: 'Programme principal', client_plan: null, client_domain: null,
  created_by: 'ana@loyoly.io', updated_by: 'ana@loyoly.io', ...fields,
});

const rows = [
  program('a1', { hubspot_company_id: '42', client_name: 'Brand A', client_domain: 'branda.com', client_plan: 'Premium', updated_at: '2026-10-18T10:00:00Z' }),
  program('a2', { hubspot_company_id: '42', client_name: 'Brand A', client_domain: 'branda.com', client_plan: 'Enterprise', program_name: 'Proposition B', updated_at: '2026-10-18T12:00:00Z', updated_by: 'tom@loyoly.io' }),
  program('m1', { hubspot_company_id: null, client_name: 'Maison Lune', client_domain: 'https://www.maisonlune.fr/', updated_at: '2026-10-17T09:00:00Z' }),
  program('m2', { hubspot_company_id: null, client_name: 'Maison Lune', client_domain: 'maisonlune.fr', updated_at: '2026-10-18T11:00:00Z' }),
  program('x1', { hubspot_company_id: null, client_name: 'Configuration manuelle', updated_at: '2026-10-16T09:00:00Z' }),
];

describe('client folders', () => {
  it('normalizes domains pasted as URLs', () => {
    expect(normalizeDomain('https://www.Brand.com/fr?x=1#top')).toBe('brand.com');
    expect(normalizeDomain(null)).toBe('');
  });

  it('files HubSpot programs by company and the others by brand', () => {
    expect(folderKeyOf(rows[0])).toBe('hs:42');
    expect(folderKeyOf(rows[2])).toBe('brand:maisonlune.fr');
    expect(folderKeyOf(rows[2])).toBe(folderKeyOf(rows[3]));
    expect(folderKeyOf(rows[4])).toBe('brand:configuration manuelle');
  });

  it('groups programs into folders sorted by last activity', () => {
    const folders = groupProgramsIntoFolders(rows);
    expect(folders.map(f => f.key)).toEqual(['hs:42', 'brand:maisonlune.fr', 'brand:configuration manuelle']);
    const [brandA, lune] = folders;
    expect(brandA.programs.map(p => p.id)).toEqual(['a2', 'a1']);
    expect(brandA).toMatchObject({ name: 'Brand A', hubspotCompanyId: '42', plan: 'Enterprise', updatedBy: 'tom@loyoly.io' });
    expect(lune).toMatchObject({ hubspotCompanyId: null, programs: [{ id: 'm2' }, { id: 'm1' }] });
  });

  it('keeps the folders a CSM created or edited a program in', () => {
    const folders = groupProgramsIntoFolders(rows);
    expect(folders.filter(f => isMyFolder(f, 'tom@loyoly.io')).map(f => f.key)).toEqual(['hs:42']);
    expect(folders.filter(f => isMyFolder(f, 'ana@loyoly.io'))).toHaveLength(3);
    expect(isMyFolder(folders[0], undefined)).toBe(false);
  });

  it('searches client names, domains and program names', () => {
    const [brandA, lune] = groupProgramsIntoFolders(rows);
    expect(matchesFolderSearch(brandA, 'brand')).toBe(true);
    expect(matchesFolderSearch(lune, 'https://maisonlune.fr')).toBe(true);
    expect(matchesFolderSearch(brandA, 'proposition b')).toBe(true);
    expect(matchesFolderSearch(lune, 'proposition')).toBe(false);
    expect(matchesFolderSearch(lune, '  ')).toBe(true);
  });

  it('names new programs and copies without clashing', () => {
    const [brandA] = groupProgramsIntoFolders(rows);
    expect(nextProgramName(brandA)).toBe('Programme 3');
    expect(nextProgramName(brandA, 'en')).toBe('Program 3');
    const withCopy = { ...brandA, programs: [...brandA.programs, { program_name: 'Proposition B (copie)' }] };
    expect(copyName('Proposition B', brandA)).toBe('Proposition B (copie)');
    expect(copyName('Proposition B', withCopy)).toBe('Proposition B (copie 2)');
  });
});
