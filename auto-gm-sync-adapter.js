// Night Wardens Auto-GM optional Firebase/Firestore sync adapter.
// Works on GitHub Pages when firebase-config.js defines window.NW_FIREBASE_CONFIG or window.firebaseConfig.
// Falls back gracefully to local-only mode when Firebase is not configured.
(function(){
  'use strict';
  const adapter = {
    enabled:false, statusText:'Local only', db:null, auth:null, user:null,
    campaignId:'local', caseId:'main', online:[], unsubCase:null, unsubPresence:null, pending:false,
    opts:null,
    status(){ return {enabled:this.enabled, status:this.statusText, online:this.online}; },
    getOnlinePlayers(){ return this.online || []; },
    async init(opts){
      this.opts = opts || {}; this.campaignId=opts.campaignId||'local'; this.caseId=opts.caseId||'main';
      if(this.campaignId==='local') { this.statusText='LocalStorage fallback'; opts.onStatus?.(this.statusText); return this.status(); }
      const config = window.NW_FIREBASE_CONFIG || window.firebaseConfig || window.FIREBASE_CONFIG || null;
      if(!config || !config.apiKey){ this.statusText='Local only — firebase-config.js not configured'; opts.onStatus?.(this.statusText); return this.status(); }
      try{
        const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
        const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
        const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
        this.fs = fsMod;
        const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(config);
        this.auth = authMod.getAuth(app);
        if(!this.auth.currentUser){ await authMod.signInAnonymously(this.auth).catch(()=>{}); }
        this.user = this.auth.currentUser || {uid:'anon_'+Math.random().toString(36).slice(2)};
        this.db = fsMod.getFirestore(app);
        this.enabled=true; this.statusText='Cloud sync connected'; opts.onStatus?.(this.statusText);
        await this.markPresence();
        this.subscribePresence();
        this.subscribeCase();
        return this.status();
      }catch(err){ console.warn('NWAutoGMSync init failed', err); this.enabled=false; this.statusText='Local only — cloud sync failed'; opts.onStatus?.(this.statusText); return this.status(); }
    },
    playerName(){ try { return this.opts?.getState?.()?.activePlayer || localStorage.getItem('nw_display_name') || 'Player'; } catch(e){ return 'Player'; } },
    caseDoc(){ return this.fs.doc(this.db, 'nightWardensCampaigns', this.campaignId, 'autoGmCases', this.caseId); },
    presenceDoc(){ return this.fs.doc(this.db, 'nightWardensCampaigns', this.campaignId, 'autoGmPresence', this.user.uid); },
    async markPresence(){ if(!this.enabled) return; const fs=this.fs; await fs.setDoc(this.presenceDoc(), { uid:this.user.uid, name:this.playerName(), caseId:this.caseId, online:true, lastSeen:fs.serverTimestamp() }, {merge:true}).catch(()=>{}); },
    subscribePresence(){ if(!this.enabled) return; const fs=this.fs; const q=fs.query(fs.collection(this.db,'nightWardensCampaigns',this.campaignId,'autoGmPresence'), fs.where('caseId','==',this.caseId)); this.unsubPresence=fs.onSnapshot(q, snap=>{ const cutoff=Date.now()-1000*60*10; this.online=[]; snap.forEach(d=>{ const v=d.data(); const ms=v.lastSeen?.toMillis?.() || Date.now(); if(v.online!==false && ms>=cutoff) this.online.push({id:d.id, uid:v.uid, name:v.name||d.id, lastSeen:ms}); }); this.opts?.onReadyUpdate?.(this.online); }, err=>console.warn('presence snapshot failed',err)); setInterval(()=>this.markPresence(), 30000); window.addEventListener('beforeunload',()=>{ try{ fs.setDoc(this.presenceDoc(), {online:false,lastSeen:fs.serverTimestamp()}, {merge:true}); }catch(e){} }); },
    subscribeCase(){ if(!this.enabled) return; const fs=this.fs; this.unsubCase=fs.onSnapshot(this.caseDoc(), snap=>{ if(!snap.exists()) return; const data=snap.data(); if(!data || !data.state) return; const local=this.opts?.getState?.(); if(local && data.updatedAt && local.syncInfo?.lastReceivedAt===data.updatedAt) return; const remote=data.state; remote.syncInfo=Object.assign({}, remote.syncInfo||{}, {enabled:true,status:'Cloud sync connected',lastReceivedAt:data.updatedAt}); this.opts?.setState?.(remote); }, err=>console.warn('case snapshot failed',err)); },
    publishState(state, options={}){ if(!this.enabled || !state || this.pending) return; this.pending=true; const copy=JSON.parse(JSON.stringify(state)); copy.syncInfo=Object.assign({}, copy.syncInfo||{}, {enabled:true,status:'Cloud sync connected'}); const fs=this.fs; const stamp=Date.now(); fs.setDoc(this.caseDoc(), { campaignId:this.campaignId, caseId:this.caseId, updatedAt:stamp, updatedBy:this.user?.uid||'local', state:copy }, {merge:true}).catch(err=>console.warn('case publish failed',err)).finally(()=>{ this.pending=false; }); }
  };
  window.NWAutoGMSync = adapter;
})();
