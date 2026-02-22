import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // Fetch homepage HTML
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const fetchRes = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LoyolyBot/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!fetchRes.ok) {
      return res.status(422).json({ error: `Could not fetch website (HTTP ${fetchRes.status})` });
    }

    const html = await fetchRes.text();
    const truncatedHtml = html.slice(0, 50000);

    // Extract brand logo from HTML meta tags
    let brandLogo = null;
    try {
      // Try og:image first (usually higher quality)
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch) {
        brandLogo = ogMatch[1];
      } else {
        // Try apple-touch-icon (good quality, square)
        const appleMatch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
        if (appleMatch) {
          brandLogo = appleMatch[1];
        } else {
          // Try favicon with sizes (prefer larger)
          const iconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i);
          if (iconMatch) {
            brandLogo = iconMatch[1];
          }
        }
      }
      // Make relative URLs absolute
      if (brandLogo && !brandLogo.startsWith('http')) {
        const base = new URL(normalizedUrl);
        brandLogo = new URL(brandLogo, base.origin).href;
      }
    } catch { /* ignore logo extraction errors */ }

    // Call Claude
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a brand analyst for an e-commerce loyalty program tool.
Analyze the provided website HTML and extract brand characteristics.
You MUST respond with valid JSON only, no markdown, no explanation.

The JSON schema:
{
  "industry": string (one of: fashion, beauty, food, health, electronics, sports, home, other),
  "positioning": string (one of: premium, mid-market, mass),
  "estimated_aov": number (average order value in euros, your best estimate),
  "estimated_margin": number (gross margin as decimal 0-1, your best estimate),
  "recommended_program": string (one of: luxury, mid, mass),
  "suggested_tier_names": [string, string, string] (3 tier names in French, reflecting the brand tone),
  "suggested_missions": [string] (3-5 mission ideas tailored to this brand, in French),
  "brand_tone": string (one of: luxury, friendly, playful, professional),
  "brand_name": string (the brand name extracted from the site),
  "brand_description": string (one sentence summary of what they sell, in French)
}

Rules:
- If positioning is "premium", recommended_program MUST be "luxury"
- If positioning is "mid-market", recommended_program MUST be "mid"
- If positioning is "mass", recommended_program MUST be "mass"
- estimated_aov should be realistic for the industry and positioning
- estimated_margin: luxury/premium ~0.55-0.70, mid ~0.40-0.55, mass ~0.25-0.40
- suggested_tier_names should match brand_tone (luxury: elegant names, playful: fun names, etc.)
- suggested_missions should be specific to the brand, not generic`,
      messages: [
        {
          role: 'user',
          content: `Analyze this e-commerce website HTML and extract brand characteristics:\n\n${truncatedHtml}`,
        },
      ],
    });

    // Parse response
    const responseText = message.content[0].text;
    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    // Validate and return
    const validated = {
      industry: analysis.industry || 'other',
      positioning: analysis.positioning || 'mid-market',
      estimated_aov: Number(analysis.estimated_aov) || 60,
      estimated_margin: Number(analysis.estimated_margin) || 0.5,
      recommended_program: analysis.recommended_program || 'mid',
      suggested_tier_names: Array.isArray(analysis.suggested_tier_names)
        ? analysis.suggested_tier_names.slice(0, 3)
        : ['Bronze', 'Argent', 'Or'],
      suggested_missions: Array.isArray(analysis.suggested_missions)
        ? analysis.suggested_missions.slice(0, 5)
        : [],
      brand_tone: analysis.brand_tone || 'professional',
      brand_name: analysis.brand_name || '',
      brand_description: analysis.brand_description || '',
      brand_logo: brandLogo || null,
    };

    return res.status(200).json(validated);
  } catch (err) {
    console.error('Brand analysis error:', err);
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
}
