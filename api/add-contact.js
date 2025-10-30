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

    console.log('Starting ActiveCampaign process for:', email);

    // STEP 1: Create Contact
    const createContactResponse = await fetch('https://idpmgroup.api-us1.com/api/3/contacts', {
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

    // Check if contact creation succeeded
    if (!createContactResponse.ok) {
      const errorText = await createContactResponse.text();
      console.error('Contact creation error:', createContactResponse.status, errorText);
      return res.status(500).json({
        error: 'Failed to create contact',
        status: createContactResponse.status,
        details: errorText
      });
    }

    const contactData = await createContactResponse.json();
    const contactId = contactData.contact.id;

    console.log('Contact created with ID:', contactId);

    // STEP 2: Add Contact to List 9
    const addToListResponse = await fetch('https://idpmgroup.api-us1.com/api/3/contactLists', {
      method: 'POST',
      headers: {
        'Api-Token': process.env.AC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contactList: {
          list: 9,              // YOUR LIST ID
          contact: contactId,   // Contact ID from Step 1
          status: 1             // 1 = Active subscription
        }
      })
    });

    // Check if list subscription succeeded
    if (!addToListResponse.ok) {
      const errorText = await addToListResponse.text();
      console.error('List subscription error:', addToListResponse.status, errorText);
      
      // Contact was created but not added to list - still return partial success
      return res.status(200).json({
        success: true,
        contactId: contactId,
        warning: 'Contact created but could not be added to list',
        listError: errorText
      });
    }

    const listData = await addToListResponse.json();

    console.log('Contact added to list successfully');

    // SUCCESS - Both steps completed!
    return res.status(200).json({
      success: true,
      contactId: contactId,
      listSubscriptionId: listData.contactList?.id,
      message: 'Contact created and added to list successfully'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
}
