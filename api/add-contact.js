export default async function handler(req, res) {
  // CORS headers - Allow FlutterFlow to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get data from FlutterFlow
    const { email, firstName, breachCount, breachNames } = req.body;

    // Validate
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Call ActiveCampaign
    const acResponse = await fetch('https://idpmgroup.api-us1.com/api/3/contacts', {
      method: 'POST',
      headers: {
        'Api-Token': process.env.AC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact: {
          email: email,
          firstName: firstName || ''
        }
      })
    });

    const acData = await acResponse.json();

    if (!acResponse.ok) {
      console.error('ActiveCampaign error:', acData);
      return res.status(acResponse.status).json({
        error: 'ActiveCampaign API error',
        details: acData
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      contactId: acData.contact?.id,
      message: 'Contact created successfully'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
}
