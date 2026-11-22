import { describe, it, expect } from 'vitest';
import { isAgencyFolder, agencyOfFolder, agencyFolderKey, folderKeyOf, groupProgramsIntoFolders } from './clientFolders';
import { programFolderKey, buildProgramSnapshot } from './programStore';
import { spaceOf, authErrorText } from './accountSpaces';
import { pendingCount } from './agencyStore';

const AGENCY = '0b6f6f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('agency folders', () => {
  it('keys an agency folder by agency and brand', () => {
    const key = agencyFolderKey(AGENCY, { client_domain: 'https://www.Prospect.fr/shop', client_name: 'Prospect' });
    expect(key).toBe(`agency:${AGENCY}:prospect.fr`);
    expect(isAgencyFolder(key)).toBe(true);
    expect(agencyOfFolder(key)).toBe(AGENCY);
    expect(agencyFolderKey(AGENCY, { client_name: ' Ma Marque ' })).toBe(`agency:${AGENCY}:ma marque`);
    expect(isAgencyFolder('brand:prospect.fr')).toBe(false);
    expect(agencyOfFolder('self:abc')).toBe(null);
  });

  it('keeps the agency folders apart from the team folders of the same brand', () => {
    const folders = groupProgramsIntoFolders([
      { id: '1', folder_key: `agency:${AGENCY}:prospect.fr`, agency_id: AGENCY, client_name: 'Prospect', client_domain: 'prospect.fr', updated_at: '2026-11-20' },
      { id: '2', client_name: 'Prospect', client_domain: 'prospect.fr', updated_at: '2026-11-21' },
    ]);
    expect(folders).toHaveLength(2);
    expect(folders.find(f => f.key === `agency:${AGENCY}:prospect.fr`).agencyId).toBe(AGENCY);
    expect(folders.find(f => f.key === 'brand:prospect.fr').agencyId).toBe(null);
    expect(folderKeyOf({ client_domain: 'prospect.fr' })).toBe('brand:prospect.fr');
  });
});

describe('folder of the open program', () => {
  const client = { client_name: 'Prospect', client_domain: 'prospect.fr', client_plan: null };

  it('files an agency program under its agency, never under HubSpot', () => {
    expect(programFolderKey({ agencyId: AGENCY, hubspotCompanyId: null }, client)).toBe(`agency:${AGENCY}:prospect.fr`);
  });

  it('keeps the team and self-serve rules', () => {
    expect(programFolderKey({ hubspotCompanyId: '42' }, client)).toBe('hs:42');
    expect(programFolderKey({ hubspotCompanyId: null }, client)).toBe('brand:prospect.fr');
    expect(programFolderKey({ folderKey: 'self:u1', agencyId: AGENCY }, client)).toBe('self:u1');
  });

  it('snapshots an agency program in its agency folder', () => {
    const snap = buildProgramSnapshot({ id: null, agencyId: AGENCY, name: 'Programme 1' }, {
      brandAnalysis: { brand_name: 'Prospect', brand_url: 'https://prospect.fr' },
      config: {}, settings: {}, tiers: [], rewards: [], missions: [], customMissions: [], referralConfig: {},
    });
    expect(snap.row.folder_key).toBe(`agency:${AGENCY}:prospect.fr`);
  });
});

describe('account spaces', () => {
  const session = (email, meta = {}) => ({ user: { email, user_metadata: meta } });
  it('sends each account to its space', () => {
    expect(spaceOf(session('csm@loyoly.io'))).toBe('/loyoly');
    expect(spaceOf(session('a@agence.fr', { account_type: 'agency', agency_name: 'A' }))).toBe('/agency');
    expect(spaceOf(session('b@brand.fr', { brand_name: 'B' }))).toBe('/kit');
    expect(spaceOf(session('x@other.fr'))).toBe(null);
    expect(spaceOf(null)).toBe(null);
  });

  it('words the known errors', () => {
    const t = { errors: { brand_account: 'déjà marque', generic: 'oups' } };
    expect(authErrorText(t, { message: 'brand_account' })).toBe('déjà marque');
    expect(authErrorText(t, {})).toBe('oups');
  });

  it('counts the agencies waiting for a review', () => {
    expect(pendingCount([{ status: 'pending' }, { status: 'approved' }, { status: 'pending' }])).toBe(2);
  });
});
