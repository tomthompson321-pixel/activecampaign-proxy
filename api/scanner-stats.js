const AC_API = 'https://idpmgroup.api-us1.com/api/3';
  const STATS_EMAIL = 'scanner-stats@secureme.internal';                        
   
  async function getStatsContact(apiKey) {                                      
    var resp = await fetch(AC_API + '/contacts?email=' +
  encodeURIComponent(STATS_EMAIL) + '&limit=1', { headers: { 'Api-Token': apiKey
   } });
    var data = await resp.json();                                               
    if (data.contacts && data.contacts.length > 0) return data.contacts[0].id;
    var createResp = await fetch(AC_API + '/contacts', { method: 'POST',        
  headers: { 'Api-Token': apiKey, 'Content-Type': 'application/json' }, body:   
  JSON.stringify({ contact: { email: STATS_EMAIL, firstName: 'Scanner',         
  lastName: 'Stats' } }) });                                                    
    var createData = await createResp.json();
    return createData.contact ? createData.contact.id : null;
  }

  async function getStatsData(apiKey, contactId) {                              
    var resp = await fetch(AC_API + '/contacts/' + contactId + '/notes?limit=1',
   { headers: { 'Api-Token': apiKey } });                                       
    var data = await resp.json();
    if (data.notes && data.notes.length > 0) { try { return { noteId:
  data.notes[0].id, stats: JSON.parse(data.notes[0].note) }; } catch(e) {} }    
    return { noteId: null, stats: {} };
  }                                                                             
             
  async function saveStatsData(apiKey, contactId, noteId, stats) {              
    var body = JSON.stringify({ note: { note: JSON.stringify(stats) } });
    if (noteId) {                                                               
      await fetch(AC_API + '/notes/' + noteId, { method: 'PUT', headers: {
  'Api-Token': apiKey, 'Content-Type': 'application/json' }, body: body });     
    } else { 
      await fetch(AC_API + '/notes', { method: 'POST', headers: { 'Api-Token':  
  apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ note: {  
  note: JSON.stringify(stats), relid: contactId, reltype: 'Subscriber' } }) });
    }                                                                           
  }          

  export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');              
    if (req.method === 'OPTIONS') return res.status(200).end();
    var AC_KEY = process.env.AC_API_KEY;                                        
    var today = new Date().toISOString().slice(0, 10);                          
    try {
      var contactId = await getStatsContact(AC_KEY);                            
      if (!contactId) return res.status(500).json({ error: 'No stats contact'
  });                                                                           
      if (req.method === 'POST') {
        var country = (req.body && req.body.country) || 'US';                   
        var r = await getStatsData(AC_KEY, contactId);
        var stats = r.stats;                                                    
        if (!stats[today]) stats[today] = { views_us: 0, views_ca: 0 };
        if (country === 'CA') { stats[today].views_ca = (stats[today].views_ca  
  || 0) + 1; } else { stats[today].views_us = (stats[today].views_us || 0) + 1; 
  }
        await saveStatsData(AC_KEY, contactId, r.noteId, stats);                
        return res.status(200).json({ success: true, today: stats[today] });    
      }
      if (req.method === 'GET') {                                               
        var r = await getStatsData(AC_KEY, contactId);
        var stats = r.stats;                                                    
        var tv = stats[today] || { views_us: 0, views_ca: 0 };
        var listResp = await fetch(AC_API + '/contacts?listid=9&limit=1', {     
  headers: { 'Api-Token': AC_KEY } });                                          
        var listData = await listResp.json();
        var totalCaptures = parseInt((listData.meta && listData.meta.total) ||  
  '0');                                                                         
        var tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,
  10);                                                                          
        var todayResp = await fetch(AC_API +
  '/contacts?listid=9&filters%5Bcreated_after%5D=' + today +                    
  '&filters%5Bcreated_before%5D=' + tomorrow + '&limit=1', { headers: {
  'Api-Token': AC_KEY } });                                                     
        var todayData = await todayResp.json();
        var todayCaptures = parseInt((todayData.meta && todayData.meta.total) ||
   '0');
        var totalViews = (tv.views_us || 0) + (tv.views_ca || 0);               
        var rate = totalViews > 0 ? ((todayCaptures / totalViews) *             
  100).toFixed(1) : '0.0';
        return res.status(200).json({ today: { date: today, views_us:           
  tv.views_us || 0, views_ca: tv.views_ca || 0, views_total: totalViews,        
  emails_captured: todayCaptures, conversion_rate: rate + '%' }, allTime: {
  total_email_captures: totalCaptures }, daily_history: stats });               
      }      
    } catch(e) { return res.status(500).json({ error: e.message }); }
    return res.status(405).json({ error: 'Method not allowed' });
  }
