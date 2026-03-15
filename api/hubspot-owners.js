export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) {
    return res.status(503).json({ error: 'HubSpot not configured', code: 'NO_API_KEY' });
  }

  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/owners?limit=500', {
      headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: errData.message || `HubSpot error ${response.status}` });
    }

    const data = await response.json();

    const owners = (data.results || [])
      .filter(o => o.archived === false)
      .map(o => ({
        id: o.id,
        name: `${o.firstName || ''} ${o.lastName || ''}`.trim(),
        email: o.email || '',
      }))
      .filter(o => o.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json(owners);
  } catch (err) {
    console.error('HubSpot owners error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch owners' });
  }
}
