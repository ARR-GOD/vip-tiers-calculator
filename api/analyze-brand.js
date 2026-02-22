import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Clean raw HTML: extract meta tags + visible text, strip scripts/styles/noise.
 * This prevents third-party tools (Shoplift, Klaviyo, etc.) from polluting brand analysis.
 */
function cleanHtml(html, url) {
  const parts = [];

  // 1. Extract key meta tags (title, description, og:*)
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  if (title) parts.push(`Page title: ${title}`);

  const metaPatterns = [
    { name: 'description', re: /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i },
    { name: 'og:title', re: /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i },
    { name: 'og:description', re: /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i },
    { name: 'og:site_name', re: /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i },
  ];
  // Also try reversed attribute order (content before property)
  const metaPatternsAlt = [
    { name: 'description', re: /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i },
    { name: 'og:title', re: /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i },
    { name: 'og:description', re: /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i },
    { name: 'og:site_name', re: /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i },
  ];
  for (const p of metaPatterns) {
    const m = html.match(p.re) || html.match(metaPatternsAlt.find(a => a.name === p.name)?.re);
    if (m?.[1]) parts.push(`${p.name}: ${m[1].trim()}`);
  }

  parts.push(`URL: ${url}`);
  parts.push('---');

  // 2. Extract Shopify product JSON-LD (structured data)
  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1]);
      if (data['@type'] === 'Organization' || data['@type'] === 'WebSite') {
        parts.push(`Structured data (${data['@type']}): ${JSON.stringify(data).slice(0, 2000)}`);
      }
    } catch { /* skip invalid JSON-LD */ }
  }

  // 3. Strip scripts, styles, SVGs, noscript, and common third-party noise
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '') // nav is noisy
    .replace(/<footer[\s\S]*?<\/footer>/gi, ''); // footer is noisy

  // 4. Extract visible text from remaining HTML
  cleaned = cleaned
    .replace(/<[^>]+>/g, ' ')          // strip all tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim();

  // 5. Take the meaningful portion
  if (cleaned.length > 15000) cleaned = cleaned.slice(0, 15000);
  parts.push('Visible page text:');
  parts.push(cleaned);

  return parts.join('\n');
}

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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!fetchRes.ok) {
      return res.status(422).json({ error: `Could not fetch website (HTTP ${fetchRes.status})` });
    }

    const html = await fetchRes.text();
    const cleanedContent = cleanHtml(html, normalizedUrl);

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
Analyze the provided website content (meta tags + visible text) and extract brand characteristics.
Focus on the actual brand, NOT third-party tools (Shopify, Shoplift, Klaviyo, etc.).
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
          content: `Analyze this e-commerce website and extract brand characteristics:\n\n${cleanedContent}`,
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
