const AC_API = 'https://idpmgroup.api-us1.com/api/3';                         
  const STATS_EMAIL = 'scanner-stats@secureme.internal';
  const STATS_CONTACT_ID = '22065';                                             
  const STATS_NOTE_ID = '103';                                                  
                                                                                
  function getArizonaDate() {                                                   
    var now = new Date();
    var az = new Date(now.toLocaleString('en-US', { timeZone: 'America/Phoenix'
  }));
    return az.getFullYear() + '-' + String(az.getMonth() + 1).padStart(2, '0') +
   '-' + String(az.getDate()).padStart(2, '0');                                 
  }
                                                                                
  export default async function handler(req, res) {                             
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');        
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    var AC_KEY = process.env.AC_API_KEY;                                        
    var today = getArizonaDate();
    try {                                                                       
      if (req.method === 'POST') {
        var country = (req.body && req.body.country) || 'US';                   
        var noteResp = await fetch(AC_API + '/notes/' + STATS_NOTE_ID, {
  headers: { 'Api-Token': AC_KEY } });                                          
        var noteData = await noteResp.json();
        var stats = {};                                                         
        try { stats = JSON.parse(noteData.note.note); } catch(e) {}
        if (!stats[today]) stats[today] = { views_total: 0, views_us: 0,        
  views_ca: 0, views_other: 0 };                                                
        stats[today].views_total = (stats[today].views_total || 0) + 1;
        if (country === 'CA') { stats[today].views_ca = (stats[today].views_ca  
  || 0) + 1; }                                                                  
        else if (country === 'US') { stats[today].views_us =
  (stats[today].views_us || 0) + 1; }                                           
        else { stats[today].views_other = (stats[today].views_other || 0) + 1; }
        await fetch(AC_API + '/notes/' + STATS_NOTE_ID, {                       
          method: 'PUT',
          headers: { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ note: { note: JSON.stringify(stats) } })       
        });
        return res.status(200).json({ success: true, today: stats[today] });    
      }      
      if (req.method === 'GET') {
        var noteResp = await fetch(AC_API + '/notes/' + STATS_NOTE_ID, {        
  headers: { 'Api-Token': AC_KEY } });
        var noteData = await noteResp.json();                                   
        var stats = {};
        try { stats = JSON.parse(noteData.note.note); } catch(e) {}             
        var tv = stats[today] || { views_total: 0, views_us: 0, views_ca: 0,
  views_other: 0 };                                                             
        var listResp = await fetch(AC_API + '/contacts?listid=9&limit=1', {
  headers: { 'Api-Token': AC_KEY } });                                          
        var listData = await listResp.json();
        var totalCaptures = parseInt((listData.meta && listData.meta.total) ||
  '0');                                                                         
        var d = new Date(today + 'T00:00:00-07:00');
        d.setDate(d.getDate() + 1);                                             
        var tomorrowStr = d.toISOString().slice(0, 10);
        var todayResp = await fetch(AC_API +                                    
  '/contacts?listid=9&filters%5Bcreated_after%5D=' + today +                    
  '&filters%5Bcreated_before%5D=' + tomorrowStr + '&limit=1', { headers: {      
  'Api-Token': AC_KEY } });                                                     
        var todayData = await todayResp.json();
        var todayCaptures = parseInt((todayData.meta && todayData.meta.total) ||
   '0');                                                                        
        var totalViews = tv.views_total || 0;
        var rate = totalViews > 0 ? ((todayCaptures / totalViews) *             
  100).toFixed(1) : '0.0';                                                      
        return res.status(200).json({ today: { date: today, views_total:
  totalViews, views_us: tv.views_us || 0, views_ca: tv.views_ca || 0,           
  views_other: tv.views_other || 0, emails_captured: todayCaptures,
  conversion_rate: rate + '%' }, allTime: { total_email_captures: totalCaptures 
  }, daily_history: stats });
      }
    } catch(e) { return res.status(500).json({ error: e.message }); }
    return res.status(405).json({ error: 'Method not allowed' });               
  }
