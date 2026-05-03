/*
Night Wardens Auto-GM — Pass 6
Shared / Private Campaign Layer

Purpose:
- Stores public party transcript and private player branch logs.
- Connects Auto-GM cases to campaigns.
- Provides Firebase-ready adapter hooks while still working locally.
- Allows players to reveal private discoveries to the party.

This module is dependency-light and can run in browser or Node-like tests.
*/

(function(global){
  const NWSharedPrivate = {};

  const DEFAULT_VISIBILITY = {
    PUBLIC: 'public',
    PRIVATE: 'private',
    GM: 'gm',
    SYSTEM: 'system'
  };

  function nowIso(){ return new Date().toISOString(); }
  function uid(prefix='id'){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
  }
  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  NWSharedPrivate.createCampaignCase = function({ campaignId, campaignCode='', title='Untitled Auto-GM Case', createdBy='local-user', mode='shared' } = {}){
    const caseId = uid('case');
    return {
      id: caseId,
      campaignId: campaignId || uid('campaign'),
      campaignCode,
      title,
      mode,
      status: 'active',
      phase: 'seed',
      createdBy,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      memberIds: createdBy ? [createdBy] : [],
      publicState: {
        seasonPressure: null,
        caseSeed: null,
        location: 'Unknown',
        pressureClock: 0,
        knownClues: [],
        revealedSigns: [],
        knownPossibleEntities: [],
        knownWeaknesses: [],
        knownAnchors: [],
        prep: [],
        sharedFlags: {}
      },
      hiddenState: {
        trueEntity: null,
        anchor: null,
        killCondition: null,
        unrevealedSigns: [],
        secrets: [],
        aiMemory: [],
        pressureReasons: []
      },
      transcripts: {
        public: [],
        system: [],
        gm: []
      },
      privateBranches: {},
      revealQueue: [],
      playerPresence: {},
      permissions: {
        allowPlayersRevealOwnPrivateClues: true,
        allowPlayersCreatePrivateBranches: true,
        allowPartyViewPublicTranscript: true,
        allowPlayersEditCampaignCase: false
      }
    };
  };

  NWSharedPrivate.ensurePrivateBranch = function(caseState, playerId, displayName){
    const state = clone(caseState);
    if(!state.privateBranches) state.privateBranches = {};
    if(!state.privateBranches[playerId]){
      state.privateBranches[playerId] = {
        playerId,
        displayName: displayName || playerId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        privateLocation: null,
        privateClues: [],
        privateSigns: [],
        privateTranscript: [],
        privateFlags: {},
        unrevealedToParty: []
      };
    }
    state.updatedAt = nowIso();
    return state;
  };

  NWSharedPrivate.logPublic = function(caseState, { actor='Auto-GM', text, action=null, tags=[] } = {}){
    const state = clone(caseState);
    state.transcripts = state.transcripts || { public: [], system: [], gm: [] };
    const entry = {
      id: uid('pub'),
      visibility: DEFAULT_VISIBILITY.PUBLIC,
      actor,
      text: text || '',
      action,
      tags,
      createdAt: nowIso()
    };
    state.transcripts.public.push(entry);
    state.updatedAt = nowIso();
    return { caseState: state, entry };
  };

  NWSharedPrivate.logSystem = function(caseState, { text, tags=[] } = {}){
    const state = clone(caseState);
    state.transcripts = state.transcripts || { public: [], system: [], gm: [] };
    const entry = {
      id: uid('sys'),
      visibility: DEFAULT_VISIBILITY.SYSTEM,
      actor: 'System',
      text: text || '',
      tags,
      createdAt: nowIso()
    };
    state.transcripts.system.push(entry);
    state.updatedAt = nowIso();
    return { caseState: state, entry };
  };

  NWSharedPrivate.logPrivate = function(caseState, { playerId, displayName, actor, text, action=null, tags=[], revealable=true } = {}){
    let state = NWSharedPrivate.ensurePrivateBranch(caseState, playerId, displayName);
    const branch = state.privateBranches[playerId];
    const entry = {
      id: uid('priv'),
      visibility: DEFAULT_VISIBILITY.PRIVATE,
      playerId,
      actor: actor || displayName || playerId,
      text: text || '',
      action,
      tags,
      revealable,
      revealed: false,
      createdAt: nowIso()
    };
    branch.privateTranscript.push(entry);
    if(revealable) branch.unrevealedToParty.push(entry.id);
    branch.updatedAt = nowIso();
    state.updatedAt = nowIso();
    return { caseState: state, entry };
  };

  NWSharedPrivate.addPublicClue = function(caseState, clue){
    const state = clone(caseState);
    const normalized = {
      id: clue.id || uid('clue'),
      title: clue.title || 'Untitled Clue',
      text: clue.text || '',
      source: clue.source || 'unknown',
      tags: clue.tags || [],
      createdAt: clue.createdAt || nowIso()
    };
    state.publicState.knownClues.push(normalized);
    state.updatedAt = nowIso();
    return { caseState: state, clue: normalized };
  };

  NWSharedPrivate.addPrivateClue = function(caseState, { playerId, displayName, clue }){
    let state = NWSharedPrivate.ensurePrivateBranch(caseState, playerId, displayName);
    const branch = state.privateBranches[playerId];
    const normalized = {
      id: clue.id || uid('pclue'),
      title: clue.title || 'Private Clue',
      text: clue.text || '',
      source: clue.source || 'private branch',
      tags: clue.tags || [],
      revealable: clue.revealable !== false,
      revealed: false,
      createdAt: clue.createdAt || nowIso()
    };
    branch.privateClues.push(normalized);
    if(normalized.revealable) branch.unrevealedToParty.push(normalized.id);
    branch.updatedAt = nowIso();
    state.updatedAt = nowIso();
    return { caseState: state, clue: normalized };
  };

  NWSharedPrivate.queueReveal = function(caseState, { playerId, clueId=null, transcriptId=null, revealText=null }){
    const state = clone(caseState);
    const branch = state.privateBranches?.[playerId];
    if(!branch) return { caseState: state, queued: false, reason: 'No private branch for player.' };
    let item = null;
    if(clueId) item = branch.privateClues.find(c => c.id === clueId);
    if(!item && transcriptId) item = branch.privateTranscript.find(t => t.id === transcriptId);
    if(!item && revealText) item = { id: uid('manualReveal'), title: 'Player Revelation', text: revealText, source: 'manual', tags: ['manual'] };
    if(!item) return { caseState: state, queued: false, reason: 'Reveal target not found.' };
    if(item.revealable === false) return { caseState: state, queued: false, reason: 'This item is marked not revealable.' };
    const reveal = {
      id: uid('reveal'),
      playerId,
      sourceId: item.id,
      title: item.title || 'Private Discovery',
      text: item.text,
      tags: item.tags || [],
      status: 'queued',
      createdAt: nowIso()
    };
    state.revealQueue = state.revealQueue || [];
    state.revealQueue.push(reveal);
    state.updatedAt = nowIso();
    return { caseState: state, queued: true, reveal };
  };

  NWSharedPrivate.publishReveal = function(caseState, revealId, { actor='Auto-GM' } = {}){
    let state = clone(caseState);
    const reveal = state.revealQueue?.find(r => r.id === revealId);
    if(!reveal) return { caseState: state, published: false, reason: 'Reveal not found.' };
    reveal.status = 'published';
    reveal.publishedAt = nowIso();
    const publicText = `${reveal.title}: ${reveal.text}`;
    const logged = NWSharedPrivate.logPublic(state, { actor, text: publicText, tags: ['revealed-private-clue', ...(reveal.tags||[])] });
    state = logged.caseState;
    const branch = state.privateBranches?.[reveal.playerId];
    if(branch){
      for(const clue of branch.privateClues){ if(clue.id === reveal.sourceId) clue.revealed = true; }
      for(const t of branch.privateTranscript){ if(t.id === reveal.sourceId) t.revealed = true; }
      branch.unrevealedToParty = (branch.unrevealedToParty || []).filter(id => id !== reveal.sourceId);
      branch.updatedAt = nowIso();
    }
    state.updatedAt = nowIso();
    return { caseState: state, published: true, reveal, publicEntry: logged.entry };
  };

  NWSharedPrivate.applyActionResult = function(caseState, { parsedAction, rollResult=null, witnessResult=null, creatureResult=null }){
    let state = clone(caseState);
    const privacy = parsedAction?.privacy || 'public';
    const actor = parsedAction?.actor || 'Unknown Warden';
    const playerId = parsedAction?.playerId || actor;
    const intent = parsedAction?.intent || 'act';
    const target = parsedAction?.target || 'the situation';
    const resultTier = rollResult?.tier || rollResult?.resultTier || 'unrolled';

    const baseText = summarizeAction(parsedAction, rollResult, witnessResult, creatureResult);
    if(privacy === 'private'){
      const privateLog = NWSharedPrivate.logPrivate(state, { playerId, displayName: actor, actor, text: baseText, action: parsedAction, tags: [intent, target, resultTier], revealable: true });
      state = privateLog.caseState;
      if(witnessResult?.privateClue){
        state = NWSharedPrivate.addPrivateClue(state, { playerId, displayName: actor, clue: witnessResult.privateClue }).caseState;
      }
      if(creatureResult?.privateSign){
        state = NWSharedPrivate.addPrivateClue(state, { playerId, displayName: actor, clue: creatureResult.privateSign }).caseState;
      }
    } else {
      const publicLog = NWSharedPrivate.logPublic(state, { actor, text: baseText, action: parsedAction, tags: [intent, target, resultTier] });
      state = publicLog.caseState;
      if(witnessResult?.publicClue){ state = NWSharedPrivate.addPublicClue(state, witnessResult.publicClue).caseState; }
      if(creatureResult?.publicSign){ state = NWSharedPrivate.addPublicClue(state, creatureResult.publicSign).caseState; }
    }

    const pressureDelta = Number(rollResult?.pressureDelta || witnessResult?.pressureDelta || creatureResult?.pressureDelta || 0);
    if(pressureDelta){
      state.publicState.pressureClock = Math.max(0, (state.publicState.pressureClock || 0) + pressureDelta);
      state.hiddenState.pressureReasons = state.hiddenState.pressureReasons || [];
      state.hiddenState.pressureReasons.push({ id: uid('pressure'), amount: pressureDelta, reason: `${actor} ${intent} ${target}: ${resultTier}`, createdAt: nowIso() });
    }
    state.updatedAt = nowIso();
    return { caseState: state };
  };

  function summarizeAction(parsedAction={}, rollResult={}, witnessResult={}, creatureResult={}){
    const actor = parsedAction.actor || 'A Warden';
    const intent = parsedAction.intent || 'acts on';
    const target = parsedAction.target || 'the scene';
    const tier = rollResult?.tier || rollResult?.resultTier || 'unrolled';
    const details = [];
    if(rollResult?.total !== undefined) details.push(`roll ${rollResult.total} vs ${rollResult.target ?? '?'}`);
    if(witnessResult?.summary) details.push(witnessResult.summary);
    if(creatureResult?.summary) details.push(creatureResult.summary);
    if(details.length === 0) details.push('the Auto-GM records the action for case momentum');
    return `${actor} attempts to ${intent} ${target}. Result: ${tier}. ${details.join(' | ')}`;
  }

  NWSharedPrivate.updatePresence = function(caseState, { playerId, displayName, status='online', currentView='campaign' }){
    const state = clone(caseState);
    state.playerPresence = state.playerPresence || {};
    state.playerPresence[playerId] = { playerId, displayName: displayName || playerId, status, currentView, lastSeenAt: nowIso() };
    state.updatedAt = nowIso();
    return state;
  };

  NWSharedPrivate.localStore = {
    save(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; },
    load(key, fallback=null){
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
    },
    remove(key){ localStorage.removeItem(key); }
  };

  NWSharedPrivate.FirebaseAdapter = function({ firebaseApp=null, db=null, auth=null, firestoreApi=null } = {}){
    // This adapter is intentionally written as a wrapper so the static GitHub page can remain usable without Firebase.
    // Expected firestoreApi may be modular Firebase functions: doc, setDoc, getDoc, updateDoc, onSnapshot,
    // collection, addDoc, serverTimestamp, query, where, orderBy.
    return {
      isAvailable(){ return !!(db && firestoreApi); },
      currentUser(){ return auth?.currentUser || null; },
      async saveCampaignCase(caseState){
        if(!this.isAvailable()) throw new Error('Firebase/Firestore not available.');
        const { doc, setDoc } = firestoreApi;
        const ref = doc(db, 'campaignCases', caseState.id);
        await setDoc(ref, { ...caseState, updatedAt: nowIso() }, { merge: true });
        return caseState;
      },
      async loadCampaignCase(caseId){
        if(!this.isAvailable()) throw new Error('Firebase/Firestore not available.');
        const { doc, getDoc } = firestoreApi;
        const ref = doc(db, 'campaignCases', caseId);
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
      },
      listenCampaignCase(caseId, callback){
        if(!this.isAvailable()) throw new Error('Firebase/Firestore not available.');
        const { doc, onSnapshot } = firestoreApi;
        const ref = doc(db, 'campaignCases', caseId);
        return onSnapshot(ref, snap => callback(snap.exists() ? snap.data() : null));
      },
      async savePrivateBranch(caseId, playerId, branch){
        if(!this.isAvailable()) throw new Error('Firebase/Firestore not available.');
        const { doc, setDoc } = firestoreApi;
        const ref = doc(db, 'campaignCases', caseId, 'privateBranches', playerId);
        await setDoc(ref, { ...branch, updatedAt: nowIso() }, { merge: true });
        return branch;
      },
      listenPrivateBranch(caseId, playerId, callback){
        if(!this.isAvailable()) throw new Error('Firebase/Firestore not available.');
        const { doc, onSnapshot } = firestoreApi;
        const ref = doc(db, 'campaignCases', caseId, 'privateBranches', playerId);
        return onSnapshot(ref, snap => callback(snap.exists() ? snap.data() : null));
      }
    };
  };

  NWSharedPrivate.getPlayerVisibleState = function(caseState, playerId){
    return {
      id: caseState.id,
      campaignId: caseState.campaignId,
      title: caseState.title,
      phase: caseState.phase,
      status: caseState.status,
      publicState: clone(caseState.publicState),
      publicTranscript: clone(caseState.transcripts?.public || []),
      systemTranscript: clone(caseState.transcripts?.system || []),
      privateBranch: clone(caseState.privateBranches?.[playerId] || null),
      revealQueue: clone((caseState.revealQueue || []).filter(r => r.playerId === playerId || r.status === 'published')),
      playerPresence: clone(caseState.playerPresence || {})
    };
  };

  NWSharedPrivate.getPartyVisibleState = function(caseState){
    return {
      id: caseState.id,
      campaignId: caseState.campaignId,
      title: caseState.title,
      phase: caseState.phase,
      status: caseState.status,
      publicState: clone(caseState.publicState),
      publicTranscript: clone(caseState.transcripts?.public || []),
      systemTranscript: clone(caseState.transcripts?.system || []),
      revealQueue: clone((caseState.revealQueue || []).filter(r => r.status === 'published')),
      playerPresence: clone(caseState.playerPresence || {})
    };
  };

  global.NWSharedPrivate = NWSharedPrivate;
  if(typeof module !== 'undefined') module.exports = NWSharedPrivate;
})(typeof window !== 'undefined' ? window : globalThis);
