import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://my-privacy-scan-v2.flutterflow.app')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Get email from query
  const email = String(req.query.email || '').trim()
  if (!email) return res.status(400).json({ error: 'email required' })

  // Call HIBP API
  const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`
  
  try {
    const r = await fetch(url, {
      headers: {
        'hibp-api-key': process.env.HIBP_API_KEY as string,
        'user-agent': 'MyPrivacyScan'
      }
    })

    // Handle rate limit
    if (r.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      const retry = await fetch(url, {
        headers: {
          'hibp-api-key': process.env.HIBP_API_KEY as string,
          'user-agent': 'MyPrivacyScan'
        }
      })
      const body = await retry.text()
      return retry.headers.get('content-type')?.includes('application/json')
        ? res.status(retry.status).send(body)
        : res.status(retry.status).json([])
    }

    // Return response
    const body = await r.text()
    return r.headers.get('content-type')?.includes('application/json')
      ? res.status(r.status).send(body)
      : res.status(r.status).json([])
  } catch (error) {
    console.error('HIBP API error:', error)
    return res.status(500).json({ error: 'Failed to check breaches' })
  }
}
