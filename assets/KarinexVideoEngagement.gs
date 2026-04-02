/* ================================================================
   KARINEX – Video Engagement Tracker
   Google Apps Script – Real shared views, likes & dislikes
   
   KEINE Spreadsheet nötig! Verwendet eingebauten ScriptProperties-Speicher.
   
   SETUP (2 Minuten):
   ──────────────────
   1. Gehe zu https://script.google.com → Neues Projekt
      → Lösche alles in Code.gs → Füge diesen Code ein
   
   2. Klicke Deploy → New deployment
      → Type: Web app
      → Execute as: Me
      → Who has access: Anyone
      → Deploy → URL kopieren
   
   3. Füge die URL im Theme ein:
      In product-information.liquid, suche nach VIDEO_ENGAGEMENT_API
      und ersetze '' mit deiner URL
   
   FERTIG! Keine Spreadsheet, keine Sheets, keine Headers.
   ================================================================ */

function doGet(e) {
  var p = e.parameter || {};
  var action = p.action || 'get';
  var vid = p.vid || '';
  var uid = p.uid || '';
  
  if (!vid) return json({ error: 'vid missing' });

  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(10000);
  } catch (e) {
    return json({ error: 'busy' });
  }
  
  try {
    var data = loadVideo(props, vid);
    
    if (action === 'view') {
      data.views += 1;
      saveVideo(props, vid, data);
    }
    
    if (action === 'share') {
      data.shares = (data.shares || 0) + 1;
      saveVideo(props, vid, data);
    }
    
    if (action === 'like' || action === 'dislike') {
      if (!uid) return json({ error: 'uid missing' });
      var prev = getUserAction(props, uid, vid);
      
      if (action === 'like') {
        if (prev === 'like') {
          data.likes = Math.max(0, data.likes - 1);
          setUserAction(props, uid, vid, '');
        } else {
          if (prev === 'dislike') data.dislikes = Math.max(0, data.dislikes - 1);
          data.likes += 1;
          setUserAction(props, uid, vid, 'like');
        }
      } else {
        if (prev === 'dislike') {
          data.dislikes = Math.max(0, data.dislikes - 1);
          setUserAction(props, uid, vid, '');
        } else {
          if (prev === 'like') data.likes = Math.max(0, data.likes - 1);
          data.dislikes += 1;
          setUserAction(props, uid, vid, 'dislike');
        }
      }
      saveVideo(props, vid, data);
    }
    
    var myAction = uid ? getUserAction(props, uid, vid) : '';
    return json({ views: data.views, likes: data.likes, dislikes: data.dislikes, shares: data.shares || 0, myAction: myAction });
    
  } finally {
    lock.releaseLock();
  }
}

function loadVideo(props, vid) {
  var raw = props.getProperty('v_' + vid);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  return { views: 0, likes: 0, dislikes: 0, shares: 0 };
}

function saveVideo(props, vid, data) {
  props.setProperty('v_' + vid, JSON.stringify(data));
}

function getUserAction(props, uid, vid) {
  var raw = props.getProperty('u_' + uid + '_' + vid);
  return raw || '';
}

function setUserAction(props, uid, vid, action) {
  var key = 'u_' + uid + '_' + vid;
  if (action) {
    props.setProperty(key, action);
  } else {
    props.deleteProperty(key);
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

