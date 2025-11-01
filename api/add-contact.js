export default async function handler(req, res) {
  // CORS headers - Allow FlutterFlow to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
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

    // STEP 1: Create Contact with custom fields
    const createContactResponse = await fetch('https://idpmgroup.api-us1.com/api/3/contacts', {
      method: 'POST',
      headers: {
        'Api-Token': process.env.AC_API_KEY
      },
      body: JSON.stringify({
        contact: {
          email: email,
          fieldValues: [
            {
              field: "3",
              value: firstName || ""
            },
            {
              field: "4",
              value: breachCount || "0"
            },
            {
              field: "5",
              value: breachNames || "none"
            }
          ]
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

    // STEP 2: Subscribe to List 9
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
      console.error('List subscription error:', addToListResponse.status, errorText);
      
      // Contact created, but list subscription failed
      return res.status(200).json({
        success: true,
        contactId: contactId,
        warning: 'Contact created but list subscription failed'
      });
    }

    const listData = await addToListResponse.json();
    console.log('List subscription successful');

    // Return success
    return res.status(200).json({
      success: true,
      contactId: contactId,
      listSubscriptionId: listData.contactList?.id,
      message: 'Contact created and subscribed successfully'
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
}
