export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { companyId } = req.query;
  if (!companyId) return res.status(400).json({ error: 'companyId required' });

  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) {
    return res.status(503).json({ error: 'HubSpot not configured', code: 'NO_API_KEY' });
  }

  const companyProperties = [
    'name', 'domain', 'annualrevenue', 'mrr_csm', 'plan',
    'industry', 'industries', 'vertical', 'sl_platform', 'sl_plan',
    'sl_categories', 'lifecyclestage', 'phase_du_client', 'country',
    'numberofemployees', 'cs_accompagnement',
    'total_revenue', 'annual_orders', 'revenue_loyalty', 'revenue_referral',
    'sl_monthly_app_spend',
  ].join(',');

  const headers = {
    Authorization: `Bearer ${HUBSPOT_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Fetch company details
    const companyResp = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${companyId}?properties=${companyProperties}`,
      { headers }
    );

    if (!companyResp.ok) {
      const errData = await companyResp.json().catch(() => ({}));
      return res.status(companyResp.status).json({ error: errData.message || 'Company not found' });
    }

    const companyData = await companyResp.json();
    const company = {
      id: companyData.id,
      ...companyData.properties,
      annualRevenue: parseFloat(companyData.properties.annualrevenue) || 0,
      mrrCsm: parseFloat(companyData.properties.mrr_csm) || 0,
      totalRevenue: parseFloat(companyData.properties.total_revenue) || 0,
      annualOrders: parseInt(companyData.properties.annual_orders) || 0,
      revenueLoyalty: parseFloat(companyData.properties.revenue_loyalty) || 0,
      revenueReferral: parseFloat(companyData.properties.revenue_referral) || 0,
      monthlyAppSpend: parseFloat(companyData.properties.sl_monthly_app_spend) || 0,
    };

    // 2. Fetch associated contacts
    let contacts = [];
    try {
      const assocResp = await fetch(
        `https://api.hubapi.com/crm/v3/objects/companies/${companyId}/associations/contacts`,
        { headers }
      );

      if (assocResp.ok) {
        const assocData = await assocResp.json();
        const contactIds = (assocData.results || [])
          .map(r => r.toObjectId || r.id)
          .filter(Boolean)
          .slice(0, 10); // Cap at 10 contacts

        if (contactIds.length > 0) {
          // Fetch all contacts in parallel
          const contactPromises = contactIds.map(async (contactId) => {
            try {
              const cResp = await fetch(
                `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,jobtitle`,
                { headers }
              );
              if (!cResp.ok) return null;
              const cData = await cResp.json();
              return {
                id: cData.id,
                firstName: cData.properties.firstname || '',
                lastName: cData.properties.lastname || '',
                email: cData.properties.email || '',
                jobTitle: cData.properties.jobtitle || '',
              };
            } catch {
              return null;
            }
          });

          contacts = (await Promise.all(contactPromises)).filter(Boolean);
        }
      }
    } catch {
      // Contacts are optional — continue without them
    }

    return res.status(200).json({ company, contacts });
  } catch (err) {
    console.error('HubSpot client details error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch client details' });
  }
}
