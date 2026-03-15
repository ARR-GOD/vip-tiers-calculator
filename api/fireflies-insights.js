import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;

  if (!ANTHROPIC_API_KEY || !FIREFLIES_API_KEY) {
    return res.status(200).json({ meetingsFound: 0, insights: null, summary: null });
  }

  const { companyName, contactEmails, domain } = req.body || {};
  if (!companyName && (!contactEmails || contactEmails.length === 0)) {
    return res.status(200).json({ meetingsFound: 0, insights: null, summary: null });
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // Build search instructions for Claude
    const searchTerms = [];
    if (companyName) searchTerms.push(`company name "${companyName}"`);
    if (domain) searchTerms.push(`domain "${domain}"`);
    if (contactEmails && contactEmails.length > 0) {
      searchTerms.push(`participant emails: ${contactEmails.join(', ')}`);
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().split('T')[0];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      headers: {
        'anthropic-beta': 'mcp-client-2025-04-04',
      },
      mcp_servers: [
        {
          type: 'url',
          url: 'https://api.fireflies.ai/mcp',
          authorization_token: FIREFLIES_API_KEY,
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Search Fireflies meetings from the last 6 months (since ${fromDate}) related to: ${searchTerms.join(', ')}.

Find relevant meetings and extract structured insights. Return ONLY valid JSON (no markdown, no explanation) with this exact format:
{
  "meetingsFound": <number>,
  "lastMeetingDate": "<YYYY-MM-DD or null>",
  "insights": {
    "loyaltyMentioned": <boolean>,
    "referralMentioned": <boolean>,
    "budgetMentioned": <boolean>,
    "painPoints": ["<string>"],
    "goals": ["<string>"],
    "competitorsMentioned": ["<string>"],
    "keyQuotes": ["<string max 100 chars>"]
  },
  "summary": "<2-3 sentence summary in French of key discussion points relevant to loyalty/VIP program>"
}

If no meetings are found, return: {"meetingsFound": 0, "insights": null, "summary": null}

Focus on mentions of: loyalty programs, VIP tiers, rewards, referral, customer retention, budget, competitors, pain points, goals.`,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content?.find(b => b.type === 'text');
    if (!textBlock?.text) {
      return res.status(200).json({ meetingsFound: 0, insights: null, summary: null });
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    return res.status(200).json({
      meetingsFound: parsed.meetingsFound || 0,
      lastMeetingDate: parsed.lastMeetingDate || null,
      insights: parsed.insights || null,
      summary: parsed.summary || null,
    });
  } catch (err) {
    console.error('Fireflies insights error:', err);
    // Never block — return empty on error
    return res.status(200).json({ meetingsFound: 0, insights: null, summary: null });
  }
}
