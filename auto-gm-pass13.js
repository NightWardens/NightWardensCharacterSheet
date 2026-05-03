/* Night Wardens Auto-GM Pass 15 — TTS Agent + Game Warden Opener Narration. */
(function(){
'use strict';
const VERSION = 'pass18-1-shared-party-notes-v18.1';
const qs = new URLSearchParams(location.search);
const campaignId = qs.get('campaignId') || qs.get('campaign') || 'local';
const campaignCode = qs.get('campaignCode') || qs.get('code') || '';
const caseId = qs.get('caseId') || 'main';
const STORAGE_KEY = `nw_autogm_pass13_${campaignId}_${caseId}`;
let LIB = null;
let state = null;
let ephemeralLog = []; // small talk and non-clue chatter; not written to saved case JSON
const $ = id => document.getElementById(id);
const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const now = () => new Date().toLocaleTimeString();
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`;
const pick = arr => (arr && arr.length ? arr[Math.floor(Math.random()*arr.length)] : null);
const clamp = (n,min,max) => Math.max(min, Math.min(max, Number(n)||0));
const hasAny = (tags, needed) => !needed || needed.length===0 || needed.some(t => (tags||[]).includes(t));
const byId = (arr,id) => (arr||[]).find(x => x.id === id);
const dedupe = arr => { const seen = new Set(); return (arr||[]).filter(x => x && !seen.has(x.id) && seen.add(x.id)); };
const sample = (arr,n) => { const a=[...(arr||[])], out=[]; while(a.length && out.length<n){ out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]); } return out; };
function escapeHtml(s){ return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

function newState(){
  const players = ['Riley','Sam','Alex'];
  return {
    version: VERSION, campaignId, campaignCode, caseId,
    mode: 'solo', diceMode: '3d6', seedStyle: 'balanced', phase: 'seed', pressure: 0,
    players, activePlayer: 'Riley', characters: [], credits: 120,
    allies: [], relationshipMemory: {}, discoveredNPCs: [], assistantHistory: [], npcDialogueMemory: {}, partyActionCounter: 0, allyActionLog: [], partyNotes: [], noteDrafts: {}, connectedRoster: {selfId:null, online:[], lastSeen:{}}, readySettings: {simulateLocalReady:false}, caseDrawVote: null, syncInfo: {enabled:false,status:'local'}, voiceSettings: {enabled:false, npc:true, transmissions:true, rate:1, pitch:1, volume:1, voiceURI:'', voiceQuality:'natural', voiceStyle:'auto', autoOpener:true, llmOpener:true},
    inventory: {}, craftedTraps: [], hiddenActors: {}, suspects: [], preps: [],
    publicLog: [], privateLogs: {Riley:[],Sam:[],Alex:[]}, privateClues: {Riley:[],Sam:[],Alex:[]}, privateReveals: [],
    clues: [], leads: [], flags: {}, unlockedLocations: [], unlockedTopics: {}, currentLocation: null,
    graph: {theme:null, tarot:null, locations:[], witnesses:[], evidence:[], entity:null, signs:[], prep:[], complications:[], allies:[], strangers:[], wardenHqs:[], wardenAvailable:[]},
    actionClock: {location:null, actionsHere:0, totalActions:0, minorDraws:[]},
    combat: defaultCombat(),
    caseTitle: 'Unseeded Case'
  };
}
function defaultCombat(){ return {active:false, round:0, turn:'players', entityHp:0, entityMaxHp:0, entityState:'not engaged', participants:[], playerStates:{}, pendingThreat:null, log:[], playerActionsRemaining:2, allyActionsRemaining:0, allyActedThisRound:[]}; }
function combatLog(text){ state.combat.log = state.combat.log || []; state.combat.log.push({time:now(), text}); if(state.combat.log.length>40) state.combat.log.shift(); }
function isSafeLocation(){ const loc=byId(state.graph.locations,state.currentLocation)||{}; const tags=loc.tags||[]; return tags.includes('safehouse') || tags.includes('public') || tags.includes('hospital') || tags.includes('police') || tags.includes('records'); }
function tarotValueWeight(value){ const v=String(value||''); if(v==='Ace')return 1; if(['2','3'].includes(v))return 1; if(['4','5'].includes(v))return 2; if(['6','7'].includes(v))return 3; if(['8','9'].includes(v))return 4; if(v==='10')return 5; if(v==='Page')return 3; if(v==='Knight')return 4; if(v==='Queen')return 5; if(v==='King')return 6; return 2; }
function drawMinorPressure(reason='pressure draw'){
  if(!LIB?.tarot?.minor_suits || !LIB?.tarot?.values) return adjustPressure(1,reason);
  const suitId=pick(Object.keys(LIB.tarot.minor_suits)); const suit=LIB.tarot.minor_suits[suitId]; const value=pick(LIB.tarot.values); const reversed=Math.random()<0.28;
  const weight=tarotValueWeight(value); let inc=Math.max(1, Math.ceil(weight/2)); if(reversed) inc+=1;
  const effect={blades:'violence moves closer', blood:'a witness or victim thread worsens', relics:'gear/prep pressure changes', sigils:'ritual structure twists'}[suitId] || suit.domain || 'the hunt shifts';
  state.actionClock = state.actionClock || {minorDraws:[]}; state.actionClock.minorDraws = state.actionClock.minorDraws || [];
  state.actionClock.minorDraws.push({time:now(), suitId, suit:suit.name, value, reversed, inc, reason, effect});
  if(state.actionClock.minorDraws.length>12) state.actionClock.minorDraws.shift();
  state.pressure = clamp(state.pressure + inc, 0, 12);
  log(`Minor Arcana pressure draw: ${value} of ${suit.name}${reversed?' reversed':''}. Pressure +${inc}. ${effect}. Trigger: ${reason}.`, 'system');
  if(state.pressure>=10 && !state.combat.active && state.graph.entity){ log(`Crisis threshold reached. ${state.graph.entity.name} is close enough to force confrontation unless the Wardens retreat, hide, or complete the right preparation.`, 'system'); }
}
function recordActionPressure(action, rr){
  const passive=['look','list','inventory','shop','clues','leads','reveal','combat','status','commands','hq','dialogue','profile','allies','assistant','llm','voice'];
  if(passive.includes(action.intent)) return;
  state.actionClock = state.actionClock || {location:null,actionsHere:0,totalActions:0,minorDraws:[]};
  state.actionClock.totalActions++;
  if(action.intent==='move'){ state.actionClock.location=state.currentLocation; state.actionClock.actionsHere=0; return; }
  if(state.actionClock.location !== state.currentLocation){ state.actionClock.location=state.currentLocation; state.actionClock.actionsHere=0; }
  state.actionClock.actionsHere++;
  if(rr && rr.rolled && !rr.success) drawMinorPressure(`${action.actor}'s failed ${action.intent}`);
  if(!isSafeLocation() && state.actionClock.actionsHere>0 && state.actionClock.actionsHere%4===0) drawMinorPressure(`too many actions at the hunting ground without relocating (${state.actionClock.actionsHere})`);
}

function save(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} try{ window.NWAutoGMSync?.publishState?.(state); }catch(e){} }
function load(){
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || newState(); } catch(e){ state = newState(); }
  state.inventory = state.inventory || {}; state.craftedTraps = state.craftedTraps || []; state.hiddenActors = state.hiddenActors || {};
  state.suspects = state.suspects || []; state.credits = state.credits == null ? 120 : state.credits; state.allies = state.allies || []; state.relationshipMemory = state.relationshipMemory || {}; state.discoveredNPCs = state.discoveredNPCs || []; state.assistantHistory = state.assistantHistory || [];
  state.voiceSettings = Object.assign({enabled:false, npc:true, transmissions:true, rate:1, pitch:1, volume:1, voiceURI:'', voiceQuality:'natural', voiceStyle:'auto', autoOpener:true, llmOpener:true}, state.voiceSettings||{});
  state.actionClock = state.actionClock || {location:null, actionsHere:0, totalActions:0, minorDraws:[]};
  state.connectedRoster = state.connectedRoster || {selfId:null, online:[], lastSeen:{}}; state.readySettings = Object.assign({simulateLocalReady:false}, state.readySettings||{}); state.caseDrawVote = state.caseDrawVote || null; state.partyNotes = state.partyNotes || []; state.noteDrafts = state.noteDrafts || {}; state.syncInfo = Object.assign({enabled:false,status:'local'}, state.syncInfo||{});
  state.combat = state.combat || defaultCombat(); state.combat.playerStates = state.combat.playerStates || {}; state.combat.log = state.combat.log || []; state.npcDialogueMemory = state.npcDialogueMemory || {}; state.partyActionCounter = state.partyActionCounter || 0; state.allyActionLog = state.allyActionLog || []; state.combat.playerActionsRemaining = state.combat.playerActionsRemaining == null ? 2 : state.combat.playerActionsRemaining; state.combat.allyActionsRemaining = state.combat.allyActionsRemaining == null ? 0 : state.combat.allyActionsRemaining; state.combat.allyActedThisRound = state.combat.allyActedThisRound || [];
  state.players = state.players || ['Riley','Sam','Alex']; state.privateLogs = state.privateLogs || {}; state.privateClues = state.privateClues || {};
  state.players.forEach(p => { state.privateLogs[p] = state.privateLogs[p] || []; state.privateClues[p] = state.privateClues[p] || []; });
}

function cleanSpeechText(text){
  return String(text||'')
    .replace(/\[[^\]]+\]/g,'')
    .replace(/[`*_>#]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,900);
}
function availableVoices(){ try { return window.speechSynthesis ? window.speechSynthesis.getVoices() : []; } catch(e){ return []; } }
function voiceQualityScore(v){
  const name=String(v?.name||''); const lang=String(v?.lang||''); const uri=String(v?.voiceURI||''); const full=(name+' '+uri).toLowerCase();
  let score=0;
  if(/^en/i.test(lang)) score+=30;
  if(/en[-_]?us/i.test(lang)) score+=8;
  if(/google|siri|apple|samantha|alex|daniel|karen|moira|rishi|tessa|veena|premium|enhanced|neural|natural|online|aria|jenny|guy|ava|emma|brian|amy/i.test(name)) score+=45;
  if(/female|woman|samantha|karen|moira|aria|jenny|ava|emma|amy/i.test(name)) score+=4;
  if(/male|man|daniel|alex|guy|brian|rishi/i.test(name)) score+=3;
  if(/microsoft/i.test(full)) score-=12;
  if(/david|zira|mark|desktop|compact|default/i.test(full)) score-=25;
  if(/robot|espeak|festival/i.test(full)) score-=35;
  if(v?.localService===false) score+=8; // often cloud/enhanced voices when available
  return score;
}
function sortedVoices(){ return availableVoices().slice().sort((a,b)=>voiceQualityScore(b)-voiceQualityScore(a)); }
function selectedVoice(kind='transmission'){
  const voices = sortedVoices(); const uri = state?.voiceSettings?.voiceURI || $('ttsVoiceSelect')?.value || '';
  if(uri){ const chosen=voices.find(v=>v.voiceURI===uri); if(chosen) return chosen; }
  const style = state?.voiceSettings?.voiceStyle || 'auto';
  const wantsNpc = /npc|witness|stranger|dialogue/i.test(kind||'');
  const styleRegex = style==='female' ? /female|woman|samantha|karen|moira|aria|jenny|ava|emma|amy/i : style==='male' ? /male|man|daniel|alex|guy|brian|rishi/i : null;
  if(styleRegex){ const styled=voices.find(v=>styleRegex.test(v.name||'') && /^en/i.test(v.lang||'')); if(styled) return styled; }
  if(wantsNpc){
    return voices.find(v=>/samantha|karen|moira|aria|jenny|ava|emma|amy|google/i.test(v.name||'') && /^en/i.test(v.lang||'')) || voices[0] || null;
  }
  return voices.find(v=>/alex|daniel|guy|brian|google|aria|neural|natural|enhanced|premium/i.test(v.name||'') && /^en/i.test(v.lang||'')) || voices[0] || null;
}

function findAnyNPCByIdOrName(idOrName){
  const q=norm(idOrName); if(!q) return null;
  const pools=[...(state?.graph?.witnesses||[]),...(state?.graph?.allies||[]),...(state?.graph?.strangers||[]),...(state?.graph?.wardenAvailable||[]),...(state?.allies||[])];
  return pools.find(n=>n.id===idOrName || norm(n.name)===q || (n.aliases||[]).map(norm).includes(q)) || null;
}
function speakerProfile(speaker){
  if(!speaker) return null;
  const vp = speaker.voiceProfile || {};
  const prof = speaker.profile || {};
  const tags = speaker.tags || [];
  return {
    id:speaker.id, name:speaker.name,
    archetype: prof.archetype || speaker.type || speaker.role || speaker._type || 'civilian',
    voiceStyle: vp.style || prof.voiceStyle || (tags.includes('warden')?'authoritative':tags.includes('priest')?'solemn':tags.includes('police')?'guarded':'ordinary'),
    gender: vp.gender || prof.gender || 'any',
    age: vp.age || prof.age || 'adult',
    accent: vp.accent || prof.accent || 'neutral',
    rate: vp.rate ?? prof.rate ?? 1,
    pitch: vp.pitch ?? prof.pitch ?? 1,
    demeanor: prof.demeanor || speaker.demeanor || 'neutral'
  };
}
function selectedVoiceForSpeaker(speaker, kind='dialogue'){
  const profile=speakerProfile(speaker); const voices=sortedVoices();
  if(!profile || !voices.length) return selectedVoice(kind);
  const words=(v)=>String((v?.name||'')+' '+(v?.voiceURI||'')+' '+(v?.lang||'')).toLowerCase();
  let best=null, bestScore=-999;
  for(const v of voices){
    const full=words(v); let score=voiceQualityScore(v);
    if(profile.gender==='female' && /female|woman|samantha|karen|moira|aria|jenny|ava|emma|amy|victoria|allison|susan/i.test(full)) score+=22;
    if(profile.gender==='male' && /male|man|daniel|alex|guy|brian|rishi|fred|tom|aaron/i.test(full)) score+=22;
    if(profile.age==='older' && /daniel|alex|fred|susan|karen|moira/i.test(full)) score+=6;
    if(profile.age==='young' && /ava|jenny|emma|aria|victoria|allison/i.test(full)) score+=6;
    if(profile.voiceStyle==='solemn') score += /daniel|alex|samantha|moira/i.test(full)?6:0;
    if(profile.voiceStyle==='frightened') score += /samantha|ava|emma|jenny/i.test(full)?5:0;
    if(profile.voiceStyle==='authoritative') score += /alex|daniel|guy|brian|samantha/i.test(full)?8:0;
    if(score>bestScore){ bestScore=score; best=v; }
  }
  return best || selectedVoice(kind);
}
function speakTextForSpeaker(text, kind='dialogue', speaker=null){
  if(!state?.voiceSettings?.enabled || !('speechSynthesis' in window)) return;
  const chunks=splitSpeechChunks(text).filter(Boolean); if(!chunks.length) return;
  const profile=speakerProfile(speaker); const v=selectedVoiceForSpeaker(speaker, kind);
  const baseRate=clamp((state.voiceSettings.rate ?? 0.92) * (profile?.rate || 1), .65, 1.35);
  const basePitch=clamp((state.voiceSettings.pitch ?? 0.94) * (profile?.pitch || 1), .65, 1.35);
  const volume=clamp(state.voiceSettings.volume ?? 1,0,1);
  try{ window.speechSynthesis.cancel(); }catch(e){}
  chunks.forEach(chunk=>{ const utter=new SpeechSynthesisUtterance(chunk); if(v) utter.voice=v; utter.rate=baseRate; utter.pitch=basePitch; utter.volume=volume; try{ window.speechSynthesis.speak(utter); }catch(e){} });
}
function ttsEnabledFor(entry){
  if(!state?.voiceSettings?.enabled) return false;
  if(!('speechSynthesis' in window)) return false;
  const meta = String(entry.meta||'');
  if(state.voiceSettings.npc && (meta==='NPC Voice' || meta==='Witness' || meta==='Stranger Lead')) return true;
  if(state.voiceSettings.transmissions && (meta==='Auto Game Warden' || meta==='Field Transmission' || meta==='Creature Turn')) return true;
  return false;
}
function splitSpeechChunks(text){
  const raw=cleanSpeechText(text); if(raw.length<=260) return [raw];
  const parts=raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[raw]; const chunks=[]; let cur='';
  for(const part of parts){ if((cur+' '+part).trim().length>360){ if(cur) chunks.push(cur.trim()); cur=part; } else cur=(cur+' '+part).trim(); }
  if(cur) chunks.push(cur.trim()); return chunks.slice(0,5);
}
function speakText(text, kind='transmission'){
  if(!state?.voiceSettings?.enabled || !('speechSynthesis' in window)) return;
  const chunks=splitSpeechChunks(text).filter(Boolean); if(!chunks.length) return;
  const v = selectedVoice(kind);
  const baseRate = clamp(state.voiceSettings.rate ?? 0.92, .65, 1.35);
  const basePitch = clamp(state.voiceSettings.pitch ?? 0.94, .65, 1.35);
  const volume = clamp(state.voiceSettings.volume ?? 1, 0, 1);
  try { window.speechSynthesis.cancel(); } catch(e){}
  chunks.forEach((chunk,idx)=>{
    const utter = new SpeechSynthesisUtterance(chunk);
    if(v) utter.voice = v;
    utter.rate = /npc|witness|stranger|dialogue/i.test(kind||'') ? clamp(baseRate+.03,.65,1.35) : baseRate;
    utter.pitch = /npc|witness|stranger|dialogue/i.test(kind||'') ? clamp(basePitch+.07,.65,1.35) : basePitch;
    utter.volume = volume;
    try { window.speechSynthesis.speak(utter); } catch(e){}
  });
}
function stopSpeech(){ try { if(window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){} }
function maybeSpeakLog(entry){ if(!ttsEnabledFor(entry)) return; const speaker = entry.speakerId ? findAnyNPCByIdOrName(entry.speakerId) : findAnyNPCByIdOrName(String(entry.text||'').split(':')[0]); if(speaker && /NPC|Witness|Stranger|dialogue/i.test(entry.meta||'')) speakTextForSpeaker(entry.text, entry.meta, speaker); else speakText(entry.text, entry.meta); }
function populateVoices(){
  const sel=$('ttsVoiceSelect'); if(!sel) return;
  const voices=sortedVoices(); const prior=state?.voiceSettings?.voiceURI || sel.value;
  const best=voices[0];
  sel.innerHTML = '<option value="">Auto Best Natural Voice</option>' + voices.map(v=>`<option value="${escapeAttr(v.voiceURI)}">${escapeHtml(v.name)} — ${escapeHtml(v.lang)}${voiceQualityScore(v)>55?' ★':''}</option>`).join('');
  if(prior) sel.value=prior;
  if($('ttsBestVoiceHint')) $('ttsBestVoiceHint').textContent = best ? `Best detected voice: ${best.name} (${best.lang}). Score ${voiceQualityScore(best)}.` : 'No voices detected yet. Open the voice menu or tap Test Voice after the page loads.';
}

function log(text, type='system', scope='public', player='party', meta='Auto-GM', speakerId=null){
  const entry = {id:uid('msg'), time:now(), text:String(text), type, scope, player, meta, speakerId};
  if(scope === 'private') { state.privateLogs[player] = state.privateLogs[player] || []; state.privateLogs[player].push(entry); }
  else state.publicLog.push(entry);
  save(); render(); maybeSpeakLog(entry); return entry;
}

function smallTalk(text, scope='public', player='party', meta='Small Talk'){
  const entry = {id:uid('chat'), time:now(), text:String(text), type:'smalltalk', scope, player, meta};
  // Deliberately not saved: chatter with strangers that reveals no clue stays transient.
  ephemeralLog.push(entry); if(ephemeralLog.length>30) ephemeralLog.shift(); render(); const speaker=findAnyNPCByIdOrName(String(text||'').split(':')[0]); if(state?.voiceSettings?.enabled && state?.voiceSettings?.npc && speaker) speakTextForSpeaker(text, meta||'Small Talk', speaker); return entry;
}
function noteRelationship(npcId, delta=1){ state.relationshipMemory[npcId] = (state.relationshipMemory[npcId]||0) + delta; }
function pressureLevel(){ const p=state.pressure; if(p<=0)return 'quiet'; if(p<=3)return 'low'; if(p<=6)return 'moderate'; if(p<=9)return 'high'; return 'crisis'; }
function adjustPressure(n, why=''){ const before=state.pressure; state.pressure = clamp(state.pressure + n, 0, 12); log(`Pressure ${n>=0?'+':''}${n}${why?`: ${why}`:''}`, 'system'); if(before<7 && state.pressure>=7) log('The hunt crosses into high pressure. The creature becomes more willing to stalk, isolate, or attack.', 'system'); if(before<10 && state.pressure>=10) log('CRISIS: the case is now actively hunting back. Combat, manifestation, or ritual breakthrough is imminent.', 'system'); }
function addPlayer(name){ name = String(name||'').trim(); if(!name) return; if(!state.players.includes(name)) state.players.push(name); state.privateLogs[name]=state.privateLogs[name]||[]; state.privateClues[name]=state.privateClues[name]||[]; save(); render(); }

function itemName(id){ return byId(LIB.item_catalog,id)?.name || byId(LIB.material_catalog,id)?.name || byId(LIB.trap_recipes,id)?.name || byId(LIB.spell_catalog,id)?.name || byId(LIB.attack_options,id)?.name || id; }
function itemCost(id){ return Number((byId(LIB.item_catalog,id)||byId(LIB.material_catalog,id)||{}).cost || 10); }
function addInventory(id, qty=1){ state.inventory[id] = (state.inventory[id]||0) + qty; }
function removeInventory(id, qty=1){ if((state.inventory[id]||0)<qty) return false; state.inventory[id]-=qty; if(state.inventory[id]<=0) delete state.inventory[id]; return true; }
function hasInventory(reqs){ return Object.entries(reqs||{}).every(([id,qty]) => (state.inventory[id]||0) >= qty); }
function reqText(reqs){ const rows = Object.entries(reqs||{}).map(([id,qty]) => `${qty}× ${itemName(id)}`); return rows.length ? rows.join(', ') : 'no listed components'; }
function giveStarterKit(entity){
  ['salt_pack','iron_nails','flashlight','chalk','emf_reader','first_aid_kit'].forEach(id=>addInventory(id,1));
  if((entity?.tags||[]).includes('demon')) addInventory('holy_water',1);
  if((entity?.tags||[]).includes('spirit')) addInventory('rock_salt_shells',2);
  if((entity?.tags||[]).includes('fae')) addInventory('cold_iron_chain',1);
  if((entity?.tags||[]).includes('creature')) addInventory('silver_rounds',2);
}
function currentSceneStock(){
  const loc = byId(state.graph.locations,state.currentLocation)||{};
  const tags = [...(loc.tags||[]), ...(state.graph.entity?.tags||[])];
  const base = ['salt_pack','iron_nails','flashlight','emf_reader','chalk','rope','first_aid_kit'];
  const more = [];
  (LIB.item_catalog||[]).forEach(x => { if(hasAny(x.tags,tags)) more.push(x.id); });
  (LIB.material_catalog||[]).forEach(x => { if(hasAny(x.tags,tags)) more.push(x.id); });
  return [...new Set([...base,...more])];
}
function findCatalog(query, pools=['item','material','trap','spell','attack']){
  const q = norm(query); if(!q) return null;
  const arr = [];
  if(pools.includes('item')) arr.push(...(LIB.item_catalog||[]).map(x=>({...x,_type:'item'})));
  if(pools.includes('material')) arr.push(...(LIB.material_catalog||[]).map(x=>({...x,_type:'material'})));
  if(pools.includes('trap')) arr.push(...(LIB.trap_recipes||[]).map(x=>({...x,_type:'trap'})));
  if(pools.includes('spell')) arr.push(...(LIB.spell_catalog||[]).map(x=>({...x,_type:'spell'})));
  if(pools.includes('attack')) arr.push(...(LIB.attack_options||[]).map(x=>({...x,_type:'attack'})));
  let best=null, score=0;
  for(const x of arr){
    const names=[x.id,x.name,...(x.aliases||[])].map(norm); let s=0;
    for(const name of names){ if(name===q)s+=10; else if(name.includes(q)||q.includes(name))s+=6; else for(const part of q.split(' ')) if(part.length>2 && name.includes(part)) s++; }
    if(s>score){ score=s; best=x; }
  }
  return best;
}

function scoreModule(tags, m){ return ((m.tags||[]).filter(t=>tags.includes(t)).length) + (hasAny(m.tags,tags)?1:0); }
function buildSuspects(witnesses, entity){
  const list = (witnesses||[]).slice(0,5).map((w,i)=>({id:w.id,name:w.name,status:i===0?'person of interest':'unverified',motive:'unknown',notes:w.opening||''}));
  list.push({id:'unknown_entity', name:'Unknown Supernatural Actor', status:'hidden threat', motive:entity?.behavior||'active supernatural pressure', notes:`Likely signs: ${(entity?.signs||[]).slice(0,3).join(', ')}`});
  return list;
}

function rollAvailableWardens(tags=[], hqs=[]){
  const pool = LIB.warden_recruit_pool || [];
  const chanceBase = 0.42 + Math.min(0.28, (hqs||[]).length * 0.08);
  let available = pool.filter(w=>{
    const tagBonus = ((w.tags||[]).filter(t=>tags.includes(t)).length) * 0.08;
    const roll = Math.random();
    return roll < (w.availabilityChance ?? chanceBase) + tagBonus;
  });
  if(available.length<2) available = available.concat(sample(pool.filter(w=>!available.some(a=>a.id===w.id)), 2-available.length));
  return sample(dedupe(available), Math.min(5, Math.max(2, available.length))).map(w=>({...w,_type:'warden', location_hint:(pick(hqs)||{}).id || 'regional_warden_hq'}));
}
function assignCaseProfiles(){
  const pools=[...(state.graph.witnesses||[]),...(state.graph.allies||[]),...(state.graph.strangers||[]),...(state.graph.wardenAvailable||[])];
  pools.forEach((n,i)=>{
    n.profile=n.profile||{}; n.voiceProfile=n.voiceProfile||{}; n.dialogue_options=n.dialogue_options||{};
    const tags=n.tags||[];
    n.profile.archetype=n.profile.archetype||n.type||n._type||'civilian';
    n.profile.intelligence=n.profile.intelligence||n.intelligence||n.intellect|| (tags.includes('warden')?4:tags.includes('records')||tags.includes('occult')?4:2);
    n.profile.motive=n.profile.motive|| (tags.includes('warden')?'complete the hunt without civilian exposure':tags.includes('victim')?'survive and keep family safe':tags.includes('police')?'protect the town and career':'avoid trouble');
    n.profile.secret=n.profile.secret|| pick(['knows more than they first admit','is afraid of being named','saw something impossible','has a personal stake in the case']);
    n.voiceProfile.style=n.voiceProfile.style|| (tags.includes('warden')?'authoritative':tags.includes('priest')?'solemn':tags.includes('police')?'guarded':n.fear>=4?'frightened':'ordinary');
    n.voiceProfile.gender=n.voiceProfile.gender||(['female','male','any'][i%3]);
    n.voiceProfile.age=n.voiceProfile.age||(['adult','older','young'][i%3]);
    n.voiceProfile.rate=n.voiceProfile.rate || (n.voiceProfile.style==='frightened'?1.06:n.voiceProfile.style==='solemn'?0.9:1);
    n.voiceProfile.pitch=n.voiceProfile.pitch || (n.voiceProfile.gender==='female'?1.05:n.voiceProfile.gender==='male'?0.92:1);
    n.dialogue_options.background=n.dialogue_options.background||`Ask about ${n.name}'s role, motive, and what they noticed before the case escalated.`;
    n.dialogue_options.trust=n.dialogue_options.trust||'Ask what would make them trust the Wardens enough to cooperate.';
    n.dialogue_options.fear=n.dialogue_options.fear||'Ask what they are most afraid will happen if they speak openly.';
    n.dialogue_options.help=n.dialogue_options.help||'Ask what help, access, gear, or local knowledge they can provide.';
  });
  const ent=state.graph.entity; if(ent){
    ent.profile=ent.profile||{}; ent.profile.intelligence=ent.profile.intelligence || ((ent.tags||[]).includes('demon')||String(ent.type).match(/fae|djinn|vampire/i)?4:2);
    ent.profile.motive = ent.profile.motive || ent.behavior || ((ent.tags||[]).includes('spirit') ? 'resolve or repeat its anchor trauma' : 'feed, hide, spread pressure, or defend its anchor');
    ent.dialogue_options=ent.dialogue_options||{};
    ent.dialogue_options.observe=ent.dialogue_options.observe||'Observe its posture, hunting pattern, target choice, and reaction to wards or known materials.';
    ent.dialogue_options.taunt=ent.dialogue_options.taunt||'Provoke it to reveal aggression, pride, hunger, or control limits.';
    ent.dialogue_options.parley=ent.dialogue_options.parley||'Attempt conversation only if contained, warded, or emotionally anchored.';
    ent.dialogue_options.warning=ent.dialogue_options.warning||'The Auto-GM may answer as atmosphere or threat, but hidden weaknesses stay locked until discovered.';
  }
}


function currentSyncOnlinePlayers(){
  try { return window.NWAutoGMSync?.getOnlinePlayers?.() || []; } catch(e){ return []; }
}
function playerDisplayName(p){ return p?.name || p?.displayName || p?.playerName || p?.id || String(p||'Unknown'); }
function requiredReadyPlayers(){
  const online = currentSyncOnlinePlayers().map(playerDisplayName).filter(Boolean);
  const uniqueOnline = [...new Set(online)];
  if(state.mode==='shared' && uniqueOnline.length > 1) return uniqueOnline;
  if(state.mode==='shared' && state.readySettings?.simulateLocalReady) return [...new Set(state.players||[])];
  return [];
}
function shouldRequireReady(){ return requiredReadyPlayers().length > 1; }
function readyVoteActive(){ return !!(state.caseDrawVote && state.caseDrawVote.status === 'pending'); }
function readyVoteReadyList(){ return state.caseDrawVote?.ready || {}; }
function readyVoteMissing(){
  const req = requiredReadyPlayers(); const ready = readyVoteReadyList();
  return req.filter(p => !ready[p]);
}
function renderReadyPanel(){
  const panel = $('readyPanel'); if(!panel) return;
  const req = requiredReadyPlayers(); const vote = state.caseDrawVote;
  const online = currentSyncOnlinePlayers();
  const sync = window.NWAutoGMSync?.status?.() || {enabled:false,status:'Local only'};
  const rows = req.length ? req.map(p=>`<div class="item small"><b>${escapeHtml(p)}</b> ${vote?.ready?.[p]?'<span class="pill good">ready</span>':'<span class="pill warn">waiting</span>'}</div>`).join('') : '<div class="item small">Ready-up activates when Shared Campaign mode has more than one synced/connected real player. Use the local simulation checkbox to test it with the manual player list.</div>';
  panel.innerHTML = `<h3>Shared Case Draw Ready-Up</h3><div class="note small">When multiple real players are connected to this Auto-GM campaign, drawing a new case starts a ready check. Once everyone readies, the same generated case is saved and pushed to all attached players.</div><div class="item small"><b>Sync:</b> ${escapeHtml(sync.status||'local')} · <b>Online detected:</b> ${online.length||0}</div><label class="small" style="display:block;margin:8px 0"><input id="simulateReadyToggle" type="checkbox" style="width:auto" ${state.readySettings?.simulateLocalReady?'checked':''}> Test ready-up using local player list</label>${vote?`<div class="item"><b>Pending Draw:</b> ${escapeHtml(vote.id)}<br><span class="small">Requested by ${escapeHtml(vote.requestedBy||'unknown')} at ${escapeHtml(vote.createdAt||'')}</span></div>`:''}<div class="list">${rows}</div><div class="row" style="margin-top:8px"><button class="btn good quick" data-cmd="ready">Ready</button><button class="btn ghost quick" data-cmd="unready">Unready</button><button class="btn ghost quick" data-cmd="ready status">Ready Status</button><button class="btn warn quick" data-cmd="cancel draw">Cancel Draw</button><button class="btn bad quick" data-cmd="force draw">Force Draw</button></div>`;
  const chk = $('simulateReadyToggle'); if(chk) chk.onchange = e => { state.readySettings=state.readySettings||{}; state.readySettings.simulateLocalReady=!!e.target.checked; save(); renderReadyPanel(); };
}
function requestNewCaseDraw(actor){
  if(!shouldRequireReady()){
    log('Starting new modular case immediately. Ready-up was not required because only one real/synced player is connected.', 'system', 'public', actor||state.activePlayer, 'Ready');
    return buildCaseFromApprovedDraw('single-player');
  }
  const req = requiredReadyPlayers();
  state.caseDrawVote = { id: uid('draw'), status:'pending', requestedBy: actor||state.activePlayer||'party', createdAt: now(), requiredPlayers:req, ready:{}, syncedAt: Date.now() };
  const requester = state.caseDrawVote.requestedBy;
  if(req.includes(requester)) state.caseDrawVote.ready[requester] = true;
  log(`New case draw requested by ${requester}. Ready-up required from: ${req.join(', ')}. Type “ready” when prepared.`, 'system', 'public', requester, 'Ready');
  save(); render();
}
function setReadyForActor(actor, isReady=true){
  actor = actor || state.activePlayer || 'Player';
  if(!readyVoteActive()) return log('No case draw ready-up is pending. Press New Modular Case first.', 'system', 'public', actor, 'Ready');
  const req = requiredReadyPlayers();
  if(req.length && !req.includes(actor)) req.push(actor);
  state.caseDrawVote.requiredPlayers = req;
  if(isReady) state.caseDrawVote.ready[actor] = true; else delete state.caseDrawVote.ready[actor];
  const missing = readyVoteMissing();
  log(`${actor} is ${isReady?'READY':'not ready'}. ${missing.length?`Waiting on: ${missing.join(', ')}`:'Everyone is ready. Drawing the new case now.'}`, 'system', 'public', actor, 'Ready');
  if(!missing.length) buildCaseFromApprovedDraw(state.caseDrawVote.id);
  else { save(); render(); }
}
function cancelReadyDraw(actor){
  if(!state.caseDrawVote) return log('There is no pending ready-up to cancel.', 'system', 'public', actor||state.activePlayer, 'Ready');
  log(`Case draw ready-up cancelled by ${actor||state.activePlayer||'party'}.`, 'system', 'public', actor||state.activePlayer, 'Ready');
  state.caseDrawVote = null; save(); render();
}
function readyStatus(actor){
  const req = requiredReadyPlayers(); const vote = state.caseDrawVote;
  if(!vote) return log(`No pending draw. Connected/required players: ${req.length?req.join(', '):'single-player/local only'}.`, 'system', 'public', actor||state.activePlayer, 'Ready');
  const missing = readyVoteMissing();
  log(`Ready status for ${vote.id}:\n${req.map(p=>`• ${p}: ${vote.ready?.[p]?'READY':'waiting'}`).join('\n')}\n${missing.length?`Waiting on: ${missing.join(', ')}`:'All ready.'}`, 'system', 'public', actor||state.activePlayer, 'Ready');
}
function buildCaseFromApprovedDraw(source){
  const oldVote = state.caseDrawVote;
  if(oldVote) oldVote.status = 'drawing';
  buildCase({source, previousVote: oldVote});
  state.caseDrawVote = null;
  state.syncInfo = Object.assign({}, state.syncInfo||{}, {lastCaseDrawAt: Date.now(), lastCaseDrawSource: source});
  save(); render();
  try{ window.NWAutoGMSync?.publishState?.(state, {force:true}); }catch(e){}
}

function buildCase(drawMeta={}){
  const theme = pick(LIB.campaign_themes);
  const suitId = pick(Object.keys(LIB.tarot.minor_suits));
  const suit = LIB.tarot.minor_suits[suitId];
  const value = pick(LIB.tarot.values);
  const major = pick(LIB.tarot.majors);
  const style = $('seedStyle')?.value || state.seedStyle || 'balanced';
  const styleTags = {horror:['blood','fear','spirit'], investigation:['witness','records','blood'], combat:['blades','creature','predator'], ritual:['sigils','ritual','demon'], balanced:[]}[style] || [];
  const tags = [...new Set([...(theme.tags||[]), suitId, suit.domain, ...(suit.entity_tags||[]), ...styleTags])];
  const top = (arr,n) => sample([...arr].sort((a,b)=>scoreModule(tags,b)-scoreModule(tags,a)).slice(0,Math.max(n*3,12)), n);
  const locs = top(LIB.location_modules, 6);
  const witnesses = top(LIB.witness_modules, 5);
  const evidence = top(LIB.evidence_modules, 7);
  const entity = top(LIB.entity_modules,1)[0] || pick(LIB.entity_modules);
  const signs = dedupe(top(LIB.sign_modules.filter(s=>hasAny(s.tags,entity.tags||tags)).concat(LIB.sign_modules), 8));
  const prep = dedupe(top(LIB.prep_modules.filter(p=>hasAny(p.tags,entity.tags||tags)).concat(LIB.prep_modules), 6));
  const complications = top(LIB.complication_modules, 5);
  const allies = dedupe(top((LIB.npc_ally_modules||[]).filter(a=>hasAny(a.tags,tags)).concat(LIB.npc_ally_modules||[]), 4));
  const strangers = dedupe(top((LIB.stranger_modules||[]).filter(s=>hasAny(s.tags,tags)).concat(LIB.stranger_modules||[]), 4));
  const wardenHqs = dedupe(top((LIB.warden_hq_modules||[]).filter(h=>hasAny(h.tags,tags)).concat(LIB.warden_hq_modules||[]), 2));
  const wardenAvailable = rollAvailableWardens(tags, wardenHqs);
  state.graph = {theme, tarot:{major,suitId,suit,value,orientation:Math.random()<0.25?'reversed':'upright'}, locations:locs, witnesses, evidence, entity, signs, prep, complications, allies, strangers, wardenHqs, wardenAvailable};
  assignCaseProfiles();
  state.caseTitle = `${value} of ${suit.name}: ${entity.name}`;
  state.phase='investigation'; state.pressure=1; state.clues=[]; state.leads=[]; state.flags={}; state.preps=[]; state.inventory={}; state.craftedTraps=[]; state.hiddenActors={}; state.credits=120;
  state.privateLogs={}; state.privateClues={}; state.players.forEach(p=>{state.privateLogs[p]=[]; state.privateClues[p]=[];});
  state.allies=[]; state.relationshipMemory={}; state.discoveredNPCs=[];
  state.suspects = buildSuspects(witnesses, entity);
  state.actionClock = {location:null, actionsHere:0, totalActions:0, minorDraws:[]};
  state.combat = defaultCombat();
  giveStarterKit(entity);
  state.currentLocation = locs[0]?.id || null;
  state.unlockedLocations = state.currentLocation ? [state.currentLocation] : [];
  state.unlockedTopics = {};
  log(`New modular case drawn: ${state.caseTitle}. Major pressure: ${major.name} (${state.graph.tarot.orientation}). ${state.graph.tarot.orientation==='reversed'?major.reversed:major.upright}`, 'system');
  log(`${suit.opening} Theme: ${theme.name}. Starting kit loaded. Type “look”, “list witnesses”, “shop”, or “inventory”.`, 'system');
  save(); render();
  if(state.voiceSettings?.autoOpener) setTimeout(()=>generateOpeningTransmission(true), 60);
}

function findNode(query, types=['location','witness','evidence','prep','entity']){
  const q=norm(query); if(!q) return null;
  const pools=[];
  if(types.includes('location')) pools.push(...state.graph.locations.map(x=>({...x,_type:'location'})));
  if(types.includes('witness')) pools.push(...state.graph.witnesses.map(x=>({...x,_type:'witness'})));
  if(types.includes('ally')) pools.push(...(state.graph.allies||[]).map(x=>({...x,_type:'ally'})));
  if(types.includes('stranger')) pools.push(...(state.graph.strangers||[]).map(x=>({...x,_type:'stranger'})));
  if(types.includes('warden')) pools.push(...(state.graph.wardenAvailable||[]).map(x=>({...x,_type:'warden'})));
  if(types.includes('hq')) pools.push(...(state.graph.wardenHqs||[]).map(x=>({...x,_type:'hq'})));
  if(types.includes('evidence')) pools.push(...state.graph.evidence.map(x=>({...x,_type:'evidence'})));
  if(types.includes('prep')) pools.push(...state.graph.prep.map(x=>({...x,_type:'prep'})));
  if(types.includes('entity') && state.graph.entity) pools.push({...state.graph.entity,_type:'entity'});
  let best=null, score=0;
  for(const n of pools){
    const names=[n.name,n.id,...(n.aliases||[])].map(norm); let s=0;
    for(const name of names){ if(name===q)s+=10; else if(name.includes(q)||q.includes(name))s+=6; else for(const part of q.split(' ')) if(part.length>2 && name.includes(part)) s++; }
    if(s>score){ score=s; best=n; }
  }
  return best;
}
function findTopic(node,topic){
  const q=norm(topic); if(!q || !node?.topics) return null;
  let best=null, score=0;
  for(const key of Object.keys(node.topics)){ const k=norm(key); let s=0; if(k===q)s=10; else if(k.includes(q)||q.includes(k))s=6; else for(const part of q.split(' ')) if(part.length>2&&k.includes(part))s++; if(s>score){score=s; best=key;} }
  return best;
}
function knows(clueId, player){ if(state.clues.some(c=>c.id===clueId)) return true; return !!(state.privateClues[player]||[]).some(c=>c.id===clueId); }
function meets(reqs, player){ if(!reqs || reqs.length===0) return true; return reqs.some(r=>knows(r,player)||state.unlockedLocations.includes(r)||state.flags[r]); }
function addClue(id, scope='public', player='party', source=''){
  if(!id) return false; const text = LIB.clue_definitions[id] || id;
  const target = scope==='private' ? (state.privateClues[player]=state.privateClues[player]||[]) : state.clues;
  if(target.some(c=>c.id===id)) return false;
  target.push({id,text,source,time:now(),revealed:scope!=='private'});
  log(`${scope==='private'?'Private clue':'Clue'} added: ${text}`, 'clue', scope, player, source||'Discovery'); return true;
}
function addLeads(leads, source=''){
  (leads||[]).filter(Boolean).forEach(l=>{ const text=String(l); if(!state.leads.some(x=>x.text===text)) state.leads.push({id:uid('lead'),text,source,time:now()}); });
}
function unlockLocation(id, reason=''){
  if(!id || state.unlockedLocations.includes(id)) return false;
  state.unlockedLocations.push(id);
  const loc = byId(LIB.location_modules,id) || byId(state.graph.locations,id);
  if(loc) log(`New location unlocked: ${loc.name}${reason?` — ${reason}`:''}`,'system');
  return true;
}


function npcAvailableHere(npc){ return !npc.location_hint || npc.location_hint===state.currentLocation || state.unlockedLocations.includes(npc.location_hint); }
function allNPCs(){ return [...(state.graph.witnesses||[]).map(x=>({...x,_type:'witness'})), ...(state.graph.allies||[]).map(x=>({...x,_type:'ally'})), ...(state.graph.strangers||[]).map(x=>({...x,_type:'stranger'})), ...(state.graph.wardenAvailable||[]).map(x=>({...x,_type:'warden'}))]; }
function findNPC(query){ return findNode(query, ['witness','ally','stranger']) || allNPCs().find(n=>npcAvailableHere(n)); }
function allySupportFor(prof, action){
  let score=0; const intent=action?.intent||''; const loc=state.currentLocation;
  for(const a of state.allies||[]){
    const mod=(a.bonuses&& (a.bonuses[intent]||a.bonuses[prof?.skill]||a.bonuses[prof?.attribute])) || 0;
    const same=!a.location_hint || a.location_hint===loc || a.remote;
    if(same && mod) score += Number(mod)||0;
  }
  return Math.min(2,score);
}
function recruited(id){ return (state.allies||[]).some(a=>a.id===id); }

function npcProfile(npc){
  npc = npc || {};
  const tags = npc.tags || [];
  const role = npc.role || npc.type || (tags.includes('priest')?'priest':tags.includes('police')?'official':tags.includes('records')?'clerk':tags.includes('occult')?'occult contact':npc._type||'civilian');
  let intelligence = Number(npc.intelligence || npc.intellect || 2);
  if(tags.includes('records')||tags.includes('occult')||tags.includes('research')) intelligence += 1;
  if(tags.includes('police')||tags.includes('hunter')||tags.includes('warden')) intelligence += 1;
  intelligence = clamp(intelligence,1,5);
  const fear = Number(npc.fear || (tags.includes('victim')?4:tags.includes('priest')?2:2));
  const trust = (state.relationshipMemory && state.relationshipMemory[npc.id]) || Number(npc.trust||0);
  const demeanor = npc.demeanor || (fear>=4?'frightened':trust>=2?'cooperative':tags.includes('police')?'guarded':tags.includes('priest')?'solemn':'ordinary');
  return {role,intelligence,fear,trust,demeanor,tags};
}
function canonicalClueText(ids){ return (ids||[]).map(id=>LIB.clue_definitions[id]||id).filter(Boolean).join(' | '); }
function npcFallbackLine(npc, topicKey, response, clueText, rr){
  const p=npcProfile(npc); const name=npc?.name || 'The witness';
  const base = response || clueText || 'I do not know enough to make that certain.';
  if(p.intelligence>=4 && p.role.match(/priest|official|records|occult|hunter|warden|clerk/i)) return `${name} lowers their voice. “${base} That is not gossip — that is a pattern. If you follow it, verify it before you confront anything.”`;
  if(p.fear>=4) return `${name} keeps checking the exits. “${base} Please do not write my name down. If it knows I talked, it comes back.”`;
  if(p.demeanor==='guarded') return `${name} answers carefully. “${base} That is all I can safely say unless you bring me proof.”`;
  if(rr && !rr.success) return `${name} gives the answer in fragments. “${base} I might be wrong. I do not want to be involved.”`;
  return `${name} says, “${base}”`;
}
function npcMemoryKey(npc, topicKey){ return `${npc?.id||'npc'}::${topicKey||'general'}`; }
function rememberNpcDialogue(npc, topicKey, line, clueIds){ const key=npcMemoryKey(npc,topicKey); state.npcDialogueMemory[key] = state.npcDialogueMemory[key] || []; state.npcDialogueMemory[key].push({time:now(), line, clueIds:clueIds||[]}); if(state.npcDialogueMemory[key].length>6) state.npcDialogueMemory[key].shift(); }
function maybeLLMVoiceNpc(npc, topicKey, canonicalResponse, clueIds, action, rr){
  const clueText = canonicalClueText(clueIds); const fallback = npcFallbackLine(npc, topicKey, canonicalResponse, clueText, rr);
  rememberNpcDialogue(npc, topicKey, fallback, clueIds);
  const ready = window.NWLLMAdapter && window.NWLLMAdapter.isReady && window.NWLLMAdapter.isReady();
  if(ready && $('npcVoiceLLM') && $('npcVoiceLLM').checked){
    const payload = {npc:npcProfile(npc), npcName:npc.name, topic:topicKey, canonicalResponse, actualClueText:clueText, rollTier:rr?.tier, discoveredClueIds:clueIds||[], player:action.actor, recentDialogue:state.npcDialogueMemory[npcMemoryKey(npc,topicKey)]||[]};
    window.NWLLMAdapter.npcLine(payload, caseContext(), LIB.assistant_prompts||{}, {model:$('llmModelSelect')?.value, max_tokens:140, temperature:0.62})
      .then(line=>{ if(line){ log(`${npc.name}: ${line}`, 'dialogue', action.privacy, action.actor, 'NPC Voice'); rememberNpcDialogue(npc, topicKey, line, clueIds); render(); } })
      .catch(()=>{});
  }
  return fallback;
}
function allyServiceText(ally){ return (ally.services||[]).join(', ') || Object.keys(ally.bonuses||{}).join(', ') || 'field support'; }
function undiscoveredClueFromCase(){
  for(const e of state.graph.evidence||[]){ for(const id of e.clues||[]){ if(!state.clues.some(c=>c.id===id)) return {id, source:e.name}; } }
  for(const w of state.graph.witnesses||[]){ for(const [topic,def] of Object.entries(w.topics||{})){ for(const id of def.clues||[]){ if(!state.clues.some(c=>c.id===id)) return {id, source:`${w.name}: ${topic}`}; } } }
  return null;
}
function npcAllyFieldAction(triggerAction){
  if(state.combat?.active) return;
  const allies = state.allies || []; if(!allies.length) return;
  state.partyActionCounter = (state.partyActionCounter||0) + 1;
  if(state.partyActionCounter < 2) return;
  state.partyActionCounter = 0;
  const ally = pick(allies); if(!ally) return;
  const services = (ally.services||[]).join(' ').toLowerCase();
  let msg = `${ally.name} performs a support action.`;
  if(/records|research|archive|police|access/.test(services)){
    const clue = undiscoveredClueFromCase();
    if(clue && Math.random()<0.55){ addClue(clue.id,'public','party',`${ally.name} support: ${clue.source}`); msg = `${ally.name} cross-checks the case files and locks down a real clue from ${clue.source}.`; }
    else { const loc = pick((state.graph.locations||[]).filter(l=>!state.unlockedLocations.includes(l.id))); if(loc){ unlockLocation(loc.id,`${ally.name} checked records`); msg = `${ally.name} checks records and opens access to ${loc.name}.`; } else msg = `${ally.name} checks records but finds only confirmation of what the Wardens already know.`; }
  } else if(/medical|doctor|stabilize|treatment/.test(services)){
    const c=state.combat||{}; const hurt=Object.keys(c.playerStates||{}).find(p=>(c.playerStates[p].setbacks||0)>0);
    if(hurt){ c.playerStates[hurt].setbacks=Math.max(0,(c.playerStates[hurt].setbacks||0)-1); msg=`${ally.name} patches ${hurt} up enough to remove 1 combat setback.`; }
    else { adjustPressure(-1,`${ally.name} stabilizes the team`); msg=`${ally.name} keeps the team steady and reduces pressure by 1.`; }
  } else if(/occult|ward|exorcism|blessing|prayer|ritual/.test(services)){
    if(state.pressure>0) adjustPressure(-1,`${ally.name} reinforces wards`);
    const prep=pick(state.graph.prep||[]); if(prep && !state.preps.includes(prep.id)) state.preps.push(prep.id);
    msg = `${ally.name} reinforces occult protections${prep?` and helps prepare ${prep.name}`:''}.`;
  } else if(/trap|gear|quartermaster|supply|weapon/.test(services)){
    const stock=currentSceneStock(); const item=pick(stock); if(item){ addInventory(item,1); msg=`${ally.name} requisitions 1× ${itemName(item)} for the team.`; }
  } else {
    const sign=pick(state.graph.signs||[]); if(sign){ addLeads(sign.points_to||[],`${ally.name} watched the perimeter`); msg=`${ally.name} watches the perimeter and reports a sign: ${sign.surface||sign.name}.`; }
  }
  const entry={time:now(), ally:ally.name, text:msg, trigger:triggerAction?.text||''}; state.allyActionLog.push(entry); if(state.allyActionLog.length>30) state.allyActionLog.shift();
  log(`NPC Ally Action — ${msg}`, 'system', 'public', 'party', 'NPC Ally');
}
function npcCombatAlliesAct(){
  if(!state.combat?.active || !(state.allies||[]).length) return;
  const ent=state.graph.entity; const acted=state.combat.allyActedThisRound||[]; const available=(state.allies||[]).filter(a=>!acted.includes(a.id)); if(!available.length) return;
  for(const ally of available.slice(0,2)){
    const services=(ally.services||[]).join(' ').toLowerCase(); let msg='';
    if(/medical|stabilize|treatment/.test(services)){
      const hurt=Object.keys(state.combat.playerStates||{}).sort((a,b)=>(state.combat.playerStates[b].setbacks||0)-(state.combat.playerStates[a].setbacks||0))[0];
      if(hurt && (state.combat.playerStates[hurt].setbacks||0)>0){ state.combat.playerStates[hurt].setbacks=Math.max(0,state.combat.playerStates[hurt].setbacks-1); msg=`${ally.name} uses their combat action to stabilize ${hurt}, removing 1 setback.`; }
      else msg=`${ally.name} holds triage position and calls openings.`;
    } else if(/exorcism|occult|ward|prayer|ritual/.test(services)){
      const dmg = (ent?.tags||[]).some(t=>['demon','spirit','ritual','sigils'].includes(t)) ? 1 : 0;
      if(dmg) state.combat.entityHp=clamp(state.combat.entityHp-dmg,0,state.combat.entityMaxHp);
      msg=`${ally.name} uses their combat action to reinforce wards${dmg?`, dealing 1 confrontation progress to ${ent.name}`:''}.`;
    } else if(/trap|gear|weapon|hunter|supply/.test(services)){
      state.combat.entityHp=clamp(state.combat.entityHp-1,0,state.combat.entityMaxHp); msg=`${ally.name} uses their combat action to create an opening, dealing 1 confrontation progress to ${ent.name}.`;
    } else { msg=`${ally.name} uses their combat action to Assist, removing 1 setback from the next Warden combat roll.`; state.combat.allyAssistNext=(state.combat.allyAssistNext||0)+1; }
    acted.push(ally.id); combatLog(msg); log(`NPC Ally Combat — ${msg}`, 'system', 'public', 'party', 'NPC Ally');
  }
  state.combat.allyActedThisRound=acted;
}
function caseContext(){
  const loc=byId(state.graph.locations,state.currentLocation)||{};
  return {
    title:state.caseTitle, phase:state.phase, pressure:state.pressure, pressureLevel:pressureLevel(), location:loc.name,
    clues:(state.clues||[]).map(c=>c.text), leads:(state.leads||[]).slice(-10).map(l=>l.text),
    witnesses:(state.graph.witnesses||[]).map(w=>({name:w.name, topics:Object.keys(w.topics||{})})),
    allies:(state.allies||[]).map(a=>a.name), inventory:state.inventory,
    entityKnown:!!state.flags.weaknessRevealed, entity:state.flags.weaknessRevealed?state.graph.entity:null,
    pressureDraws:(state.actionClock?.minorDraws||[]).slice(-5)
  };
}

function visibleOpeningBrief(){
  const loc=byId(state.graph.locations,state.currentLocation)||{};
  const t=state.graph.tarot||{};
  return {
    title: state.caseTitle,
    theme: state.graph.theme?.name,
    tarot: {
      major: t.major?.name,
      majorPressure: t.orientation==='reversed' ? t.major?.reversed : t.major?.upright,
      minor: `${t.value||'?'} of ${t.suit?.name||'?'}`,
      suitOpening: t.suit?.opening,
      orientation: t.orientation
    },
    startingLocation: {name:loc.name, description:loc.description, tags:loc.tags||[]},
    visibleWitnesses: (state.graph.witnesses||[]).slice(0,3).map(w=>({name:w.name, opening:w.opening, location_hint:w.location_hint, demeanor:w.demeanor, fear:w.fear, trust:w.trust})),
    visibleEvidence: (state.graph.evidence||[]).slice(0,4).map(e=>({name:e.name, surface:e.surface, location_hint:e.location_hint})),
    visibleSigns: (state.graph.signs||[]).slice(0,3).map(s=>({name:s.name, surface:s.surface})),
    doNotReveal: ['true entity identity unless already discovered','weakness','anchor','kill condition','hidden clue layers','private witness secrets']
  };
}
function structuredOpeningTransmission(){
  const b=visibleOpeningBrief(); const w=(b.visibleWitnesses||[])[0]; const e=(b.visibleEvidence||[])[0]; const sgn=(b.visibleSigns||[])[0];
  const lines=[];
  lines.push(`FIELD TRANSMISSION — ${b.title}.`);
  lines.push(`The current draw is ${b.tarot.minor} under ${b.tarot.major}. ${b.tarot.suitOpening||'The case pressure is taking shape.'}`);
  lines.push(`Your first confirmed site is ${b.startingLocation.name||'an unknown scene'}: ${b.startingLocation.description||'the place has gone wrong in ways locals cannot explain.'}`);
  if(w) lines.push(`Initial contact: ${w.name}. ${w.opening||'They know something, but fear is controlling how much they say.'}`);
  if(e) lines.push(`Visible evidence: ${e.name}. ${e.surface||'It can be examined for more.'}`);
  if(sgn) lines.push(`Atmospheric sign: ${sgn.surface||sgn.name}.`);
  lines.push('Suggested first commands: look; list witnesses; investigate evidence; ask a witness about the most specific topic they mention.');
  return lines.join('\n\n');
}
async function generateOpeningTransmission(auto=false){
  let text=''; const model=$('llmModelSelect')?.value;
  try{
    if(state.voiceSettings?.llmOpener && window.NWLLMAdapter?.gameWardenOpener && window.NWLLMAdapter?.isReady?.()){
      if($('llmStatus')) $('llmStatus').textContent='Game Warden is crafting opening transmission...';
      text = await window.NWLLMAdapter.gameWardenOpener(visibleOpeningBrief(), caseContext(), LIB.assistant_prompts||{}, {model, max_tokens:520, temperature:.72});
    }
  }catch(e){ console.warn('LLM opener failed, using structured opener', e); }
  if(!text) text=structuredOpeningTransmission();
  log(text, 'transmission', 'public', 'party', 'Auto Game Warden');
  return text;
}

function structuredAssistant(prompt){
  const q=norm(prompt); const ctx=caseContext();
  if(q.includes('summarize')) return `Case: ${ctx.title}. Phase: ${ctx.phase}. Pressure ${ctx.pressure}/12 (${ctx.pressureLevel}). Current location: ${ctx.location||'unknown'}. Public clues: ${ctx.clues.length?ctx.clues.join('; '):'none yet'}. Active leads: ${ctx.leads.length?ctx.leads.join('; '):'none yet'}.`;
  if(q.includes('next')||q.includes('suggest')) return `Recommended next steps: ${suggestions().slice(0,8).join(' • ')}. If a witness gave a named topic, ask about that exact topic. If pressure is high, relocate, hide, or complete prep before attacking.`;
  if(q.includes('prep')||q.includes('checklist')){ const prep=(state.graph.prep||[]).map(p=>p.name).slice(0,6).join(', '); const traps=(LIB.trap_recipes||[]).filter(t=>hasAny(t.works_on||[],state.graph.entity?.tags||[])).map(t=>`${t.name}: ${reqText(t.requires)}`).join(' | '); return `Prep that fits this case: ${prep||'none identified'}. Useful trap/rite requirements: ${traps||'identify the entity further before choosing a trap.'}`; }
  if(q.includes('ask')||q.includes('witness')){ const w=(state.graph.witnesses||[]).find(w=>q.includes(norm(w.name))) || (state.graph.witnesses||[])[0]; return w?`For ${w.name}, known topics are: ${Object.keys(w.topics||{}).join(', ')}. Ask follow-ups exactly, for example: ask ${w.name} about ${Object.keys(w.topics||{})[0]||'the case'}.`:'No witness is active yet.'; }
  if(q.includes('combat')) return `Combat advice: do not use a blind attack unless pressure is already crisis. Check inventory, need the matching trap or attack, set trap, hide/wait if appropriate, then attack with the known weakness. Current combat: ${state.combat?.active?'active':'not engaged'}.`;
  if(q.includes('tarot')){ const t=state.graph.tarot||{}; return `Tarot pressure: ${t.value||'?'} of ${t.suit?.name||'?'} under ${t.major?.name||'unknown Major'} (${t.orientation||'upright'}). Minor draws so far: ${(state.actionClock?.minorDraws||[]).map(d=>`${d.value} of ${d.suit}${d.reversed?' reversed':''}`).join(', ')||'none'}.`; }
  return `Field Assistant understood: “${prompt}”. I can summarize case, suggest next steps, build a prep checklist, explain combat advice, interpret tarot pressure, or suggest witness follow-up topics.`;
}
async function runAssistant(prompt, scope='public', actor='party'){
  let answer='';
  const model = $('llmModelSelect') ? $('llmModelSelect').value : undefined;
  try{
    if(window.NWLLMAdapter && window.NWLLMAdapter.enabled && window.NWLLMAdapter.ask){
      if($('llmStatus')) $('llmStatus').textContent = 'Thinking with browser LLM...';
      answer = await window.NWLLMAdapter.ask(prompt, caseContext(), LIB.assistant_prompts||{}, { model });
    }
  }catch(e){
    console.warn('LLM assistant failed, using structured fallback', e);
    if($('llmStatus')) $('llmStatus').textContent = 'LLM unavailable. Structured assistant fallback used.';
    answer='';
  }
  if(!answer) answer = structuredAssistant(prompt);
  state.assistantHistory.push({time:now(), prompt, answer, actor}); if(state.assistantHistory.length>20) state.assistantHistory.shift();
  log(answer,'system',scope,actor,'Field Assistant');
  if($('assistantOutput')) $('assistantOutput').innerHTML = state.assistantHistory.slice().reverse().map(x=>`<div class="msg"><div class="meta">${escapeHtml(x.time)} · ${escapeHtml(x.actor)}</div><b>${escapeHtml(x.prompt)}</b><br>${escapeHtml(x.answer).replace(/\n/g,'<br>')}</div>`).join('');
}

function parseCommands(raw){
  return String(raw||'').split(';').map(s=>s.trim()).filter(Boolean).map(part=>{
    let privacy='public', actor=state.activePlayer||'party', text=part;
    let m = part.match(/^(private|public)\s+([^:]+):\s*(.+)$/i);
    if(m){ privacy=m[1].toLowerCase(); actor=m[2].trim(); text=m[3].trim(); }
    else { m=part.match(/^([^:]+):\s*(.+)$/); if(m){ actor=m[1].trim(); text=m[2].trim(); } }
    const n=norm(text);
    const intentMap=[
      ['look',['look','observe']], ['list',['list','show']], ['inventory',['inventory','gear','items']], ['shop',['shop','store','quartermaster']],
      ['notes',['notes','party notes','shared notes','case notes','note','add note','send note','post note']], ['commands',['commands','help','command list']], ['combat',['combat status','combat','status']], ['profile',['profile','inspect profile','character profile','who is']], ['dialogue',['dialogue','dialogue options','topics','talk options']], ['hq',['hq','warden hq','visit hq','search wardens','available wardens','go to hq','call hq','contact hq','radio hq','check hq','who is available','find wardens']], ['allies',['allies','list allies','npc allies','party allies']], ['assistant',['assistant','field assistant','warden assistant','ask assistant']], ['llm',['load llm','load browser llm','start llm','enable llm','use llm','structured fallback','disable llm']], ['voice',['voice on','voice off','tts on','tts off','npc voice on','npc voice off','test voice','stop voice','speak on','speak off']], ['opener',['opener','opening transmission','transmission','game warden']], ['recruit',['recruit','hire','ally','ask to join']], ['endturn',['end turn','end round','skip turn','take hit']], ['reaction',['dodge','brace','counter','protect']],
      ['buy',['buy','purchase','requisition']], ['needs',['need','needs','requirements','components']], ['hide',['hide','conceal','stakeout']],
      ['clues',['clues','case board']], ['leads',['leads','suggestions']], ['move',['go','move','travel','enter']],
      ['ask',['ask','talk','interview','question']], ['research',['research','study','decode','lookup','cross reference']],
      ['investigate',['investigate','examine','search','inspect','analyze']], ['prep',['prep','prepare','set up','ready','build','repair']],
      ['trap',['trap','lay trap','set trap','trigger trap','trigger']], ['cast',['cast','ritual','ward','bind','exorcise']], ['attack',['attack','shoot','stab','strike','fight','confront']],
      ['wait',['wait','listen']], ['reveal',['reveal','share']]
    ];
    let intent='unknown', verb='';
    for(const [k,verbs] of intentMap){ const found=verbs.find(v=>n.startsWith(v)); if(found){ intent=k; verb=found; break; } }
    let rest=n.replace(new RegExp('^'+verb.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*'),'').trim();
    let target=rest, topic='';
    const about=rest.match(/^(.+?)\s+(?:about|regarding|on)\s+(.+)$/);
    if(about){ target=about[1].replace(/^(to|with)\s+/,'').trim(); topic=about[2].trim(); }
    target=target.replace(/^(to|at|in|into|with|the|a|an)\s+/,'').trim();
    // Pass 17 unifies the side-panel tools with the main IF input.
    // Natural language aliases are intentionally resolved here so players can stay in the typed command box.
    if(intent==='ask'){
      const npcCandidate = findNPC(target) || findNode(target,['witness','ally','stranger','warden','entity']);
      if(npcCandidate && !topic && /^(talk|interview|question)$/.test(verb)) intent='dialogue';
      if(npcCandidate && !topic && /^(ask)$/.test(verb)) intent='dialogue';
    }
    if(intent==='move' && /(hq|warden hq|field office|safehouse|safe house)/.test(n)) intent='hq';
    if(intent==='profile' && /^who is available/.test(n)) intent='hq';
    if(intent==='unknown' && /^(available wardens|who is available|check hq|call hq|contact hq|radio hq|find wardens)/.test(n)) intent='hq';
    if(intent==='unknown' && /^(load|enable|start)\s+(browser\s+)?llm/.test(n)) intent='llm';
    if(intent==='unknown' && /^(voice|tts|speak|npc voice)/.test(n)) intent='voice';
    return {raw:part, privacy, actor, intent, verb, target, topic, text};
  });
}

function rollDice(mode){ const count=mode==='2d6'?2:3; const dice=Array.from({length:count},()=>1+Math.floor(Math.random()*6)); return {dice,total:dice.reduce((a,b)=>a+b,0)}; }
function findChar(name){ const n=norm(name); return state.characters.find(c=>norm(c.name||c.identity?.name||c.id||'')===n); }
function attrValue(ch, attr){ if(!ch) return 9; const a=ch.attributes||{}; const key=Object.keys(a).find(k=>norm(k)===norm(attr)); const v=key?a[key]:null; if(typeof v==='object') return Number(v.value||v.current||9); return Number(v||9); }
function skillRank(ch, skill){ if(!ch || !skill) return 0; const s=ch.skills||{}; if(Array.isArray(s)){ const f=s.find(x=>norm(x.name||x.skill)===norm(skill)); return f?Number(f.rank||f.value||1):0; } const key=Object.keys(s).find(k=>norm(k)===norm(skill)); const v=key?s[key]:0; return typeof v==='object'?Number(v.rank||v.value||1):Number(v||0); }
function profile(intent, target=''){
  if(['investigate','look'].includes(intent)) return {attribute:'Instinct', skill:'Investigation', support:['Awareness','Forensics'], setback:0};
  if(intent==='research') return {attribute:'Intellect', skill:'Research', support:['Occult Knowledge','Symbolism'], setback:0};
  if(intent==='ask') return {attribute:'Charisma', skill:'Persuasion', support:['Insight','Investigation'], setback:0};
  if(['prep','trap'].includes(intent)) return {attribute:'Intellect', skill:'Trap Setting', support:['Tinkering','Crafting'], setback:0};
  if(intent==='cast') return {attribute:'Will', skill:'Ritual Casting', support:['Occult Knowledge','Focus'], setback:1};
  if(intent==='hide') return {attribute:'Prowess', skill:'Stealth', support:['Awareness','Survival'], setback:0};
  if(intent==='move') return {attribute:'Prowess', skill:'Athletics', support:['Awareness','Survival'], setback:0};
  if(intent==='attack') return {attribute:/shoot|gun|round|shell|salt|silver/.test(target)?'Prowess':'Force', skill:/shoot|gun|round|shell|salt|silver/.test(target)?'Firearms':'Melee Combat', support:['Awareness','Weapon Handling'], setback:1};
  return {attribute:'Instinct', skill:'Awareness', support:['Investigation','Survival'], setback:0};
}
function resolveRoll(action, prof){
  if(!$('autoRoll')?.checked) return {rolled:false, success:true, tier:'narrative', margin:0};
  const ch=findChar(action.actor), r=rollDice(state.diceMode||'3d6');
  const attr=attrValue(ch,prof.attribute), primary=skillRank(ch,prof.skill);
  let supportOffset=0; for(const s of prof.support||[]) if(skillRank(ch,s)>0) supportOffset++;
  supportOffset=Math.min(2,supportOffset);
  const injury=(ch?.conditions||[]).reduce((a,c)=>a+Number(c.setbacks||0),0);
  const scene=Number(prof.setback||0)+Math.floor(state.pressure/4)+injury;
  const allyOffset=allySupportFor(prof, action) + ((state.combat&&state.combat.active&&state.combat.allyAssistNext)?state.combat.allyAssistNext:0);
  if(state.combat&&state.combat.active) state.combat.allyAssistNext=0;
  const target=attr+primary+allyOffset-Math.max(0,scene-supportOffset);
  const margin=target-r.total;
  let tier='failure';
  if((state.diceMode||'3d6')==='3d6' && r.total<=4) tier='critical_success';
  else if((state.diceMode||'3d6')==='3d6' && r.total>=17) tier='critical_failure';
  else if(margin>=6) tier='critical_success'; else if(margin>=4) tier='strong_success'; else if(margin>=0) tier='success'; else if(margin>=-2) tier='partial_failure'; else if(margin>=-4) tier='failure'; else tier='critical_failure';
  const success=['critical_success','strong_success','success'].includes(tier);
  log(`${action.actor} rolls ${r.dice.join('+')} = ${r.total} vs ${target} (${prof.attribute} ${attr} + ${prof.skill} ${primary} - setbacks ${scene} + support offset ${supportOffset} + ally support ${allyOffset}). ${tier.replace('_',' ').toUpperCase()}.`, `roll ${success?'success':'fail'}`, action.privacy==='private'?'private':'public', action.actor, 'Roll');
  return {rolled:true, success, tier, margin, total:r.total, target, profile:prof, character:ch};
}

function handleAction(action){
  const clean = norm(action.text);
  if(clean==='stop voice' || clean==='stop speech'){ stopSpeech(); return log('Voice stopped.', 'system', action.privacy, action.actor, 'TTS'); }
  if(clean==='ready' || clean==='ready up' || clean==='i am ready') return setReadyForActor(action.actor||state.activePlayer, true);
  if(clean==='unready' || clean==='not ready') return setReadyForActor(action.actor||state.activePlayer, false);
  if(clean==='ready status' || clean==='status ready' || clean==='who is ready') return readyStatus(action.actor||state.activePlayer);
  if(clean==='cancel draw' || clean==='cancel ready' || clean==='cancel ready up') return cancelReadyDraw(action.actor||state.activePlayer);
  if(clean==='force draw' || clean==='draw anyway' || clean==='override draw') return buildCaseFromApprovedDraw('forced-by-'+(action.actor||state.activePlayer||'party'));
  if(action.privacy==='private') addPlayer(action.actor);
  const map={notes:doNotes,look:doLook,list:doList,inventory:doInventory,shop:doShop,buy:doBuy,needs:doNeeds,hide:doHide,clues:doClues,leads:doLeads,move:doMove,ask:doAsk,research:doResearch,investigate:doInvestigate,prep:doPrep,trap:doTrap,cast:doCast,attack:doAttack,wait:doWait,reveal:doReveal,combat:doCombatStatus,commands:doCommands,profile:doProfile,dialogue:doDialogue,hq:doHQ,allies:doAllies,assistant:doAssistant,llm:doLLM,voice:doVoice,opener:doOpener,recruit:doRecruit,endturn:doEndTurn,reaction:doReaction};
  const fn=map[action.intent];
  if(!fn) return log(`I do not understand “${action.text}”. Try: look, list witnesses, shop, buy holy water, need Devil Trap, set trap Devil Trap, hide and wait, attack with rock salt shells, dodge, brace, counter.`, 'system', action.privacy, action.actor);
  const result=fn(action);
  const passive=['look','list','inventory','shop','clues','leads','commands','combat','reveal','allies','assistant','llm','voice','opener','profile','dialogue','hq','notes'];
  if(!passive.includes(action.intent)) recordActionPressure(action, result && result.rollResult ? result.rollResult : result);
  if(!passive.includes(action.intent) && !state.combat?.active && action.privacy!=='private') npcAllyFieldAction(action);
  return result;
}


function addPartyNote(text, actor='party', tags=[]){
  text = String(text||'').trim();
  if(!text) return log('No note text provided. Try: note check the bell chain before entering the lower room.', 'system', 'public', actor, 'Party Notes');
  const entry = { id: uid('note'), time: now(), actor, text, tags: tags||[], pinned:false, updatedAt: Date.now() };
  state.partyNotes = state.partyNotes || [];
  state.partyNotes.push(entry);
  // Notes are shared case state. save() publishes through NWAutoGMSync when cloud sync is enabled.
  log(`${actor} adds shared party note: ${text}`, 'note', 'public', 'party', 'Party Notes');
  save(); render();
  return entry;
}
function listPartyNotes(action){
  const notes = state.partyNotes || [];
  if(!notes.length) return log('No shared party notes yet. Add one with: note [text].', 'system', action?.privacy||'public', action?.actor||state.activePlayer, 'Party Notes');
  const rows = notes.slice(-30).map((n,i)=>`${i+1}. [${n.time}] ${n.actor}: ${n.text}${n.pinned?' [PINNED]':''}`).join('\n');
  return log(`Shared party notes:\n${rows}`, 'system', action?.privacy||'public', action?.actor||state.activePlayer, 'Party Notes');
}
function clearPartyNotes(action){
  if(!/confirm/i.test(action.raw||action.text||'')) return log('To clear shared party notes, type: clear notes confirm', 'system', action.privacy, action.actor, 'Party Notes');
  state.partyNotes = [];
  log(`${action.actor} cleared the shared party notes.`, 'system', 'public', 'party', 'Party Notes');
  save(); render();
}
function doNotes(action){
  const raw = String(action.raw||action.text||'').trim();
  const q = norm(raw);
  if(q.includes('clear notes')) return clearPartyNotes(action);
  if(q==='notes' || q==='party notes' || q==='shared notes' || q==='case notes' || q==='list notes') return listPartyNotes(action);
  let text = raw.replace(/^(public\s+|private\s+)?(party\s+)?(add\s+|send\s+|post\s+|write\s+)?(shared\s+)?(case\s+)?note(s)?\s*:?\s*/i,'').trim();
  if(!text && action.target) text=action.target;
  if(!text) return listPartyNotes(action);
  return addPartyNote(text, action.actor||state.activePlayer||'party');
}

function doLook(action){
  const target=findNode(action.target||state.currentLocation) || byId(state.graph.locations,state.currentLocation);
  if(!target) return log('No active case. Press New Modular Case.', 'system', action.privacy, action.actor);
  let text=`${target.name}: ${target.description||target.opening||target.surface||target.effect||''}`;
  const loc = byId(state.graph.locations,target.id);
  if(loc){
    const ws=state.graph.witnesses.filter(w=>w.location_hint===loc.id).map(w=>w.name);
    const ev=state.graph.evidence.filter(e=>e.location_hint===loc.id).map(e=>e.name);
    if(ws.length) text += `\nWitnesses here: ${ws.join(', ')}.`;
    if(ev.length) text += `\nEvidence here: ${ev.join(', ')}.`;
    if(loc.exits?.length) text += `\nPossible exits/leads: ${loc.exits.map(id=>byId(LIB.location_modules,id)?.name||id).join(', ')}.`;
  }
  log(text,'system',action.privacy,action.actor,'Look');
}
function doList(action){
  const q=norm(action.target||'');
  if(q.includes('ally')) return doAllies(action);
  if(q.includes('hq')||q.includes('warden')) return doHQ(action);
  if(q.includes('dialogue')||q.includes('topic')) return doDialogue(action);
  if(q.includes('profile')) return doProfile(action);
  if(q.includes('stranger')||q.includes('npc')) return log(`Strangers / casual NPCs nearby or in this case:\n${(state.graph.strangers||[]).map(s=>`• ${s.name} — ${s.location_hint||'wandering'}; ${s.smalltalk?.[0]||'small talk only until a topic matters.'}`).join('\n')||'No stranger modules active.'}`, 'system', action.privacy, action.actor, 'NPCs');
  if(q.includes('witness')) return log(`Witness list:\n${state.graph.witnesses.map(w=>`• ${w.name} — ${w.opening} (${w.location_hint||'unknown'})`).join('\n')}`,'system',action.privacy,action.actor,'Lists');
  if(q.includes('suspect')) return log(`Suspect/person-of-interest list:\n${state.suspects.map(s=>`• ${s.name} — ${s.status}; motive: ${s.motive}; ${s.notes}`).join('\n')}`,'system',action.privacy,action.actor,'Lists');
  if(q.includes('location')) return log(`Location list:\n${state.graph.locations.map(l=>`• ${l.name} — ${state.unlockedLocations.includes(l.id)?'unlocked':'locked'}; ${l.description}`).join('\n')}`,'system',action.privacy,action.actor,'Lists');
  if(q.includes('trap')) return log(`Trap recipes:\n${(LIB.trap_recipes||[]).map(t=>`• ${t.name}: needs ${reqText(t.requires)}. Works on ${t.works_on.join(', ')}. ${t.effect}`).join('\n')}`,'system',action.privacy,action.actor,'Lists');
  if(q.includes('spell')||q.includes('rite')) return log(`Known spells/rites:\n${(LIB.spell_catalog||[]).map(s=>`• ${s.name}: needs ${reqText(s.requires)}; ${s.roll}; ${s.effect}`).join('\n')}`,'system',action.privacy,action.actor,'Lists');
  if(q.includes('shop')||q.includes('item')||q.includes('buy')) return doShop(action);
  return log('Lists available: list witnesses, list suspects, list locations, list traps, list spells, list shop, list allies, list wardens, list hq, dialogue [name], profile [name].', 'system', action.privacy, action.actor, 'Lists');
}
function doInventory(action){
  const inv=Object.entries(state.inventory).map(([id,qty])=>`• ${qty}× ${itemName(id)}`).join('\n') || 'No gear recorded.';
  const traps=state.craftedTraps.map(t=>`• ${t.name} at ${byId(state.graph.locations,t.location)?.name||'unknown'} (${t.armed?'armed':'prepared'})`).join('\n');
  log(`Credits: ${state.credits}\nInventory:\n${inv}${traps?`\nPrepared traps:\n${traps}`:''}`, 'system', action.privacy, action.actor, 'Inventory');
}
function doShop(action){
  const rows=currentSceneStock().map(id=>`• ${itemName(id)} — ${itemCost(id)} credits: ${(byId(LIB.item_catalog,id)||byId(LIB.material_catalog,id)||{}).use||''}`).join('\n');
  log(`Quartermaster / local supply list:\n${rows}\nUse “buy [item]”.`, 'system', action.privacy, action.actor, 'Shop');
}
function doBuy(action){
  const item=findCatalog(action.target,['item','material']);
  if(!item) return log(`No purchasable item matches “${action.target}”. Try “shop”.`, 'system', action.privacy, action.actor, 'Shop');
  const cost=Number(item.cost||10); if(state.credits<cost) return log(`Not enough credits for ${item.name}. Cost ${cost}, available ${state.credits}.`, 'system', action.privacy, action.actor, 'Shop');
  state.credits-=cost; addInventory(item.id,1); log(`${action.actor} buys/requisitions ${item.name} for ${cost} credits. ${item.use||''}`, 'system', action.privacy, action.actor, 'Shop');
}
function doNeeds(action){
  const target=findCatalog(action.target,['trap','spell','attack','item','material']);
  if(!target) return log(`I cannot find requirements for “${action.target}”. Try list traps or list spells.`, 'system', action.privacy, action.actor, 'Requirements');
  const req=target.requires||target.consumes||{};
  const missing=Object.entries(req).filter(([id,qty])=>(state.inventory[id]||0)<qty).map(([id,qty])=>`${qty-(state.inventory[id]||0)}× ${itemName(id)}`);
  log(`${target.name} requirements: ${reqText(req)}.${missing.length?` Missing: ${missing.join(', ')}.`:' You have everything needed.'} ${target.effect||target.use||''}`, 'system', action.privacy, action.actor, 'Requirements');
}
function doHide(action){
  const rr=resolveRoll(action, profile('hide','hide'));
  if(rr.success){ state.hiddenActors[action.actor]={location:state.currentLocation,quality:rr.tier,time:now()}; log(`${action.actor} hides and waits. They are concealed at ${byId(state.graph.locations,state.currentLocation)?.name||'the scene'}.`, 'system', action.privacy, action.actor, 'Hide'); }
  else { state.hiddenActors[action.actor]=null; log(`${action.actor} tries to hide, but the position is bad. The creature may notice the stakeout.`, 'system', action.privacy, action.actor, 'Hide'); adjustPressure(1,'failed stakeout'); }
  maybeCreature(action,rr,true);
}
function doClues(action){ const pub=state.clues.map(c=>`• ${c.text}`).join('\n')||'No public clues yet.'; const priv=(state.privateClues[action.actor]||[]).map(c=>`• ${c.text}`).join('\n'); log(`Known clues:\n${pub}${priv?`\nPrivate clues for ${action.actor}:\n${priv}`:''}`,'system',action.privacy,action.actor,'Case Board'); }
function doLeads(action){ log(`Suggested leads:\n${suggestions().map(x=>`• ${x}`).join('\n')}`, 'system', action.privacy, action.actor, 'Leads'); }
function doMove(action){
  const loc=findNode(action.target,['location']); if(!loc) return log(`I cannot find a location matching “${action.target}”.`, 'system', action.privacy, action.actor);
  if(!state.unlockedLocations.includes(loc.id)) unlockLocation(loc.id,'player followed a lead');
  state.currentLocation=loc.id; const rr=resolveRoll(action, profile('move',loc.name));
  log(`${action.actor} moves to ${loc.name}. ${loc.description||''}`, 'system', action.privacy, action.actor, 'Move'); maybeCreature(action,rr);
}
function doAsk(action){
  const npc=findNPC(action.target) || state.graph.witnesses.find(w=>w.location_hint===state.currentLocation);
  if(!npc){ const ent=findNode(action.target,['entity']); if(ent) return doCreatureDialogue(action, ent); return smallTalk(`${action.actor} talks with locals, but the chatter does not produce anything solid. It is not added to the case board.`, action.privacy, action.actor, 'Small Talk'); }
  const isStranger = npc._type==='stranger' || (state.graph.strangers||[]).some(s=>s.id===npc.id);
  const rr=resolveRoll(action, profile('ask',npc.name));
  const key=findTopic(npc, action.topic||action.target);
  const topic=key ? npc.topics?.[key] : null;
  if(!topic){
    const dk = findTopic({topics:npc.dialogue_options||{}}, action.topic||action.target);
    if(dk){ const base=npc.dialogue_options[dk]; const line=npcFallbackLine(npc, dk, base, '', rr); return log(`${line}`, 'system', action.privacy, action.actor, npc._type==='stranger'?'Stranger Lead':'Witness', npc.id); }
    const chatter = pick(npc.smalltalk||[]) || `${npc.name} offers a few ordinary details, but nothing becomes a stable clue.`;
    if(isStranger){ smallTalk(`${npc.name}: ${chatter}`, action.privacy, action.actor, 'Small Talk'); return {rollResult:rr, smalltalk:true}; }
    return log(`${npc.name} has nothing useful to say about that yet. Try one of: ${Object.keys(npc.topics||{}).concat(Object.keys(npc.dialogue_options||{})).join(', ')||'no known topics'}.`, 'system', action.privacy, action.actor, 'Witness', npc.id);
  }
  if(!meets(topic.requires_any,action.actor)){ adjustPressure(1,`${npc.name} guards the topic`); noteRelationship(npc.id,-1); return log(`${npc.name} flinches from that subject. You need more leverage before they speak about ${key}.`, 'system', action.privacy, action.actor, 'Witness'); }
  let response=topic.response; if(!rr.success){ response=`${npc.name} hesitates, misremembers, or protects themself before giving you only part of it. ${response}`; adjustPressure(1,'questioning raises suspicion'); noteRelationship(npc.id,-1); }
  else noteRelationship(npc.id,1);
  const hasClues=(topic.clues||[]).length || (topic.unlocks_locations||[]).length || (topic.unlocks_topics||[]).length;
  const spokenLine = maybeLLMVoiceNpc(npc, key, response, topic.clues||[], action, rr);
  if(!hasClues && isStranger){ smallTalk(`${spokenLine}`, action.privacy, action.actor, 'Small Talk'); return {rollResult:rr, smalltalk:true}; }
  log(`${spokenLine}`, 'system', action.privacy, action.actor, isStranger?'Stranger Lead':'Witness', npc.id);
  (topic.clues||[]).forEach(c=>addClue(c,action.privacy,action.actor,`${npc.name}: ${key}`));
  (topic.unlocks_locations||[]).forEach(l=>unlockLocation(l,`${npc.name} mentioned it`)); addLeads([...(topic.unlocks_topics||[]),...(topic.unlocks||[])],`${npc.name}: ${key}`); maybeCreature(action,rr);
  return {rollResult:rr};
}
function revealEvidence(e, action, rr, source){
  let layer='surface'; if(rr.tier==='strong_success'||rr.tier==='critical_success') layer='hidden'; else if(rr.success) layer='deep';
  log(`${e.name}: ${e[layer]||e.deep||e.surface||'You find a useful detail.'}`, 'system', action.privacy, action.actor, source);
  (e.clues||[]).slice(0,layer==='surface'?1:99).forEach(c=>addClue(c,action.privacy,action.actor,e.name));
  if(layer!=='surface'){ (e.unlocks||[]).forEach(u=>{ if(byId(LIB.location_modules,u)) unlockLocation(u,`${e.name} points there`); }); addLeads(e.unlocks,e.name); }
}
function doResearch(action){
  const rr=resolveRoll(action, profile('research',action.target)); const e=findNode(action.target,['evidence']);
  if(e) revealEvidence(e,action,rr,'Research');
  else { const ent=state.graph.entity; log(`Research on ${action.target||'the case'} cross-references ${state.graph.tarot?.suit?.name||'the draw'} and ${ent?.type||'unknown entity'}. ${rr.success?`It points toward signs like ${(ent?.signs||[]).slice(0,2).join(' and ')}.`:'The records conflict and may create a false lead.'}`, 'system', action.privacy, action.actor, 'Research'); if(rr.success) addLeads(ent?.signs||[],'research'); else adjustPressure(1,'false research lead'); }
  maybeCreature(action,rr);
}
function doInvestigate(action){
  const node=findNode(action.target,['evidence','location','witness']); const rr=resolveRoll(action, profile('investigate',action.target));
  if(node?.surface || node?.deep || node?.hidden) revealEvidence(node,action,rr,'Investigation');
  else { const sign=pick(state.graph.signs); log(`Investigation turns up a sign: ${sign?.surface||'something is wrong'} ${rr.success?(sign?.deep||''):''}`, 'system', action.privacy, action.actor, 'Investigation'); if(rr.success) addLeads(sign?.points_to||[], sign?.name||'sign'); else adjustPressure(1,'uncertain sign'); }
  maybeCreature(action,rr);
}
function doPrep(action){ const trap=findCatalog(action.target,['trap']); if(trap) return doTrap(action); const prep=findNode(action.target,['prep']); const rr=resolveRoll(action, profile('prep',action.target)); if(!prep) return log(`That preparation is not in the current case kit. Try list traps, shop, or need [trap].`, 'system', action.privacy, action.actor); if(!state.preps.includes(prep.id)) state.preps.push(prep.id); log(`${action.actor} prepares ${prep.name}. ${prep.effect} ${rr.success?'The setup holds.':'It is unstable.'}`, 'system', action.privacy, action.actor, 'Prep'); if(rr.success) adjustPressure(-1,`${prep.name} stabilizes the hunt`); else adjustPressure(1,`${prep.name} is unstable`); }
function doTrap(action){
  const trap=findCatalog(action.target,['trap']); if(!trap) return log(`No trap recipe matches “${action.target}”. Try list traps.`, 'system', action.privacy, action.actor, 'Trap');
  if(!hasInventory(trap.requires)) return log(`${trap.name} cannot be set yet. Needs: ${reqText(trap.requires)}. Use “shop” and “buy [item]”.`, 'system', action.privacy, action.actor, 'Trap');
  const prof=profile('trap',trap.name); prof.skill=trap.skill||prof.skill; prof.support=trap.support||prof.support; prof.setback=trap.setback||0;
  const rr=resolveRoll(action, prof);
  if(rr.success){ Object.entries(trap.requires||{}).forEach(([id,qty])=>removeInventory(id,qty)); const made={id:uid('trap'),recipe:trap.id,name:trap.name,armed:true,location:state.currentLocation,quality:rr.tier,works_on:trap.works_on}; state.craftedTraps.push(made); if(!state.preps.includes(trap.id)) state.preps.push(trap.id); log(`${action.actor} sets ${trap.name}. ${trap.effect} It is armed at ${byId(state.graph.locations,state.currentLocation)?.name||'the current scene'}.`, 'system', action.privacy, action.actor, 'Trap'); adjustPressure(-1,`${trap.name} controls the field`); }
  else { log(`${trap.name} setup fails or remains unstable.`, 'system', action.privacy, action.actor, 'Trap'); adjustPressure(1,'unstable trap setup'); }
}
function doCast(action){
  const spell=findCatalog(action.target,['spell']); if(spell && !hasInventory(spell.requires)) return log(`${spell.name} requires ${reqText(spell.requires)}.`, 'system', action.privacy, action.actor, 'Occult');
  const rr=resolveRoll(action, profile('cast',action.target));
  if(spell && rr.success) Object.entries(spell.requires||{}).slice(0,1).forEach(([id,qty])=>removeInventory(id,0));
  if(rr.success){ const sign=pick(state.graph.signs); log(`${action.actor} works ${spell?.name||'the rite'}. The veil answers with ${sign?.name||'a sign'}: ${sign?.deep||sign?.surface||'something hidden reacts'}`, 'system', action.privacy, action.actor, 'Occult'); addLeads(sign?.points_to||[], sign?.name||'rite'); }
  else { log('The rite pulls wrong. Backlash stains the scene and something notices.', 'system', action.privacy, action.actor, 'Occult'); adjustPressure(2,'ritual backlash'); }
  maybeCreature(action,rr);
}
function combatDifficulty(){ return 1 + Math.floor(state.pressure/4); }
function startCombat(action, reason='engagement'){
  const ent=state.graph.entity; if(!ent) return false;
  const tier=state.graph.tarot?.value || '5'; const hp=8 + tarotValueWeight(tier);
  state.combat = state.combat || defaultCombat();
  state.combat.active=true; state.combat.round=state.combat.round||1; state.combat.turn='players'; state.combat.playerActionsRemaining = state.combat.playerActionsRemaining || 2; state.combat.allyActionsRemaining = (state.allies||[]).length; state.combat.allyActedThisRound = state.combat.allyActedThisRound || []; state.combat.entityHp=state.combat.entityHp||hp; state.combat.entityMaxHp=state.combat.entityMaxHp||hp; state.combat.entityState='engaged'; state.combat.participants=[...new Set([...(state.combat.participants||[]), action.actor, ...state.players.slice(0,2)])];
  state.combat.pendingThreat=null; state.combat.playerStates=state.combat.playerStates||{}; state.combat.log=state.combat.log||[];
  combatLog(`Combat begins: ${ent.name}. Reason: ${reason}.`);
  log(`COMBAT START — ${ent.name} manifests enough to fight. Round ${state.combat.round}. The Wardens act first.`, 'system', action.privacy, action.actor, 'Combat');
  return true;
}
function damageFromTier(tier){ return ({critical_success:5,strong_success:4,success:3,partial_failure:1,failure:0,critical_failure:0,narrative:2})[tier] ?? 0; }
function doAttack(action){
  const ent=state.graph.entity; if(!ent) return log('There is no active entity in the case yet.', 'system', action.privacy, action.actor, 'Attack');
  if(!state.combat.active) startCombat(action,'the Wardens attack or confront the threat');
  if(state.combat.turn!=='players') return log(`It is not the Wardens’ attack window. Respond to the pending threat with dodge, brace, counter, protect, or end turn.`, 'system', action.privacy, action.actor, 'Combat');
  state.combat.playerActionsRemaining = state.combat.playerActionsRemaining == null ? 2 : state.combat.playerActionsRemaining;
  if(state.combat.playerActionsRemaining <= 0) return log(`The Wardens have no combat actions left this round. Type end turn or resolve the creature threat.`, 'system', action.privacy, action.actor, 'Combat');
  state.combat.playerActionsRemaining -= 1;
  const attack=findCatalog(action.target||action.text,['attack']);
  if(attack && !hasInventory(attack.consumes)) return log(`${attack.name} requires ${reqText(attack.consumes)}. Use shop/buy or choose another attack.`, 'system', action.privacy, action.actor, 'Attack');
  const prof=profile('attack',action.text); if(attack){ prof.attribute=attack.attribute||prof.attribute; prof.skill=attack.skill||prof.skill; prof.support=attack.support||prof.support; prof.setback += attack.setback||0; }
  prof.setback += combatDifficulty();
  if(state.hiddenActors[action.actor]?.location===state.currentLocation) prof.setback=Math.max(0,prof.setback-1);
  const rr=resolveRoll(action, prof); if(attack && rr.success) Object.entries(attack.consumes||{}).forEach(([id,qty])=>removeInventory(id,qty));
  const trapReady=state.craftedTraps.some(t=>t.armed && (t.works_on||[]).some(x=>(ent?.tags||[]).includes(x)));
  const hasPrep=trapReady || state.preps.some(pid=>((byId(LIB.prep_modules,pid)||findCatalog(pid,['trap']))?.tags||[]).some(t=>(ent?.tags||[]).includes(t))) || state.clues.some(c=>/weakness|silence|iron|exorcism|fire|bell/i.test(c.text));
  let dmg=damageFromTier(rr.tier); if(!hasPrep) dmg=Math.max(0,dmg-2); if(trapReady) dmg+=1;
  if(rr.success || dmg>0){ state.combat.entityHp=clamp(state.combat.entityHp-dmg,0,state.combat.entityMaxHp); combatLog(`${action.actor} attacks for ${dmg} progress. Entity HP ${state.combat.entityHp}/${state.combat.entityMaxHp}.`); }
  if(!hasPrep){ log(`The attack connects with the wrong layer of the problem. ${ent.name} is hurt only briefly; the kill condition is still unresolved: ${ent.kill_condition||'unknown'}.`, 'system', action.privacy, action.actor, 'Confrontation'); drawMinorPressure('blind or underprepared attack'); }
  else if(rr.success){ log(`The prepared strike matters. ${ent.name} is forced back. Weakness: ${ent.weakness}. Kill condition: ${ent.kill_condition}`, 'system', action.privacy, action.actor, 'Confrontation'); state.flags.weaknessRevealed=true; state.flags.killConditionRevealed=true; }
  else { log(`${ent.name} turns the failed attack into pressure.`, 'system', action.privacy, action.actor, 'Confrontation'); drawMinorPressure('failed combat attack'); }
  if(state.combat.entityHp<=0){
    if(hasPrep && state.flags.killConditionRevealed){ state.combat.entityState='banished or defeated'; state.combat.active=false; log(`${ent.name} collapses under the correct preparation. Case confrontation can resolve if the team completes aftermath/fallout.`, 'system', action.privacy, action.actor, 'Combat'); }
    else { state.combat.entityHp=Math.ceil(state.combat.entityMaxHp/2); log(`${ent.name} should be down, but reforms because the true kill/banish condition has not been completed.`, 'system', action.privacy, action.actor, 'Combat'); drawMinorPressure('entity reforms after wrong defeat'); }
    return {rollResult:rr};
  }
  creatureDeclareThreat(action);
  return {rollResult:rr};
}
function creatureDeclareThreat(action){
  const ent=state.graph.entity; if(!ent || !state.combat.active) return;
  state.combat.turn='reaction';
  const target=action.actor || pick(state.combat.participants)||state.activePlayer;
  const high=['high','crisis'].includes(pressureLevel());
  const move= high ? pick([...(ent.actions||[]),'mauls the nearest Warden','forces a fear spike','tries to isolate the target','advances the ritual while attacking']) : pick(ent.actions||['strikes from the dark']);
  const severity = high ? 3 : pressureLevel()==='moderate' ? 2 : 1;
  state.combat.pendingThreat={id:uid('threat'), target, move, severity, round:state.combat.round};
  combatLog(`${ent.name} declares threat against ${target}: ${move}.`);
  log(`${ent.name} acts: it ${move} targeting ${target}. Respond with “${target}: dodge”, “${target}: brace”, “${target}: counter”, “protect ${target}”, or “end turn”.`, 'system', 'public', 'party', 'Creature Turn');
}
function resolveCreatureThreat(action, opts={}){
  const ent=state.graph.entity; const th=state.combat.pendingThreat; if(!th) return log('There is no pending creature threat to resolve.', 'system', action.privacy, action.actor, 'Combat');
  const reaction=opts.reaction || 'none'; let mitigated=0; let rr={success:false,tier:'failure'};
  if(reaction!=='none'){
    const prof = reaction==='brace' ? {attribute:'Endurance',skill:'Endurance',support:['Resistance','Pain Tolerance'],setback:combatDifficulty()} : reaction==='counter' ? profile('attack','counter') : {attribute:'Prowess',skill:'Dodge',support:['Awareness','Combat Flow'],setback:combatDifficulty()};
    if(reaction==='counter'){ prof.setback+=combatDifficulty(); }
    rr=resolveRoll({...action, intent:'reaction'}, prof);
    if(rr.success){ mitigated = reaction==='brace' ? 1 : reaction==='dodge' ? th.severity+1 : 0; }
  }
  let damage=Math.max(0, th.severity - mitigated);
  if(reaction==='counter' && rr.success){ const cd=damageFromTier(rr.tier); state.combat.entityHp=clamp(state.combat.entityHp-cd,0,state.combat.entityMaxHp); log(`${action.actor} counters successfully, reducing the opening and dealing ${cd} progress back to ${ent.name}.`, 'system', action.privacy, action.actor, 'Counter'); damage=Math.max(0,damage-1); }
  if(damage>0){
    state.combat.playerStates[th.target]=state.combat.playerStates[th.target]||{wounds:0,setbacks:0,notes:[]};
    const ps=state.combat.playerStates[th.target]; ps.wounds+=damage; ps.setbacks+=damage>=3?2:1; ps.notes.push(`${ent.name}: ${th.move}`);
    log(`${th.target} takes ${damage} combat harm from ${ent.name}. Ongoing combat setbacks: ${ps.setbacks}.`, 'system', 'public', 'party', 'Damage');
    if(damage>=3) drawMinorPressure('serious creature hit'); else adjustPressure(1,'creature lands a hit');
  } else log(`${th.target} avoids the worst of ${ent.name}'s attack.`, 'system', 'public', 'party', 'Defense');
  state.combat.pendingThreat=null; npcCombatAlliesAct(); state.combat.round++; state.combat.turn='players'; state.combat.playerActionsRemaining=2; state.combat.allyActionsRemaining=(state.allies||[]).length; state.combat.allyActedThisRound=[];
  combatLog(`Round ${state.combat.round}: Wardens act. Player actions refreshed to 2.`);
  return {rollResult:rr};
}
function doReaction(action){
  const n=norm(action.text); const reaction=n.includes('brace')?'brace':n.includes('counter')?'counter':n.includes('protect')?'protect':'dodge';
  if(reaction==='protect' && state.combat.pendingThreat){ state.combat.pendingThreat.target=action.actor; log(`${action.actor} steps into the line of danger to protect the target.`, 'system', action.privacy, action.actor, 'Protect'); return resolveCreatureThreat(action,{reaction:'brace'}); }
  return resolveCreatureThreat(action,{reaction});
}
function doEndTurn(action){ if(state.combat.active && state.combat.pendingThreat) return resolveCreatureThreat(action,{reaction:'none'}); if(state.combat.active){ creatureDeclareThreat(action); return; } return doWait(action); }
function doCombatStatus(action){
  const c=state.combat||defaultCombat(); const ent=state.graph.entity;
  const rows=[`Combat active: ${c.active?'yes':'no'}`,`Round: ${c.round||0}`,`Turn: ${c.turn}`, `Warden actions remaining: ${c.playerActionsRemaining==null?2:c.playerActionsRemaining}`, `NPC ally actions remaining this round: ${Math.max(0,(state.allies||[]).length-(c.allyActedThisRound||[]).length)}`,  ent?`Entity: ${ent.name} — ${c.entityHp||0}/${c.entityMaxHp||0}`:'No entity', c.pendingThreat?`Pending threat: ${c.pendingThreat.move} targeting ${c.pendingThreat.target}`:'No pending threat'];
  for(const [p,s] of Object.entries(c.playerStates||{})) rows.push(`${p}: wounds ${s.wounds||0}, combat setbacks ${s.setbacks||0}`);
  log(rows.join('\n'), 'system', action.privacy, action.actor, 'Combat Status');
}
function doCommands(action){ const q=norm(action.target||action.text); log((q.includes('combat')?combatCommands():generalCommands()).join('\n'), 'system', action.privacy, action.actor, 'Commands'); }
function doWait(action){
  if(state.combat.active && state.combat.pendingThreat) return resolveCreatureThreat(action,{reaction:'none'});
  drawMinorPressure('time passes / waiting in hunting ground');
  if(state.hiddenActors[action.actor]){ const sign=pick(state.graph.signs); log(`${action.actor} waits in hiding. The threat leaves a sign: ${sign?.surface||'something passes nearby'} ${sign?.deep||''}`, 'system', action.privacy, action.actor, 'Stakeout'); addLeads(sign?.points_to||[], sign?.name||'stakeout'); }
  else log(`Time passes. The case pressure is now ${pressureLevel()}.`, 'system', action.privacy, action.actor, 'Time');
  maybeCreature(action,{success:false,tier:'partial_failure'});
  return {success:false,tier:'partial_failure'};
}


function profileTextFor(obj){
  if(!obj) return 'No profile found.';
  const p = obj.profile || npcProfile(obj) || {};
  const vp = speakerProfile(obj) || {};
  const topics = Object.keys(obj.topics||{});
  const dialog = Object.entries(obj.dialogue_options||{}).map(([k,v])=>`• ${k}: ${v}`).join('\n') || '• no special dialogue options listed yet';
  return `${obj.name}\nType: ${obj.type||obj._type||p.role||p.archetype||'unknown'}\nRole/Profile: ${p.archetype||p.role||'unknown'}\nIntelligence/Logic: ${p.intelligence||p.intellect||'unknown'}\nDemeanor: ${p.demeanor||obj.demeanor||'unknown'}\nMotive: ${p.motive||obj.behavior||'unknown'}\nFear/Trust: ${obj.fear??p.fear??'?'}/${(state.relationshipMemory&&state.relationshipMemory[obj.id])??obj.trust??p.trust??'?'}\nVoice: ${vp.voiceStyle||'auto'} ${vp.gender||''} ${vp.age||''}\nKnown topics: ${topics.join(', ')||'none'}\nDialogue options:\n${dialog}`;
}
function doProfile(action){
  const obj=findNode(action.target,['witness','ally','stranger','warden','entity']) || findNPC(action.target) || state.graph.entity;
  if(!obj) return log(`No character, NPC, Warden, or creature profile matches “${action.target}”. Try profile entity, profile Mrs Harlan, profile available wardens.`, 'system', action.privacy, action.actor, 'Profile');
  log(profileTextFor(obj),'system',action.privacy,action.actor,'Profile', obj.id);
}
function doDialogue(action){
  const obj=findNode(action.target,['witness','ally','stranger','warden','entity']) || findNPC(action.target) || state.graph.entity;
  if(!obj) return log('Dialogue options: ask [name] about [topic], profile [name], ask entity about warning, taunt entity, parley entity, observe entity.', 'system', action.privacy, action.actor, 'Dialogue');
  const topics=Object.keys(obj.topics||{}).map(t=>`• ask ${obj.name} about ${t}`).join('\n');
  const opts=Object.keys(obj.dialogue_options||{}).map(t=>`• ${obj._type==='entity'||obj.id===state.graph.entity?.id?t+' '+obj.name:`ask ${obj.name} about ${t}`}`).join('\n');
  log(`Dialogue options for ${obj.name}:\n${topics||'• no clue topics yet'}\n${opts?`\nProfile/role options:\n${opts}`:''}`, 'system', action.privacy, action.actor, 'Dialogue', obj.id);
}
function doHQ(action){
  if(norm(action.target+' '+(action.raw||'')).includes('refresh')||norm(action.target+' '+(action.raw||'')).includes('reroll')){ state.graph.wardenAvailable = rollAvailableWardens([...(state.graph.theme?.tags||[]), state.graph.tarot?.suitId], state.graph.wardenHqs||[]); assignCaseProfiles(); }
  const hqs=(state.graph.wardenHqs||[]).map(h=>`• ${h.name} — ${h.description} Services: ${(h.services||[]).join(', ')}`).join('\n') || '• no Warden HQ modules active';
  const wardens=(state.graph.wardenAvailable||[]).map(w=>`• ${w.name} — ${w.role||w.type}; ${w.opening||''} Availability: ${Math.round((w.availabilityChance||0.45)*100)}%. Try: profile ${w.name}; dialogue ${w.name}; recruit ${w.name}`).join('\n') || '• no Wardens currently available. Try: hq refresh';
  log(`WARDEN HQS\n${hqs}\n\nAVAILABLE WARDENS\n${wardens}\n\nCommands: hq refresh, profile [warden], dialogue [warden], recruit [warden].`, 'system', action.privacy, action.actor, 'Warden HQ');
}
function doCreatureDialogue(action, ent=state.graph.entity){
  const q=norm(action.topic||action.target||'');
  const rr=resolveRoll(action, profile('ask', ent.name));
  let line='';
  if(q.includes('taunt')) line=`${ent.name} reacts to the provocation. ${(ent.actions||[])[0]||'It reveals aggression but not its weakness.'}`;
  else if(q.includes('parley')||q.includes('bargain')||q.includes('talk')) line=`${ent.name} answers in pressure, symbol, or threat. It wants ${ent.profile?.motive||ent.behavior||'the case to keep moving toward its anchor'}.`;
  else if(q.includes('observe')||q.includes('warning')) line=`Observation: signs include ${(ent.signs||[]).join(', ')||'unconfirmed anomalies'}. ${ent.dialogue_options?.warning||'Hidden weakness remains locked until discovered.'}`;
  else line=`The entity does not give a normal answer. It leaves behavior instead: ${(ent.actions||[]).slice(0,3).join(', ')||'watch, pressure, threaten'}.`;
  if(!rr.success){ adjustPressure(1,'unsafe creature interaction'); line += ' The exchange gives it leverage.'; }
  log(line,'system',action.privacy,action.actor,'Creature Turn', ent.id);
  maybeCreature(action,rr,true);
}
function doAllies(action){
  const available=[...(state.graph.allies||[]), ...(state.graph.wardenAvailable||[])].filter(a=>!recruited(a.id));
  const active=(state.allies||[]);
  const txt=`Recruited allies:\n${active.length?active.map(a=>`• ${a.name} — ${(a.services||[]).join(', ')}; bonuses ${JSON.stringify(a.bonuses||{})}`).join('\n'):'• none'}\n\nPotential allies:\n${available.length?available.map(a=>`• ${a.name} — ${a.opening} Services: ${(a.services||[]).join(', ')}. Try: recruit ${a.name}`).join('\n'):'• none currently visible'}`;
  log(txt,'system',action.privacy,action.actor,'Allies');
}

function doOpener(action){ generateOpeningTransmission(false); }

function doRecruit(action){
  const npc=findNode(action.target,['ally','witness','stranger','warden']);
  if(!npc) return log(`No recruitable NPC matches “${action.target}”. Try list allies.`, 'system', action.privacy, action.actor, 'Recruit');
  if(recruited(npc.id)) return log(`${npc.name} is already helping the team.`, 'system', action.privacy, action.actor, 'Recruit');
  const rec=npc.recruitment || {requires_any:[], cost:0};
  if(!meets(rec.requires_any, action.actor)) return log(`${npc.name} is not ready to help yet. Needed leverage: ${(rec.requires_any||[]).map(id=>LIB.clue_definitions[id]||id).join(' OR ')||'better trust or proof'}.`, 'system', action.privacy, action.actor, 'Recruit');
  const cost=Number(rec.cost||0); if(state.credits<cost) return log(`${npc.name} requires supplies/payment worth ${cost} credits. You have ${state.credits}.`, 'system', action.privacy, action.actor, 'Recruit');
  const rr=resolveRoll(action, profile('ask',npc.name));
  if(!rr.success){ noteRelationship(npc.id,-1); return log(`${npc.name} refuses for now. ${rec.failure||'They need more proof before risking themselves.'}`, 'system', action.privacy, action.actor, 'Recruit'); }
  state.credits-=cost; state.allies.push({...npc, recruitedAt:now(), remote: true}); noteRelationship(npc.id,2);
  log(`${npc.name} joins as an NPC ally. Services: ${(npc.services||[]).join(', ')||'field support'}. Their bonuses can offset relevant checks when fiction supports it.`, 'system', action.privacy, action.actor, 'Recruit');
}
function doAssistant(action){
  const prompt = action.target || action.topic || 'suggest next steps';
  runAssistant(prompt, action.privacy, action.actor);
}


function doLLM(action){
  const q=norm(action.raw||action.text||action.target||'');
  if(q.includes('disable')||q.includes('fallback')||q.includes('structured')){
    if(window.NWLLMAdapter) window.NWLLMAdapter.enabled=false;
    if($('llmStatus')) $('llmStatus').textContent='Structured assistant fallback is active.';
    return log('Browser LLM disabled. The structured Warden Field Assistant is active and all Auto-GM truth still works normally.', 'system', action.privacy, action.actor, 'LLM');
  }
  if(window.NWLLMAdapter && window.NWLLMAdapter.init){
    log('Loading browser LLM from the main command input. This may take a while on first load.', 'system', action.privacy, action.actor, 'LLM');
    const model=$('llmModelSelect') ? $('llmModelSelect').value : undefined;
    window.NWLLMAdapter.enabled=true;
    window.NWLLMAdapter.init({model}).then(()=>{
      if($('llmStatus')) $('llmStatus').textContent='Browser LLM ready.';
      log('Browser LLM is ready. You can type: assistant summarize case, assistant prep checklist, or ask assistant what should I ask next.', 'system', action.privacy, action.actor, 'LLM');
      render();
    }).catch(err=>{
      if($('llmStatus')) $('llmStatus').textContent='LLM load failed. Structured fallback remains active.';
      log('Browser LLM could not load on this device/browser. Structured Auto-GM remains fully usable.', 'system', action.privacy, action.actor, 'LLM');
      console.warn(err);
      render();
    });
    return;
  }
  log('No browser LLM adapter was found. Structured assistant fallback is active.', 'system', action.privacy, action.actor, 'LLM');
}

function doVoice(action){
  const q=norm(action.raw||action.text||action.target||'');
  state.voiceSettings=state.voiceSettings||{};
  if(q.includes('off')||q.includes('stop voice')){
    if(q.includes('stop')){ try{ speechSynthesis.cancel(); }catch(e){} }
    if(q.includes('npc')) state.voiceSettings.ttsNpc=false; else state.voiceSettings.ttsEnabled=false;
    if($('ttsEnabled')) $('ttsEnabled').checked=!!state.voiceSettings.ttsEnabled;
    if($('ttsNpc')) $('ttsNpc').checked=!!state.voiceSettings.ttsNpc;
    save();
    return log(q.includes('npc')?'NPC speech disabled.':'Voice/TTS disabled.', 'system', action.privacy, action.actor, 'Voice');
  }
  if(q.includes('test')){
    speakText('Night Wardens voice test. This is the Auto Game Warden transmission channel.', 'transmission');
    return log('Voice test sent through the current selected voice.', 'system', action.privacy, action.actor, 'Voice');
  }
  state.voiceSettings.ttsEnabled=true;
  if(q.includes('npc')) state.voiceSettings.ttsNpc=true;
  if($('ttsEnabled')) $('ttsEnabled').checked=true;
  if($('ttsNpc')) $('ttsNpc').checked=!!state.voiceSettings.ttsNpc;
  save();
  log('Voice/TTS enabled from the main command input. NPCs and Game Warden transmissions will use the selected natural voice when available.', 'system', action.privacy, action.actor, 'Voice');
}

function doReveal(action){ const arr=state.privateClues[action.actor]||[]; if(!arr.length) return log(`${action.actor} has no private clues to reveal.`, 'system', action.privacy, action.actor); const c=arr.shift(); state.clues.push({...c,revealed:true}); log(`${action.actor} reveals: ${c.text}`, 'clue', 'public', 'party', 'Reveal'); }
function maybeCreature(action, rr, forced=false){
  if(!$('creatureResponse')?.checked && !forced) return; if(!forced && rr?.success && Math.random()>.25) return;
  const ent=state.graph.entity; if(!ent) return; const sign=pick(state.graph.signs.filter(s=>hasAny(s.tags,ent.tags||[])).concat(state.graph.signs));
  let act=pick(ent.actions||['watches']); if(['high','crisis'].includes(pressureLevel())) act=pick([...(ent.actions||[]),'attack directly','isolate a Warden','advance the ritual','compromise the location']);
  const msg=`Threat response — ${ent.name}: it ${act}. It leaves a sign: ${sign?.surface||'the air changes'}`;
  log(msg, 'system', action.privacy==='private'?'private':'public', action.privacy==='private'?action.actor:'party', 'Threat');
  if(!rr?.success || forced) drawMinorPressure(`${ent.name} advances`);
}

function suggestions(){
  const loc=byId(state.graph.locations,state.currentLocation); let s=['look','clues','inventory','list witnesses','list suspects','list locations','shop','list traps'];
  if(loc){ s=s.concat(loc.suggestions||[]); state.graph.witnesses.filter(w=>w.location_hint===loc.id).forEach(w=>Object.keys(w.topics||{}).slice(0,4).forEach(k=>s.push(`ask ${w.name} about ${k}`))); state.graph.evidence.filter(e=>e.location_hint===loc.id).forEach(e=>s.push(`investigate ${e.name}`)); }
  state.leads.slice(-5).forEach(l=>{ const loc=byId(LIB.location_modules,l.text); s.push(loc?`move ${loc.name}`:`research ${l.text}`); });
  (LIB.trap_recipes||[]).slice(0,3).forEach(t=>s.push(`need ${t.name}`,`set trap ${t.name}`));
  s.push('list hq','who is available','list allies','dialogue Father Crowe','recruit Father Crowe','load llm','voice on','assistant suggest next steps','hide and wait','wait','attack with rock salt shells','dodge','brace','counter','combat status','commands combat','cast veil snap'); return [...new Set(s)].slice(0,26);
}

function render(){ if(!state || !LIB) return;
  $('campaignTag').textContent = campaignId==='local' ? 'Local Case' : `Campaign ${campaignId}`; $('versionTag').textContent='Pass 18';
  $('pressureMeter').style.width = `${Math.min(100,state.pressure/12*100)}%`; $('pressureText').textContent = `${state.pressure}/12 — ${pressureLevel().toUpperCase()}`;
  $('caseMode').value=state.mode||'solo'; $('diceMode').value=state.diceMode||'3d6'; $('seedStyle').value=state.seedStyle||'balanced';
  renderPlayers(); renderTranscript(); renderCaseBoard(); renderReadyPanel(); renderGraph(); renderModules(); renderCharacters(); renderPrivate(); renderCombat(); renderAllies(); renderVoiceSettings(); renderHelp(); renderDebug(); save();
}
function renderPlayers(){ const opts=state.players.map(p=>`<option value="${escapeAttr(p)}">${escapeHtml(p)}</option>`).join(''); $('activePlayer').innerHTML=opts; $('activePlayer').value=state.activePlayer||state.players[0]; $('privateViewPlayer').innerHTML=opts; if(!$('privateViewPlayer').value) $('privateViewPlayer').value=state.activePlayer||state.players[0]; $('playerList').innerHTML=state.players.map(p=>`<div class="item row spread"><b>${escapeHtml(p)}</b><span class="small">Private clues: ${(state.privateClues[p]||[]).length}</span></div>`).join(''); }
function renderTranscript(){ const box=$('transcript'); const combined=[...(state.publicLog||[]), ...ephemeralLog]; box.innerHTML=combined.map(m=>`<div class="msg ${m.type||''}"><div class="meta">${m.time} · ${escapeHtml(m.meta||'')}</div><div>${escapeHtml(m.text).replace(/\n/g,'<br>')}</div></div>`).join(''); box.scrollTop=box.scrollHeight; renderPartyNotes(); }
function renderPartyNotes(){ const el=$('partyNotesList'); if(!el) return; const notes=state.partyNotes||[]; el.innerHTML = notes.length ? notes.slice(-12).reverse().map(n=>`<div class="item small"><b>${escapeHtml(n.actor||'party')}</b> <span class="small">${escapeHtml(n.time||'')}</span><br>${escapeHtml(n.text||'')}</div>`).join('') : '<div class="item small">No shared party notes yet. Type <span class="kbd">note [text]</span> in the main command box.</div>'; }
function renderCaseBoard(){ const ent=state.graph.entity; $('caseSummary').innerHTML=[`<div class="item"><b>${escapeHtml(state.caseTitle)}</b><br><span class="small">Phase: ${state.phase} · Pressure: ${pressureLevel()} · Credits: ${state.credits} · Actions here: ${(state.actionClock&&state.actionClock.actionsHere)||0}</span></div>`, state.graph.theme?`<div class="item"><b>${escapeHtml(state.graph.theme.name)}</b><br><span class="small">${escapeHtml(state.graph.theme.season_pressure)}</span></div>`:'', state.graph.tarot?`<div class="item"><b>${state.graph.tarot.value} of ${state.graph.tarot.suit.name}</b><br><span class="small">${state.graph.tarot.major.name} · ${state.graph.tarot.orientation}</span></div>`:'', ent?`<div class="item"><b>Known Entity Theory</b><br><span class="small">${state.flags.weaknessRevealed?`${escapeHtml(ent.name)}: ${escapeHtml(ent.weakness)}`:'Entity not fully confirmed.'}</span></div>`:''].join(''); $('clueList').innerHTML=state.clues.length?state.clues.map(c=>`<div class="item small">${escapeHtml(c.text)}<br><em>${escapeHtml(c.source||'')}</em></div>`).join(''):'<div class="item small">No clues yet.</div>'; $('leadList').innerHTML=state.leads.length?state.leads.slice(-20).map(l=>`<div class="item small">${escapeHtml(l.text)}<br><em>${escapeHtml(l.source||'')}</em></div>`).join(''):'<div class="item small">No leads yet.</div>'; const loc=byId(state.graph.locations,state.currentLocation); $('currentLocationBox').innerHTML=loc?`<b>${escapeHtml(loc.name)}</b><br><span class="small">${escapeHtml(loc.description)}</span>`:'No location selected.'; $('suggestions').innerHTML=suggestions().map(s=>`<span class="suggestion" data-cmd="${escapeAttr(s)}">${escapeHtml(s)}</span>`).join(''); $('quickCommands').innerHTML=suggestions().map(s=>`<button class="btn ghost full quick" data-cmd="${escapeAttr(s)}">${escapeHtml(s)}</button>`).join(''); }
function renderGraph(){ $('locationList').innerHTML=state.graph.locations.map(l=>`<div class="item ${state.currentLocation===l.id?'active':''}"><b>${escapeHtml(l.name)}</b> ${state.unlockedLocations.includes(l.id)?'<span class="pill good">unlocked</span>':'<span class="pill">locked</span>'}<br><span class="small">${escapeHtml(l.description)}</span><div class="row" style="margin-top:6px"><button class="btn ghost quick" data-cmd="move ${escapeAttr(l.name)}">Move</button><button class="btn ghost quick" data-cmd="look ${escapeAttr(l.name)}">Look</button></div></div>`).join(''); const wardenCards=(state.graph.wardenAvailable||[]).map(a=>`<div class="item"><b>${escapeHtml(a.name)}</b> <span class="pill good">available Warden</span><br><span class="small">${escapeHtml(a.opening||'')}</span><br><span class="small">Role: ${escapeHtml(a.role||a.type||'Warden')}</span></div>`).join(''); const allyCards=(state.graph.allies||[]).map(a=>`<div class="item"><b>${escapeHtml(a.name)}</b> <span class="pill good">ally option</span><br><span class="small">${escapeHtml(a.opening||'')}</span><br><span class="small">Services: ${escapeHtml((a.services||[]).join(', '))}</span></div>`).join(''); const strangerCards=(state.graph.strangers||[]).map(s=>`<div class="item"><b>${escapeHtml(s.name)}</b> <span class="pill">stranger</span><br><span class="small">${escapeHtml((s.smalltalk||[])[0]||'small talk until a topic matters')}</span><br><span class="small">Topics: ${escapeHtml(Object.keys(s.topics||{}).join(', '))}</span></div>`).join(''); const ws=state.graph.witnesses.map(w=>`<div class="item"><b>${escapeHtml(w.name)}</b> <span class="pill">${escapeHtml(w.location_hint||'')}</span><br><span class="small">${escapeHtml(w.opening)}</span><br><span class="small">Topics: ${escapeHtml(Object.keys(w.topics||{}).join(', '))}</span></div>`).join(''); const ev=state.graph.evidence.map(e=>`<div class="item"><b>${escapeHtml(e.name)}</b> <span class="pill">${escapeHtml(e.location_hint||'')}</span><br><span class="small">${escapeHtml(e.surface)}</span></div>`).join(''); $('nodeList').innerHTML=ws+allyCards+wardenCards+strangerCards+ev; }
function renderModules(){ const stats=[['Locations',LIB.location_modules.length],['Witnesses',LIB.witness_modules.length],['Evidence',LIB.evidence_modules.length],['Entities',LIB.entity_modules.length],['Signs',LIB.sign_modules.length],['Prep',LIB.prep_modules.length],['Complications',LIB.complication_modules.length],['Campaign Themes',LIB.campaign_themes.length],['Items',(LIB.item_catalog||[]).length],['Materials',(LIB.material_catalog||[]).length],['Trap Recipes',(LIB.trap_recipes||[]).length],['Spells/Rites',(LIB.spell_catalog||[]).length],['Attack Options',(LIB.attack_options||[]).length],['NPC Ally Modules',(LIB.npc_ally_modules||[]).length],['Stranger Modules',(LIB.stranger_modules||[]).length],['Warden HQs',(LIB.warden_hq_modules||[]).length],['Warden Recruit Pool',(LIB.warden_recruit_pool||[]).length]]; $('moduleStats').innerHTML=stats.map(([k,v])=>`<div class="item center"><div class="kicker" style="letter-spacing:.12em">${k}</div><h1 style="font-size:42px">${v}</h1></div>`).join(''); }
function renderCharacters(){ $('characterList').innerHTML=state.characters.length?state.characters.map(c=>`<div class="item"><b>${escapeHtml(c.name||c.identity?.name||'Unnamed')}</b><br><span class="small">Skills: ${Array.isArray(c.skills)?c.skills.length:Object.keys(c.skills||{}).length}</span></div>`).join(''):'<div class="item small">No characters imported.</div>'; }
function renderPrivate(){ const p=$('privateViewPlayer').value||state.activePlayer||state.players[0]; const logs=state.privateLogs[p]||[]; $('privateLog').innerHTML=logs.map(m=>`<div class="msg private"><div class="meta">${m.time} · ${escapeHtml(m.meta||'')}</div><div>${escapeHtml(m.text).replace(/\n/g,'<br>')}</div></div>`).join('')||'<div class="msg private">No private branch logs yet.</div>'; const rows=[]; for(const pl of state.players){ for(const c of state.privateClues[pl]||[]) rows.push(`<div class="item"><b>${escapeHtml(pl)}</b>: ${escapeHtml(c.text)}<br><button class="btn ghost revealBtn" data-player="${escapeAttr(pl)}" data-clue="${escapeAttr(c.id)}">Reveal to Party</button></div>`); } $('privateRevealList').innerHTML=rows.join('')||'<div class="item small">No private clues to reveal.</div>'; }
function generalCommands(){ return ['GENERAL COMMANDS — all of these work from the main typed command box','ready','unready','ready status','cancel draw','force draw','look','look [location/evidence]','list witnesses','list strangers','list allies','list wardens','list hq','hq','hq refresh','call hq','who is available','profile [NPC/creature/Warden]','dialogue [NPC/creature/Warden]','talk [NPC]','ask [NPC] about [topic]','recruit [NPC/Warden]','load llm','structured fallback','voice on','voice off','npc voice on','test voice','stop voice','assistant suggest next steps','assistant prep checklist','opening transmission','allies act automatically after every 2 public non-combat player actions','list suspects','list locations','list traps','shop','buy [item/material]','inventory','need [trap/spell/attack]','move [location]','hide and wait','wait','clues','leads','reveal','commands','commands combat','SPLIT/PUBLIC: Riley: investigate altar; Sam: ask witness about bell','PRIVATE: private Alex: research black star symbol']; }
function combatCommands(){ return ['COMBAT COMMANDS','attack with [weapon/ammo]','shoot [entity] with rock salt shells','attack with silver rounds','cast [spell/rite]','set trap [trap name]','trigger trap [trap name]','combat status','dodge','brace','counter','protect [ally]','end turn','take hit','disengage / move [location]','NPC allies act once per round after the creature threat resolves','observe entity','taunt entity','parley entity','TACTIC: prep/position first or blind attacks increase pressure']; }
function renderHelp(){
  $('helpCommands').innerHTML = `<h3>General / Investigation</h3>` + generalCommands().slice(1).map(c=>`<div class="item"><span class="kbd">${escapeHtml(c)}</span></div>`).join('') + `<div class="divider"></div><h3>Combat</h3>` + combatCommands().slice(1).map(c=>`<div class="item"><span class="kbd">${escapeHtml(c)}</span></div>`).join('');
}
function renderCombat(){
  if(!$('combatPanel')) return;
  const c=state.combat||defaultCombat(); const ent=state.graph.entity;
  const minor=(state.actionClock?.minorDraws||[]).slice().reverse().map(d=>`<div class="item small"><b>${escapeHtml(d.value)} of ${escapeHtml(d.suit)}${d.reversed?' reversed':''}</b> +${d.inc}<br>${escapeHtml(d.reason)} — ${escapeHtml(d.effect)}</div>`).join('') || '<div class="item small">No automatic pressure draws yet.</div>';
  $('combatPanel').innerHTML = `<div class="grid cols2"><div class="card"><h2>Turn-Based Combat</h2><div class="item"><b>${c.active?'ACTIVE':'Not engaged'}</b><br><span class="small">Round ${c.round||0} · Turn: ${escapeHtml(c.turn||'players')} · Warden actions left: ${c.playerActionsRemaining==null?2:c.playerActionsRemaining}</span></div>${ent?`<div class="item"><b>${escapeHtml(ent.name)}</b><br><div class="meter"><span style="width:${c.entityMaxHp?Math.round((c.entityHp/c.entityMaxHp)*100):0}%"></span></div><span class="small">${c.entityHp||0}/${c.entityMaxHp||0} confrontation progress</span></div>`:''}${c.pendingThreat?`<div class="item"><b>Pending Threat</b><br>${escapeHtml(c.pendingThreat.move)} targeting ${escapeHtml(c.pendingThreat.target)}<br><span class="small">Respond with dodge, brace, counter, protect, or end turn.</span></div>`:''}<h3>Player States</h3>${Object.entries(c.playerStates||{}).map(([p,s])=>`<div class="item small"><b>${escapeHtml(p)}</b>: wounds ${s.wounds||0}, combat setbacks ${s.setbacks||0}<br>${escapeHtml((s.notes||[]).slice(-2).join('; '))}</div>`).join('')||'<div class="item small">No combat wounds tracked yet.</div>'}</div><div class="card"><h2>Automatic Pressure Draws</h2>${minor}</div></div>`;
}


function renderVoiceSettings(){
  const v=state.voiceSettings||{};
  if($('ttsEnabled')) $('ttsEnabled').checked=!!v.enabled;
  if($('ttsNpc')) $('ttsNpc').checked=v.npc!==false;
  if($('ttsTransmissions')) $('ttsTransmissions').checked=v.transmissions!==false;
  if($('autoOpener')) $('autoOpener').checked=v.autoOpener!==false;
  if($('llmOpener')) $('llmOpener').checked=v.llmOpener!==false;
  if($('ttsRate')) $('ttsRate').value=v.rate??0.92;
  if($('ttsPitch')) $('ttsPitch').value=v.pitch??0.94;
  if($('ttsVoiceQuality')) $('ttsVoiceQuality').value=v.voiceQuality||'natural';
  if($('ttsVoiceStyle')) $('ttsVoiceStyle').value=v.voiceStyle||'auto';
  if($('ttsVolume')) $('ttsVolume').value=v.volume??1;
  populateVoices();
  if($('ttsVoiceSelect') && v.voiceURI) $('ttsVoiceSelect').value=v.voiceURI;
  if($('ttsSupportStatus')) $('ttsSupportStatus').textContent = ('speechSynthesis' in window) ? 'Natural voice mode uses the best installed browser voice. Android usually prefers Google voices; iPhone uses installed Apple/Siri voices. If it sounds robotic, pick a starred voice or install enhanced system voices.' : 'Browser speech synthesis unavailable.';
}

function renderAllies(){
  if(!$('allyList')) return;
  const active=(state.allies||[]).map(a=>`<div class="item"><b>${escapeHtml(a.name)}</b> <span class="pill good">recruited</span><br><span class="small">${escapeHtml((a.services||[]).join(', ')||'field support')}</span><br><span class="small">Bonuses: ${escapeHtml(JSON.stringify(a.bonuses||{}))}</span></div>`).join('') || '<div class="item small">No allies recruited yet.</div>';
  const available=[...(state.graph.allies||[]),...(state.graph.wardenAvailable||[])].filter(a=>!recruited(a.id)).map(a=>`<div class="item"><b>${escapeHtml(a.name)}</b><br><span class="small">${escapeHtml(a.opening||'')}</span><br><span class="small">Recruitment: ${(a.recruitment?.requires_any||[]).map(id=>escapeHtml(LIB.clue_definitions[id]||id)).join(' OR ')||'available with trust'}</span><div class="row" style="margin-top:6px"><button class="btn ghost quick" data-cmd="recruit ${escapeAttr(a.name)}">Recruit</button><button class="btn ghost quick" data-cmd="ask ${escapeAttr(a.name)} about ${escapeAttr(Object.keys(a.topics||{})[0]||'help')}">Ask</button></div></div>`).join('') || '<div class="item small">No potential ally modules active in this case.</div>';
  const strangers=(state.graph.strangers||[]).map(s=>`<div class="item"><b>${escapeHtml(s.name)}</b> <span class="pill">small talk</span><br><span class="small">${escapeHtml((s.smalltalk||[])[0]||'')}</span><div class="row" style="margin-top:6px"><button class="btn ghost quick" data-cmd="talk ${escapeAttr(s.name)}">Talk</button><button class="btn ghost quick" data-cmd="ask ${escapeAttr(s.name)} about ${escapeAttr(Object.keys(s.topics||{})[0]||'rumors')}">Ask Topic</button></div></div>`).join('') || '<div class="item small">No strangers active in this case.</div>';
  const allyLog=(state.allyActionLog||[]).slice().reverse().map(x=>`<div class="item small"><b>${escapeHtml(x.ally)}</b>: ${escapeHtml(x.text)}<br><em>${escapeHtml(x.time)}</em></div>`).join('')||'<div class="item small">No automatic ally actions yet.</div>'; const hqCards=(state.graph.wardenHqs||[]).map(h=>`<div class="item"><b>${escapeHtml(h.name)}</b> <span class="pill good">HQ</span><br><span class="small">${escapeHtml(h.description||'')}</span><br><span class="small">Services: ${escapeHtml((h.services||[]).join(', '))}</span><div class="row" style="margin-top:6px"><button class="btn ghost quick" data-cmd="hq">Check Available Wardens</button><button class="btn ghost quick" data-cmd="hq refresh">Refresh Availability</button></div></div>`).join('')||'<div class="item small">No HQ modules active.</div>'; $('allyList').innerHTML = `<h3>Warden HQs</h3>${hqCards}<div class="divider"></div><h3>Recruited</h3>${active}<div class="divider"></div><h3>Automatic Ally Actions</h3>${allyLog}<div class="divider"></div><h3>Potential Allies</h3>${available}<div class="divider"></div><h3>Strangers / Small Talk</h3>${strangers}`;
  if($('assistantOutput') && state.assistantHistory) $('assistantOutput').innerHTML = state.assistantHistory.slice().reverse().map(x=>`<div class="msg"><div class="meta">${escapeHtml(x.time)} · ${escapeHtml(x.actor)}</div><b>${escapeHtml(x.prompt)}</b><br>${escapeHtml(x.answer).replace(/\n/g,'<br>')}</div>`).join('');
}

function renderDebug(){ $('debugJson').value=JSON.stringify(state,null,2); }

function bindUI(){
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.querySelectorAll('.tabPage').forEach(p=>p.classList.add('hidden')); $(`tab-${b.dataset.tab}`).classList.remove('hidden'); render(); }));
  $('newCaseBtn').onclick=()=>requestNewCaseDraw(state.activePlayer||'party'); $('saveBtn').onclick=()=>{save(); log('Case saved to this device.','system');};
  $('addPressureBtn').onclick=()=>drawMinorPressure('manual pressure draw'); $('reducePressureBtn').onclick=()=>adjustPressure(-1,'manual adjustment');
  $('runCommandBtn').onclick=()=>{ const raw=$('commandInput').value.trim(); if(!raw)return; for(const a of parseCommands(raw)) handleAction(a); $('commandInput').value=''; render(); };
  $('clearInputBtn').onclick=()=>$('commandInput').value='';
  $('caseMode').onchange=e=>{state.mode=e.target.value; save();}; $('diceMode').onchange=e=>{state.diceMode=e.target.value; save();}; $('seedStyle').onchange=e=>{state.seedStyle=e.target.value; save();}; $('activePlayer').onchange=e=>{state.activePlayer=e.target.value; save();}; $('privateViewPlayer').onchange=()=>renderPrivate();
  $('addPlayerBtn').onclick=()=>{addPlayer($('newPlayerName').value); $('newPlayerName').value='';};
  if($('assistantRunBtn')) $('assistantRunBtn').onclick=()=>runAssistant($('assistantPrompt').value||'suggest next steps', 'public', state.activePlayer||'party');
  if($('openerBtn')) $('openerBtn').onclick=()=>generateOpeningTransmission(false);
  if($('llmLoadBtn')) $('llmLoadBtn').onclick=async()=>{ try{ const model=$('llmModelSelect')?.value; $('llmStatus').textContent='Starting browser LLM...'; await window.NWLLMAdapter?.init?.({model}); }catch(e){ $('llmStatus').textContent='LLM failed to load. Structured fallback is still active.'; } };
  if($('llmClearBtn')) $('llmClearBtn').onclick=()=>{ if($('llmStatus')) $('llmStatus').textContent='Structured fallback selected. Reload page to unload model from memory.'; };
  ['ttsEnabled','ttsNpc','ttsTransmissions','autoOpener','llmOpener'].forEach(id=>{ if($(id)) $(id).onchange=e=>{ state.voiceSettings=state.voiceSettings||{}; const key={ttsEnabled:'enabled',ttsNpc:'npc',ttsTransmissions:'transmissions',autoOpener:'autoOpener',llmOpener:'llmOpener'}[id]; state.voiceSettings[key]=!!e.target.checked; save(); renderVoiceSettings(); }; });
  ['ttsRate','ttsPitch','ttsVolume'].forEach(id=>{ if($(id)) $(id).oninput=e=>{ state.voiceSettings=state.voiceSettings||{}; const key={ttsRate:'rate',ttsPitch:'pitch',ttsVolume:'volume'}[id]; state.voiceSettings[key]=Number(e.target.value); save(); }; });
  ['ttsVoiceQuality','ttsVoiceStyle'].forEach(id=>{ if($(id)) $(id).onchange=e=>{ state.voiceSettings=state.voiceSettings||{}; const key={ttsVoiceQuality:'voiceQuality',ttsVoiceStyle:'voiceStyle'}[id]; state.voiceSettings[key]=e.target.value; if(key==='voiceQuality' && e.target.value==='natural'){ state.voiceSettings.voiceURI=''; } save(); renderVoiceSettings(); }; });
  if($('ttsVoiceSelect')) $('ttsVoiceSelect').onchange=e=>{ state.voiceSettings=state.voiceSettings||{}; state.voiceSettings.voiceURI=e.target.value; save(); };
  if($('ttsTestBtn')) $('ttsTestBtn').onclick=()=>{ state.voiceSettings=state.voiceSettings||{}; state.voiceSettings.enabled=true; save(); renderVoiceSettings(); speakText('Night Wardens voice link established. Field transmission channel is live. Natural voice selection is active.', 'Field Transmission'); };
  if($('ttsStopBtn')) $('ttsStopBtn').onclick=()=>stopSpeech();
  if('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged=populateVoices;
  window.addEventListener('nw-llm-progress', e=>{ if($('llmStatus')) $('llmStatus').textContent=e.detail?.message||'LLM status updated.'; });
  const deviceInfo = window.NWLLMAdapter?.getDeviceInfo?.();
  if(deviceInfo && $('llmDeviceStatus')){
    $('llmDeviceStatus').textContent = `${deviceInfo.message} WebGPU: ${deviceInfo.hasWebGPU?'available':'not detected'}${deviceInfo.memoryGB?`; memory hint: ${deviceInfo.memoryGB}GB`:''}. Recommended model: ${deviceInfo.recommendation}.`;
    if($('llmModelSelect')) $('llmModelSelect').value = deviceInfo.recommendation;
  }
  document.body.addEventListener('click',e=>{ const q=e.target.closest('.quick,.suggestion'); if(q){$('commandInput').value=q.dataset.cmd; $('commandInput').focus();} const rb=e.target.closest('.revealBtn'); if(rb){ const pl=rb.dataset.player, clue=rb.dataset.clue; const arr=state.privateClues[pl]||[]; const i=arr.findIndex(c=>c.id===clue); if(i>=0){ const c=arr.splice(i,1)[0]; state.clues.push({...c,revealed:true}); log(`${pl} reveals: ${c.text}`,'clue','public','party','Reveal'); } } });
  $('exportBtn').onclick=()=>download(`night_wardens_autogm_case_${Date.now()}.json`,JSON.stringify(state,null,2));
  $('importCaseFile').onchange=e=>readFile(e.target.files[0],txt=>{state=JSON.parse(txt); save(); render(); log('Imported case JSON.','system');});
  $('importCharacterFile').onchange=e=>readFile(e.target.files[0],txt=>{ const c=JSON.parse(txt); state.characters.push(c); const name=c.name||c.identity?.name; if(name)addPlayer(name); save(); render(); log(`Imported character ${name||'Unnamed'}.`,'system');});
  $('loadDebugBtn').onclick=()=>{state=JSON.parse($('debugJson').value); save(); render();}; $('refreshDebugBtn').onclick=()=>renderDebug();
}
function readFile(file,cb){ if(!file)return; const r=new FileReader(); r.onload=()=>cb(r.result); r.readAsText(file); }
function download(name,text){ const blob=new Blob([text],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }
async function init(){ try{ const r=await fetch('auto_gm_modular_library.json?v=18.0'); if(r.ok) LIB=await r.json(); }catch(e){} if(!LIB){ document.body.innerHTML='<div class="wrap"><div class="card"><h1>Missing auto_gm_modular_library.json</h1></div></div>'; return; } load(); bindUI(); render(); try{ await window.NWAutoGMSync?.init?.({campaignId, campaignCode, caseId, getState:()=>state, setState:(remote)=>{ if(remote && remote.version){ state = remote; save(); render(); } }, onReadyUpdate:()=>renderReadyPanel(), onStatus:(msg)=>{ state.syncInfo=Object.assign({},state.syncInfo||{},{enabled:true,status:msg}); if($('syncTag')) $('syncTag').textContent=msg; renderReadyPanel(); }}); }catch(e){ console.warn('Auto-GM sync unavailable', e); } if(!state.publicLog.length) log('Auto-GM ready-up/sync layer online. In shared campaigns, New Modular Case starts a ready check when multiple real players are connected. Type “ready”, “ready status”, or “force draw”.', 'system'); }
init();
})();
