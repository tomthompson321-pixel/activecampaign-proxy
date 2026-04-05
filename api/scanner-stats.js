 const AC_API = 'https://idpmgroup.api-us1.com/api/3'                          
  const STATS_EMAIL = 'scanner-stats@secureme.internal'                         
                                                                                
  async function getStatsContact(apiKey) {                                      
    const resp = await                                                          
  fetch(`${AC_API}/contacts?email=${encodeURIComponent(STATS_EMAIL)}&limit=1`, {
      headers: { 'Api-Token': apiKey }
    })                                                                          
    const data = await resp.json()
    if (data.contacts && data.contacts.length > 0) {                            
      return data.contacts[0].id
    }                                                                           
    const createResp = await fetch(`${AC_API}/contacts`, {
      method: 'POST',                                                           
      headers: { 'Api-Token': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: { email: STATS_EMAIL, firstName:          
  'Scanner', lastName: 'Stats' } })                                             
    })
    const createData = await createResp.json()                                  
    return createData.contact?.id
  }

  async function getStatsData(apiKey, contactId) {                              
    const resp = await
  fetch(`${AC_API}/contacts/${contactId}/notes?limit=1&orders[cdate]=DESC`, {   
      headers: { 'Api-Token': apiKey }
    })                                                                          
    const data = await resp.json()
    if (data.notes && data.notes.length > 0) {
      try {                                                                     
        return { noteId: data.notes[0].id, stats: JSON.parse(data.notes[0].note)
   }                                                                            
      } catch(e) {}
    }                                                                           
    return { noteId: null, stats: {} }
  }

  async function saveStatsData(apiKey, contactId, noteId, stats) {              
    if (noteId) {
      await fetch(`${AC_API}/notes/${noteId}`, {                                
        method: 'PUT',
        headers: { 'Api-Token': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: { note: JSON.stringify(stats) } })         
      })
    } else {                                                                    
      await fetch(`${AC_API}/notes`, {
        method: 'POST',                                                         
        headers: { 'Api-Token': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: { note: JSON.stringify(stats), relid:      
  contactId, reltype: 'Subscriber' } })                                         
      })
    }                                                                           
  }          

  export default async function handler(req, res) {                             
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')         
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()                  
   
    const AC_KEY = process.env.AC_API_KEY                                       
    const today = new Date().toISOString().slice(0, 10)
                                                                                
    try {
      const contactId = await getStatsContact(AC_KEY)                           
      if (!contactId) return res.status(500).json({ error: 'Could not get stats
  contact' })                                                                   
   
      if (req.method === 'POST') {                                              
        const country = req.body?.country || req.query?.country || 'US'
        const { noteId, stats } = await getStatsData(AC_KEY, contactId)
                                                                                
        if (!stats[today]) stats[today] = { views_us: 0, views_ca: 0 }
        if (country === 'CA') {                                                 
          stats[today].views_ca = (stats[today].views_ca || 0) + 1
        } else {                                                                
          stats[today].views_us = (stats[today].views_us || 0) + 1
        }                                                                       
             
        await saveStatsData(AC_KEY, contactId, noteId, stats)                   
        return res.status(200).json({ success: true, today: stats[today] })
      }                                                                         
             
      if (req.method === 'GET') {
        const { stats } = await getStatsData(AC_KEY, contactId)
        const todayViews = stats[today] || { views_us: 0, views_ca: 0 }         
   
        const listResp = await fetch(`${AC_API}/contacts?listid=9&limit=1`, {   
          headers: { 'Api-Token': AC_KEY }
        })                                                                      
        const listData = await listResp.json()
        const totalCaptures = parseInt(listData.meta?.total || '0')

        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 
  10)
        const todayResp = await fetch(`${AC_API}/contacts?listid=9&filters%5Bcre
  ated_after%5D=${today}&filters%5Bcreated_before%5D=${tomorrow}&limit=1`, {    
          headers: { 'Api-Token': AC_KEY }
        })                                                                      
        const todayData = await todayResp.json()
        const todayCaptures = parseInt(todayData.meta?.total || '0')
                                                                                
        const todayTotalViews = (todayViews.views_us || 0) +
  (todayViews.views_ca || 0)                                                    
        const conversionRate = todayTotalViews > 0 ? ((todayCaptures /
  todayTotalViews) * 100).toFixed(1) : '0.0'                                    
   
        return res.status(200).json({                                           
          today: {
            date: today,
            views_us: todayViews.views_us || 0,
            views_ca: todayViews.views_ca || 0,
            views_total: todayTotalViews,                                       
            emails_captured: todayCaptures,
            conversion_rate: conversionRate + '%'                               
          }, 
          allTime: {
            total_email_captures: totalCaptures
          },                                                                    
          daily_history: stats,
          timestamp: new Date().toISOString()                                   
        })   
      }
    } catch(e) {
      return res.status(500).json({ error: e.message })
    }
                                                                                
    return res.status(405).json({ error: 'Method not allowed' })
  }  
