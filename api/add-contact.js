export default async function handler(req, res) {
  // CORS headers - for FlutterFlow to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, firstName, breachCount, breachNames } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('Creating contact:', email);

    // STEP 1: Create Contact - NO Content-Type header to AC
    const createContactResponse = await fetch('https://idpmgroup.api-us1.com/api/3/contacts', {
      method: 'POST',
      headers: {
        'Api-Token': process.env.AC_API_KEY
      },
      body: JSON.stringify({
        contact: {
          email: email,
          first_name: firstName || ''  // ← USING first_name AS YOU SPECIFIED
        }
      })
    });

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

    console.log('Contact created:', contactId);

    // STEP 2: Add to List - NO Content-Type header to AC
    const addToListResponse = await fetch('https://idpmgroup.api-us1.com/api/3/contactLists', {
      method: 'POST',
      headers: {
        'Api-Token': process.env.AC_API_KEY
      },
      body: JSON.stringify({
        contactList: {
          list: 9,
          contact: contactId,
          status: 1
        }
      })
    });

    if (!addToListResponse.ok) {
      const errorText = await addToListResponse.text();
      console.error('List error:', addToListResponse.status, errorText);
      
      return res.status(200).json({
        success: true,
        contactId: contactId,
        warning: 'Contact created but not added to list'
      });
    }

    const listData = await addToListResponse.json();

    return res.status(200).json({
      success: true,
      contactId: contactId,
      listSubscriptionId: listData.contactList?.id
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
}
