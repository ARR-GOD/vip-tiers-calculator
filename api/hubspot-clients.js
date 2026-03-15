export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ownerId, search } = req.query;
  if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) {
    return res.status(503).json({ error: 'HubSpot not configured', code: 'NO_API_KEY' });
  }

  const properties = [
    'name', 'domain', 'annualrevenue', 'mrr_csm', 'plan',
    'industry', 'industries', 'vertical', 'sl_platform', 'sl_plan',
    'sl_categories', 'lifecyclestage', 'phase_du_client', 'country',
    'numberofemployees', 'cs_accompagnement',
  ];

  try {
    let allResults = [];
    let after = 0;
    let hasMore = true;

    // Paginate to fetch all clients for this CSM (max 200 per page, up to 5 pages)
    while (hasMore) {
      const body = {
        filterGroups: [{
          filters: [
            { propertyName: 'proprietaire_de_l_entreprise__csm_', operator: 'EQ', value: ownerId },
          ],
        }],
        properties,
        limit: 200,
        after,
        sorts: [{ propertyName: 'name', direction: 'ASCENDING' }],
      };

      // If a search term is provided, add it as a HubSpot query
      if (search) {
        body.query = search;
      }

      const resp = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ error: data.message || 'HubSpot error' });
      }

      allResults = allResults.concat(data.results || []);

      // HubSpot pagination: continue if paging.next exists
      if (data.paging?.next?.after) {
        after = data.paging.next.after;
      } else {
        hasMore = false;
      }

      // Safety: max 5 pages (1000 clients)
      if (allResults.length >= 1000) break;
    }

    // Map results to clean objects
    const clients = allResults.map(r => ({
      id: r.id,
      name: r.properties.name || '',
      domain: r.properties.domain || '',
      annualRevenue: parseFloat(r.properties.annualrevenue) || 0,
      mrrCsm: parseFloat(r.properties.mrr_csm) || 0,
      plan: r.properties.plan || '',
      industry: r.properties.industry || r.properties.industries || r.properties.vertical || '',
      platform: r.properties.sl_platform || '',
      platformPlan: r.properties.sl_plan || '',
      lifecycleStage: r.properties.lifecyclestage || '',
      customerStage: r.properties.phase_du_client || '',
      country: r.properties.country || '',
    }));

    return res.status(200).json({ clients, total: clients.length });
  } catch (err) {
    console.error('HubSpot clients error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch clients' });
  }
}
