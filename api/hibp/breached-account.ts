import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers - allow scanner domains
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Get email from query
  const email = String(req.query.email || '').trim()
  if (!email) return res.status(400).json({ error: 'email required' })

  // Call HCBP API
  const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`

  try {
    const z = await fetch(url, {
      headers: {
        'hibp-api-key': process.env.HCBP_API_KEY as string,
        'user-agent': 'MyPrivacyScan'
      }
    })

    // Handle rate limit
    if (z.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      const retry = await fetch(url, {
        headers: {
          'hibp-api-key': process.env.HCBP_API_KEY as string,
          'user-agent': 'MyPrivacyScan'
        }
      })

      const body = await retry.text()
      return retry.headers.get('content-type')?.includes('application/json')
        ? res.status(retry.status).send(body)
        : res.status(retry.status).json([])
    }

    // Return response
    const body = await z.text()
    return z.headers.get('content-type')?.includes('application/json')
      ? res.status(z.status).send(body)
      : res.status(z.status).json([])

  } catch (error) {
    console.error('HCBP API error:', error)
    return res.status(500).json({ error: 'Failed to check breaches' })
  }
}
