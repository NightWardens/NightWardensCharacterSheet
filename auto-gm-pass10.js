/* Night Wardens Auto-GM Pass 9 — Modular IF Engine
   Loads swappable modules, builds modular cases, supports deep topic chains, campaign/private play, and character-based rolls.
*/
(function(){
'use strict';
const VERSION='pass10-expanded-modular-if-v1';
const qs=new URLSearchParams(location.search);
const campaignId=qs.get('campaignId')||qs.get('campaign')||'local';
const campaignCode=qs.get('campaignCode')||qs.get('code')||'';
const caseId=qs.get('caseId')||'main';
const STORAGE_KEY=`nw_autogm_pass10_${campaignId}_${caseId}`;

let LIB=null;
let state=null;

const $=id=>document.getElementById(id);
const byId=(arr,id)=>arr.find(x=>x.id===id);
const now=()=>new Date().toLocaleTimeString();
const uid=(p='id')=>`${p}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`;
const cap=s=>(s||'').charAt(0).toUpperCase()+(s||'').slice(1);
const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
const sample=(arr,n)=>{const a=[...arr]; const out=[]; while(a.length&&out.length<n){out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]);} return out;};
const hasAny=(tags,needed)=>!needed||needed.length===0||needed.some(t=>(tags||[]).includes(t));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));

function log(msg,type='system',scope='public',player='party',meta='Auto-GM'){
  const entry={id:uid('msg'),time:now(),type,scope,player,meta,text:msg};
  if(scope==='private'){
    if(!state.privateLogs[player]) state.privateLogs[player]=[];
    state.privateLogs[player].push(entry);
  }else state.publicLog.push(entry);
  save(); render();
  return entry;
}
function addClue(clueId,scope='public',player='party',source=''){
  if(!clueId) return false;
  const text=LIB.clue_definitions[clueId]||clueId;
  const target=scope==='private'?state.privateClues[player]||(state.privateClues[player]=[]):state.clues;
  if(target.some(c=>c.id===clueId)) return false;
  target.push({id:clueId,text,source,time:now(),revealed:scope!=='private'});
  if(scope==='private') log(`Private clue added: ${text}`, 'clue','private',player, source||'Discovery');
  else log(`Clue added: ${text}`, 'clue','public','party', source||'Discovery');
  return true;
}
function unlockLocation(id,reason=''){
  if(!id) return false;
  if(state.unlockedLocations.includes(id)) return false;
  state.unlockedLocations.push(id);
  const loc=byId(state.graph.locations,id)||byId(LIB.location_modules,id);
  if(loc) log(`New location unlocked: ${loc.name}${reason?` — ${reason}`:''}`, 'system');
  return true;
}
function unlockTopic(nodeId,topic){
  if(!nodeId||!topic) return;
  state.unlockedTopics[nodeId]=state.unlockedTopics[nodeId]||[];
  if(!state.unlockedTopics[nodeId].includes(topic)) state.unlockedTopics[nodeId].push(topic);
}
function knows(clueId,player){
  if(state.clues.some(c=>c.id===clueId)) return true;
  return !!(player&&state.privateClues[player]||[]).some(c=>c.id===clueId);
}
function meets(reqs,player){
  if(!reqs||reqs.length===0) return true;
  return reqs.some(r=>knows(r,player)||state.unlockedLocations.includes(r.replace(/^loc_/,''))||state.flags[r]);
}
function pressureLevel(){const p=state.pressure; if(p<=0)return 'quiet'; if(p<=3)return 'low'; if(p<=6)return 'moderate'; if(p<=9)return 'high'; return 'crisis';}
function adjustPressure(n,why=''){
  state.pressure=clamp(state.pressure+n,0,12);
  if(n>0) log(`Pressure +${n}${why?`: ${why}`:''}`, 'system');
  if(n<0) log(`Pressure ${n}${why?`: ${why}`:''}`, 'system');
}

function rollDice(mode){const c=mode==='2d6'?2:3; const dice=Array.from({length:c},()=>1+Math.floor(Math.random()*6)); return {dice,total:dice.reduce((a,b)=>a+b,0)};}
function findChar(name){if(!name) return null; const n=norm(name); return state.characters.find(c=>norm(c.name||c.identity?.name||'')===n || norm(c.id||'')===n);}
function attrValue(ch,attr){ if(!ch) return 9; const a=ch.attributes||{}; const key=Object.keys(a).find(k=>norm(k)===norm(attr)); const v=key?a[key]:null; if(typeof v==='object') return Number(v.value||v.current||9); return Number(v||9); }
function skillRank(ch,skill){ if(!ch||!skill) return 0; const s=ch.skills||{}; if(Array.isArray(s)){ const found=s.find(x=>norm(x.name||x.skill)===norm(skill)); return found?Number(found.rank||found.value||1):0; } const key=Object.keys(s).find(k=>norm(k)===norm(skill)); const val=key?s[key]:0; return typeof val==='object'?Number(val.rank||val.value||1):Number(val||0); }
function profileForIntent(intent,target=''){
  const p={attribute:'Instinct',skill:'Awareness',support:['Investigation','Survival'],setback:0};
  if(['investigate','examine','search','look'].includes(intent)) return {...p,attribute:'Instinct',skill:'Investigation',support:['Awareness','Forensics']};
  if(['research','study','decode'].includes(intent)) return {...p,attribute:'Intellect',skill:'Research',support:['Occult Knowledge','Symbolism']};
  if(['ask','talk','interview'].includes(intent)) return {...p,attribute:'Charisma',skill:'Persuasion',support:['Insight','Investigation']};
  if(['prep','prepare','set'].includes(intent)) return {...p,attribute:'Intellect',skill:'Tinkering',support:['Crafting','Engineering']};
  if(['cast','ritual','ward','bind'].includes(intent)) return {...p,attribute:'Will',skill:'Ritual Casting',support:['Occult Knowledge','Focus'],setback:1};
  if(['attack','shoot','strike','stab'].includes(intent)) return {...p,attribute:target.match(/shoot|gun|fire|silver|salt/)?'Prowess':'Force',skill:target.match(/shoot|gun|fire|silver|salt/)?'Firearms':'Melee Combat',support:['Awareness','Weapon Handling'],setback:1};
  if(['move','go','sneak'].includes(intent)) return {...p,attribute:'Prowess',skill:intent==='sneak'?'Stealth':'Athletics',support:['Awareness','Survival']};
  return p;
}
function resolveRoll(action,profile){
  if(!$('autoRoll')?.checked) return {rolled:false,result:'narrative'};
  const ch=findChar(action.actor);
  const mode=state.diceMode||'3d6';
  const roll=rollDice(mode);
  let attr=attrValue(ch,profile.attribute);
  const primary=skillRank(ch,profile.skill);
  let supportOffset=0;
  for(const s of profile.support||[]) if(skillRank(ch,s)>0) supportOffset++;
  supportOffset=Math.min(2,supportOffset);
  const injurySetbacks=(ch?.conditions||[]).reduce((a,c)=>a+Number(c.setbacks||0),0);
  const sceneSetbacks=profile.setback+Math.max(0,Math.floor(state.pressure/4))+injurySetbacks;
  const finalTarget=attr+primary-Math.max(0,sceneSetbacks-supportOffset);
  const margin=finalTarget-roll.total;
  let tier='failure';
  if(mode==='3d6'&&roll.total<=4) tier='critical_success';
  else if(mode==='3d6'&&roll.total>=17) tier='critical_failure';
  else if(margin>=6) tier='critical_success';
  else if(margin>=4) tier='strong_success';
  else if(margin>=0) tier='success';
  else if(margin>=-2) tier='partial_failure';
  else if(margin>=-4) tier='failure';
  else tier='critical_failure';
  const success=['critical_success','strong_success','success'].includes(tier);
  const text=`${action.actor||'Warden'} rolls ${roll.dice.join('+')} = ${roll.total} vs ${finalTarget} (${profile.attribute} ${attr} + ${profile.skill} ${primary} - setbacks ${sceneSetbacks} + support offset ${supportOffset}). ${tier.replace('_',' ').toUpperCase()}.`;
  log(text,`roll ${success?'success':'fail'}`,action.privacy==='private'?'private':'public',action.actor||'party','Roll');
  return {rolled:true,success,tier,margin,total:roll.total,target:finalTarget,profile,character:ch};
}

async function init(){
  try{ const r=await fetch(`auto_gm_modular_library.json?v=10.0`); if(r.ok) LIB=await r.json(); }catch(e){}
  if(!LIB){ document.body.innerHTML='<div class="wrap"><div class="card"><h1>Missing auto_gm_modular_library.json</h1><p>Upload it beside auto-gm.html and auto-gm-pass10.js.</p></div></div>'; return; }
  load();
  bindUI();
  render();
  if(!state.publicLog.length) log('Auto-GM modular engine online. Type “look” or press New Modular Case.', 'system');
}
function newState(){
  return {version:VERSION,campaignId,campaignCode,caseId,mode:'solo',diceMode:'3d6',seedStyle:'balanced',pressure:0,phase:'seed',players:['Riley','Sam','Alex'],activePlayer:'Riley',characters:[],publicLog:[],privateLogs:{Riley:[],Sam:[],Alex:[]},privateClues:{},privateReveals:[],clues:[],leads:[],flags:{},preps:[],unlockedLocations:[],unlockedTopics:{},currentLocation:null,graph:{locations:[],witnesses:[],evidence:[],entity:null,signs:[],prep:[],complications:[],theme:null,tarot:null},caseTitle:'Unseeded Case'};
}
function load(){
  try{ const saved=localStorage.getItem(STORAGE_KEY); state=saved?JSON.parse(saved):newState(); }catch(e){state=newState();}
  if(!state.version) state.version=VERSION;
}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){}}
function buildCase(){
  const theme=pick(LIB.campaign_themes);
  const suitId=pick(Object.keys(LIB.tarot.minor_suits));
  const suit=LIB.tarot.minor_suits[suitId];
  const value=pick(LIB.tarot.values);
  const major=pick(LIB.tarot.majors);
  const style=$('seedStyle')?.value||state.seedStyle||'balanced';
  const tags=[...new Set([...(theme.tags||[]),suitId,suit.domain,...(suit.entity_tags||[]),...(style==='ritual'?['sigils','ritual','demon']:[]),...(style==='investigation'?['witness','records','blood']:[]),...(style==='combat'?['blades','predator','creature']:[])])];
  const score=m=>((m.tags||[]).filter(t=>tags.includes(t)).length)+(hasAny(m.tags,[suitId,suit.domain])?2:0);
  let locs=sample([...LIB.location_modules].sort((a,b)=>score(b)-score(a)).slice(0,12),6);
  if(!locs.some(l=>l.id==='abandoned_church')) locs[0]=byId(LIB.location_modules,'abandoned_church')||locs[0];
  let witnesses=sample([...LIB.witness_modules].sort((a,b)=>score(b)-score(a)).slice(0,10),5);
  let evidence=sample([...LIB.evidence_modules].sort((a,b)=>score(b)-score(a)).slice(0,12),7);
  let entities=[...LIB.entity_modules].sort((a,b)=>score(b)-score(a));
  const entity=entities[0]||pick(LIB.entity_modules);
  let signs=sample(LIB.sign_modules.filter(s=>hasAny(s.tags,entity.tags||tags)).concat(LIB.sign_modules),8);
  let prep=sample(LIB.prep_modules.filter(p=>hasAny(p.tags,[...(entity.tags||[]),...tags])).concat(LIB.prep_modules),6);
  let complications=sample(LIB.complication_modules.filter(c=>hasAny(c.tags,[...(entity.tags||[]),...tags])).concat(LIB.complication_modules),5);
  state.graph={theme,tarot:{major,suitId,suit,value,orientation:Math.random()<.25?'reversed':'upright'},locations:dedupe(locs),witnesses:dedupe(witnesses),evidence:dedupe(evidence),entity,signs:dedupe(signs),prep:dedupe(prep),complications:dedupe(complications)};
  state.caseTitle=`${value} of ${suit.name}: ${entity.name}`;
  state.phase='investigation'; state.pressure=1; state.clues=[]; state.leads=[]; state.preps=[]; state.flags={}; state.unlockedTopics={}; state.privateLogs={}; state.privateClues={}; state.privateReveals=[];
  state.players.forEach(p=>{state.privateLogs[p]=[]; state.privateClues[p]=[];});
  const start=state.graph.locations[0]; state.currentLocation=start.id; state.unlockedLocations=[start.id];
  // unlock location hints for starting witnesses/evidence if the location exists
  for(const w of state.graph.witnesses.slice(0,2)){ if(w.location_hint&&state.graph.locations.some(l=>l.id===w.location_hint)) unlockLocation(w.location_hint,'initial witness lead'); }
  log(`New modular case drawn: ${state.caseTitle}. Major pressure: ${major.name} (${state.graph.tarot.orientation}). ${state.graph.tarot.orientation==='reversed'?major.reversed:major.upright}`, 'system');
  log(`${suit.opening} The active campaign theme is ${theme.name}: ${theme.season_pressure}`, 'system');
  save(); render();
}
function dedupe(arr){const seen=new Set(); return arr.filter(x=>x&&!seen.has(x.id)&&seen.add(x.id));}

function parseCommands(raw){
  return raw.split(';').map(s=>s.trim()).filter(Boolean).map(part=>{
    let privacy='public'; let actor='party'; let text=part;
    const pm=part.match(/^(private|public)\s+([^:]+):\s*(.+)$/i);
    const am=part.match(/^([^:]+):\s*(.+)$/i);
    if(pm){privacy=pm[1].toLowerCase(); actor=pm[2].trim(); text=pm[3].trim();}
    else if(am){actor=am[1].trim(); text=am[2].trim();}
    const n=norm(text);
    const intentMap=[['look',['look','observe']],['clues',['clues','case board']],['leads',['leads','suggestions']],['move',['go','move','travel','enter']],['ask',['ask','talk','interview','question']],['research',['research','study','decode','lookup','cross reference']],['investigate',['investigate','examine','search','inspect','analyze']],['prep',['prep','prepare','set up','ready','build','repair']],['cast',['cast','ritual','ward','bind','exorcise']],['attack',['attack','shoot','stab','strike','fight','confront']],['wait',['wait','listen']],['reveal',['reveal','share']]];
    let intent='unknown'; let verb='';
    for(const [k,vs] of intentMap){ const found=vs.find(v=>n.startsWith(v)); if(found){intent=k; verb=found; break;} }
    let rest=n.replace(new RegExp('^'+verb.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\s*'), '').trim();
    let topic=''; let target=rest;
    const about=rest.match(/^(.+?)\s+(?:about|regarding|on)\s+(.+)$/);
    if(about){target=about[1].replace(/^(to|with)\s+/,'').trim(); topic=about[2].trim();}
    target=target.replace(/^(to|at|in|into|with|the|a|an)\s+/,'').trim();
    return {raw:part,privacy,actor,intent,verb,target,topic,text};
  });
}
function findNode(query,types=['location','witness','evidence','prep','entity']){
  const q=norm(query); if(!q) return null;
  const pools=[];
  if(types.includes('location')) pools.push(...state.graph.locations.map(x=>({...x,_type:'location'})));
  if(types.includes('witness')) pools.push(...state.graph.witnesses.map(x=>({...x,_type:'witness'})));
  if(types.includes('evidence')) pools.push(...state.graph.evidence.map(x=>({...x,_type:'evidence'})));
  if(types.includes('prep')) pools.push(...state.graph.prep.map(x=>({...x,_type:'prep'})));
  if(types.includes('entity')&&state.graph.entity) pools.push({...state.graph.entity,_type:'entity'});
  let best=null,score=0;
  for(const n of pools){
    const names=[n.name,n.id,...(n.aliases||[])].map(norm);
    let s=0;
    for(const name of names){ if(name===q) s+=10; else if(name.includes(q)||q.includes(name)) s+=6; else for(const part of q.split(' ')) if(part.length>2&&name.includes(part)) s+=1; }
    if(s>score){score=s; best=n;}
  }
  return score>0?best:null;
}
function findTopic(node,topic){
  if(!node?.topics) return null;
  const q=norm(topic); if(!q) return null;
  let bestKey=null,score=0;
  for(const key of Object.keys(node.topics)){
    const nk=norm(key); let s=0;
    if(nk===q) s=10; else if(nk.includes(q)||q.includes(nk)) s=6; else for(const part of q.split(' ')) if(part.length>2&&nk.includes(part)) s++;
    if(s>score){score=s; bestKey=key;}
  }
  return bestKey;
}
function handleAction(action){
  if(action.privacy==='private' && !state.players.includes(action.actor)) addPlayer(action.actor);
  if(action.intent==='unknown') return log(`I do not understand: “${action.text}”. Try “look”, “ask [witness] about [topic]”, “investigate [thing]”, “research [topic]”, “prep [tool]”, or “move [location]”.`, 'system', action.privacy, action.actor);
  if(action.intent==='look') return doLook(action);
  if(action.intent==='clues') return doClues(action);
  if(action.intent==='leads') return doLeads(action);
  if(action.intent==='move') return doMove(action);
  if(action.intent==='ask') return doAsk(action);
  if(action.intent==='research') return doResearch(action);
  if(action.intent==='investigate') return doInvestigate(action);
  if(action.intent==='prep') return doPrep(action);
  if(action.intent==='cast') return doCast(action);
  if(action.intent==='attack') return doAttack(action);
  if(action.intent==='wait') return doWait(action);
  if(action.intent==='reveal') return doReveal(action);
}
function doLook(action){
  const targetNode=findNode(action.target||state.currentLocation) || byId(state.graph.locations,state.currentLocation);
  if(!targetNode) return log('There is nothing useful to look at yet. Start a new modular case.', 'system', action.privacy, action.actor);
  let text=`${targetNode.name}: ${targetNode.description||targetNode.opening||targetNode.surface||targetNode.effect||''}`;
  if(targetNode._type==='location'||state.graph.locations.some(l=>l.id===targetNode.id)){
    const loc=byId(state.graph.locations,targetNode.id)||targetNode;
    const hereWitnesses=state.graph.witnesses.filter(w=>w.location_hint===loc.id).map(w=>w.name);
    const hereEvidence=state.graph.evidence.filter(e=>e.location_hint===loc.id).map(e=>e.name);
    if(hereWitnesses.length) text+=` Witnesses here: ${hereWitnesses.join(', ')}.`;
    if(hereEvidence.length) text+=` Evidence here: ${hereEvidence.join(', ')}.`;
    if(loc.exits?.length) text+=` Possible exits/leads: ${loc.exits.map(id=>byId(LIB.location_modules,id)?.name||id).join(', ')}.`;
  }
  log(text,'system',action.privacy,action.actor,'Look');
}
function doClues(action){
  const pub=state.clues.map(c=>`• ${c.text}`).join('\n')||'No public clues yet.';
  const priv=(state.privateClues[action.actor]||[]).map(c=>`• ${c.text}`).join('\n');
  log(`Known clues:\n${pub}${priv?`\nPrivate clues for ${action.actor}:\n${priv}`:''}`,'system',action.privacy,action.actor,'Case Board');
}
function doLeads(action){ log(`Suggested leads: ${suggestions().join('; ')}`, 'system', action.privacy, action.actor, 'Leads'); }
function doMove(action){
  const node=findNode(action.target,['location']);
  if(!node) return log(`I cannot find a location matching “${action.target}”.`, 'system', action.privacy, action.actor);
  if(!state.unlockedLocations.includes(node.id)){
    const loc=byId(LIB.location_modules,node.id)||node;
    if(!meets(loc.requires_any,action.actor)) return log(`${node.name} is not accessible yet. Find a lead that points there first.`, 'system', action.privacy, action.actor);
    unlockLocation(node.id,'requirements met');
  }
  state.currentLocation=node.id;
  const prof=profileForIntent('move',node.name); const rr=resolveRoll(action,prof);
  log(`${action.actor||'The party'} moves to ${node.name}. ${node.description||''}`, 'system', action.privacy, action.actor,'Move');
  maybeCreature(action,rr);
}
function doAsk(action){
  let witness=findNode(action.target,['witness']);
  if(!witness) witness=state.graph.witnesses.find(w=>w.location_hint===state.currentLocation);
  if(!witness) return log(`No available witness matches “${action.target}”.`, 'system', action.privacy, action.actor);
  const prof=profileForIntent('ask',witness.name); const rr=resolveRoll(action,prof);
  const topicKey=findTopic(witness,action.topic||action.target)||Object.keys(witness.topics||{})[0];
  const topic=witness.topics?.[topicKey];
  if(!topic) return log(`${witness.name} has nothing useful to say yet. Try another topic.`, 'system', action.privacy, action.actor);
  if(!meets(topic.requires_any,action.actor)){
    adjustPressure(1,`${witness.name} guards the topic`);
    return log(`${witness.name} flinches from that subject. You need more leverage before they will speak about ${topicKey}.`, 'system', action.privacy, action.actor, 'Witness');
  }
  let response=topic.response;
  if(rr.tier==='critical_failure'||rr.tier==='failure'){
    response=`${witness.name} hesitates, contradicts themself, or withholds part of the truth. ${response}`; adjustPressure(1,'questioning raises suspicion');
  }
  log(`${witness.name} on ${topicKey}: ${response}`, 'system', action.privacy, action.actor, 'Witness');
  (topic.clues||[]).forEach(c=>addClue(c,action.privacy,action.actor,`${witness.name}: ${topicKey}`));
  (topic.unlocks_topics||[]).forEach(t=>unlockTopic(witness.id,t));
  (topic.unlocks_locations||[]).forEach(l=>unlockLocation(l,`${witness.name} mentioned it`));
  (topic.unlocks||[]).forEach(u=>state.leads.pushUnique?null:0);
  addLeads(topic.unlocks_topics,`${witness.name}`); addLeads(topic.unlocks,`${witness.name}`);
  maybeCreature(action,rr);
}
function doResearch(action){
  const prof=profileForIntent('research',action.target); const rr=resolveRoll(action,prof);
  const evidence=findNode(action.target,['evidence']);
  const topic=norm(action.target||action.topic);
  if(evidence){ return revealEvidence(evidence,action,rr,'research'); }
  const hits=[];
  for(const e of state.graph.evidence){ const terms=[e.name,e.id,...(e.aliases||[]),...(e.tags||[])].map(norm).join(' '); if(terms.includes(topic)||topic.split(' ').some(p=>p.length>2&&terms.includes(p))) hits.push(e); }
  if(hits.length){ revealEvidence(hits[0],action,rr,'research'); }
  else {
    const ent=state.graph.entity;
    let text=`Research on ${action.target||'the case'} cross-references ${state.graph.tarot.suit.name}, ${state.graph.tarot.major.name}, and ${ent.type}.`;
    if(rr.success){ text+=` It points toward ${ent.signs.slice(0,2).join(' and ')} as useful confirmation signs.`; addLeads(ent.signs,'research'); }
    else { text+=' The records conflict, creating a false lead unless another clue confirms it.'; adjustPressure(1,'false research lead'); }
    log(text,'system',action.privacy,action.actor,'Research');
  }
  maybeCreature(action,rr);
}
function doInvestigate(action){
  const node=findNode(action.target,['evidence','location','witness']);
  const prof=profileForIntent('investigate',action.target); const rr=resolveRoll(action,prof);
  if(node?.surface||node?.deep||node?.hidden) return revealEvidence(node,action,rr,'investigation');
  if(node?.description){
    const loc=byId(state.graph.locations,node.id)||node;
    log(`${action.actor||'Warden'} investigates ${loc.name}. ${(loc.surface_clues||[])[0]||loc.description}`, 'system', action.privacy, action.actor,'Investigation');
    if(rr.success && loc.hidden_clues?.length) log(`Deeper read: ${pick(loc.hidden_clues)}`, 'system', action.privacy, action.actor,'Investigation');
    if(rr.success) addLeads([...(loc.exits||[]),...(loc.suggestions||[])],loc.name);
    else adjustPressure(1,'missed detail');
  } else {
    const sign=pick(state.graph.signs);
    log(`Investigation turns up a sign: ${sign.surface} ${rr.success?sign.deep:''}`, 'system', action.privacy, action.actor,'Investigation');
    if(rr.success) addLeads(sign.points_to,sign.name); else adjustPressure(1,'uncertain sign');
  }
  maybeCreature(action,rr);
}
function revealEvidence(e,action,rr,source){
  let layer='surface'; if(rr.tier==='strong_success'||rr.tier==='critical_success') layer='hidden'; else if(rr.success) layer='deep';
  const text=e[layer]||e.deep||e.surface||`You learn something useful about ${e.name}.`;
  log(`${e.name}: ${text}`, 'system', action.privacy, action.actor, cap(source));
  (e.clues||[]).slice(0,layer==='surface'?1:99).forEach(c=>addClue(c,action.privacy,action.actor,e.name));
  if(layer!=='surface'){ (e.unlocks||[]).forEach(u=>{ if(byId(LIB.location_modules,u)) unlockLocation(u,`${e.name} points there`); }); addLeads(e.unlocks,e.name); }
}
function doPrep(action){
  const prep=findNode(action.target,['prep']) || state.graph.prep.find(p=>norm(p.name).includes(norm(action.target))||norm(action.target).includes(norm(p.name)));
  const prof=profileForIntent('prep',action.target); const rr=resolveRoll(action,prof);
  if(!prep) return log(`That preparation is not in the current case kit yet. Try: ${state.graph.prep.map(p=>p.name).join(', ')}.`, 'system', action.privacy, action.actor);
  if(!state.preps.includes(prep.id)) state.preps.push(prep.id);
  log(`${action.actor||'The party'} prepares ${prep.name}. ${prep.effect} ${rr.success?'The setup holds.':'It is unstable and may add a complication later.'}`, 'system', action.privacy, action.actor,'Prep');
  if(rr.success) adjustPressure(-1,`${prep.name} stabilizes the hunt`); else adjustPressure(1,`${prep.name} is unstable`);
}
function doCast(action){
  const prof=profileForIntent('cast',action.target); const rr=resolveRoll(action,prof);
  if(rr.success){
    const sign=pick(state.graph.signs);
    log(`${action.actor||'Warden'} works the rite. The veil answers with ${sign.name}: ${sign.deep}`, 'system', action.privacy, action.actor,'Occult');
    addLeads(sign.points_to,sign.name);
    if(action.text.includes('silence')||action.text.includes('ward')){ const p=byId(LIB.prep_modules,'silence_ward'); if(p&&!state.preps.includes(p.id)) state.preps.push(p.id); }
  } else { log(`The rite pulls wrong. Backlash stains the scene and something notices.`, 'system', action.privacy, action.actor,'Occult'); adjustPressure(2,'ritual backlash'); }
  maybeCreature(action,rr);
}
function doAttack(action){
  const ent=state.graph.entity; const prof=profileForIntent('attack',action.text); const rr=resolveRoll(action,prof);
  const hasPrep=state.preps.some(pid=>(byId(LIB.prep_modules,pid)?.tags||[]).some(t=>(ent.tags||[]).includes(t))) || state.clues.some(c=>/weakness|silence|iron|exorcism|fire|bell/i.test(c.text));
  if(!hasPrep){ log(`The attack hits the wrong layer of the problem. ${ent.name} reacts, but the kill condition is not satisfied: ${ent.kill_condition}`, 'system', action.privacy, action.actor,'Confrontation'); adjustPressure(2,'blind attack'); }
  else if(rr.success){ log(`The prepared strike matters. ${ent.name} is forced into a vulnerable state. Weakness: ${ent.weakness}. Kill condition: ${ent.kill_condition}`, 'system', action.privacy, action.actor,'Confrontation'); state.flags.weaknessRevealed=true; state.flags.killConditionRevealed=true; }
  else { log(`${ent.name} turns the failed attack into pressure. ${pick(ent.actions)}.`, 'system', action.privacy, action.actor,'Confrontation'); adjustPressure(2,'failed confrontation'); }
  maybeCreature(action,rr,true);
}
function doWait(action){ adjustPressure(1,'time passes'); log(`Time passes. The case pressure is now ${pressureLevel()}.`, 'system', action.privacy, action.actor,'Time'); maybeCreature(action,{success:false,tier:'partial_failure'}); }
function doReveal(action){
  const priv=state.privateClues[action.actor]||[];
  if(!priv.length) return log(`${action.actor} has no private clues to reveal.`, 'system', action.privacy, action.actor);
  const c=priv.shift(); state.clues.push({...c,revealed:true});
  log(`${action.actor} reveals a private discovery to the team: ${c.text}`, 'clue','public','party','Reveal');
}
function maybeCreature(action,rr,forced=false){
  if(!$('creatureResponse')?.checked && !forced) return;
  if(!forced && rr?.success && Math.random()>.25) return;
  const ent=state.graph.entity; if(!ent) return;
  const pressure=pressureLevel();
  let act=pick(ent.actions||['watch']);
  if(pressure==='high'||pressure==='crisis') act=pick((ent.actions||[]).concat(['attack directly','isolate a Warden','advance the ritual','compromise the location']));
  const sign=pick(state.graph.signs.filter(s=>hasAny(s.tags,ent.tags||[])).concat(state.graph.signs));
  const msg=`Threat response — ${ent.name}: it ${act}. It leaves a sign: ${sign.surface}`;
  if(action.privacy==='private') log(msg,'system','private',action.actor,'Threat'); else log(msg,'system','public','party','Threat');
  if(!rr?.success || forced) adjustPressure(1,`${ent.name} advances`);
}
function addLeads(leads,source=''){
  (leads||[]).filter(Boolean).forEach(l=>{ const text=String(l); if(!state.leads.some(x=>x.text===text)) state.leads.push({id:uid('lead'),text,source,time:now()}); });
}
function suggestions(){
  const loc=byId(state.graph.locations,state.currentLocation);
  let s=['look','clues'];
  if(loc){ s=s.concat((loc.suggestions||[]));
    state.graph.witnesses.filter(w=>w.location_hint===loc.id).forEach(w=>{ const keys=Object.keys(w.topics||{}).slice(0,3); keys.forEach(k=>s.push(`ask ${w.name} about ${k}`)); });
    state.graph.evidence.filter(e=>e.location_hint===loc.id).forEach(e=>s.push(`investigate ${e.name}`));
  }
  state.leads.slice(-5).forEach(l=>{ if(byId(LIB.location_modules,l.text)) s.push(`move ${byId(LIB.location_modules,l.text).name}`); else s.push(`research ${l.text}`); });
  state.graph.prep.slice(0,3).forEach(p=>s.push(`prep ${p.name}`));
  return [...new Set(s)].slice(0,18);
}
function addPlayer(name){name=(name||'').trim(); if(!name)return; if(!state.players.includes(name)) state.players.push(name); state.privateLogs[name]=state.privateLogs[name]||[]; state.privateClues[name]=state.privateClues[name]||[]; save(); render();}

function render(){ if(!state||!LIB)return;
  $('campaignTag').textContent=campaignId==='local'?'Local Case':`Campaign ${campaignId}`;
  $('versionTag').textContent='Pass 9';
  $('pressureMeter').style.width=`${Math.min(100,state.pressure/12*100)}%`;
  $('pressureText').textContent=`${state.pressure}/12 — ${pressureLevel().toUpperCase()}`;
  $('caseMode').value=state.mode||'solo'; $('diceMode').value=state.diceMode||'3d6'; $('seedStyle').value=state.seedStyle||'balanced';
  renderPlayers(); renderTranscript(); renderCaseBoard(); renderGraph(); renderModules(); renderCharacters(); renderPrivate(); renderHelp(); renderDebug(); save();
}
function renderPlayers(){
  const opts=state.players.map(p=>`<option value="${p}">${p}</option>`).join('');
  $('activePlayer').innerHTML=opts; $('activePlayer').value=state.activePlayer||state.players[0];
  $('privateViewPlayer').innerHTML=opts; if(!$('privateViewPlayer').value) $('privateViewPlayer').value=state.activePlayer||state.players[0];
  $('playerList').innerHTML=state.players.map(p=>`<div class="item row spread"><b>${p}</b><span class="small">Private clues: ${(state.privateClues[p]||[]).length}</span></div>`).join('');
}
function renderTranscript(){
  const box=$('transcript');
  box.innerHTML=state.publicLog.map(m=>`<div class="msg ${m.type||''}"><div class="meta">${m.time} · ${m.meta||''}</div><div>${escapeHtml(m.text).replace(/\n/g,'<br>')}</div></div>`).join(''); box.scrollTop=box.scrollHeight;
}
function renderCaseBoard(){
  const ent=state.graph.entity;
  $('caseSummary').innerHTML=[
    `<div class="item"><b>${escapeHtml(state.caseTitle)}</b><br><span class="small">Phase: ${state.phase} · Pressure: ${pressureLevel()}</span></div>`,
    state.graph.theme?`<div class="item"><b>${state.graph.theme.name}</b><br><span class="small">${state.graph.theme.season_pressure}</span></div>`:'',
    state.graph.tarot?`<div class="item"><b>${state.graph.tarot.value} of ${state.graph.tarot.suit.name}</b><br><span class="small">${state.graph.tarot.major.name} · ${state.graph.tarot.orientation}</span></div>`:'',
    ent?`<div class="item"><b>Known Entity Theory</b><br><span class="small">${state.flags.weaknessRevealed?`${ent.name}: ${ent.weakness}`:'Entity not fully confirmed.'}</span></div>`:''
  ].join('');
  $('clueList').innerHTML=(state.clues.length?state.clues.map(c=>`<div class="item small">${escapeHtml(c.text)}<br><em>${c.source||''}</em></div>`).join(''):'<div class="item small">No clues yet.</div>');
  $('leadList').innerHTML=(state.leads.length?state.leads.slice(-20).map(l=>`<div class="item small">${escapeHtml(l.text)}<br><em>${l.source||''}</em></div>`).join(''):'<div class="item small">No leads yet.</div>');
  const loc=byId(state.graph.locations,state.currentLocation);
  $('currentLocationBox').innerHTML=loc?`<b>${loc.name}</b><br><span class="small">${loc.description}</span>`:'No location selected.';
  $('suggestions').innerHTML=suggestions().map(s=>`<span class="suggestion" data-cmd="${escapeAttr(s)}">${escapeHtml(s)}</span>`).join('');
  $('quickCommands').innerHTML=suggestions().map(s=>`<button class="btn ghost full quick" data-cmd="${escapeAttr(s)}">${escapeHtml(s)}</button>`).join('');
}
function renderGraph(){
  $('locationList').innerHTML=state.graph.locations.map(l=>`<div class="item ${state.currentLocation===l.id?'active':''}"><b>${l.name}</b> ${state.unlockedLocations.includes(l.id)?'<span class="pill good">unlocked</span>':'<span class="pill">locked</span>'}<br><span class="small">${l.description}</span><div class="row" style="margin-top:6px"><button class="btn ghost quick" data-cmd="move ${escapeAttr(l.name)}">Move</button><button class="btn ghost quick" data-cmd="look ${escapeAttr(l.name)}">Look</button></div></div>`).join('');
  const ws=state.graph.witnesses.map(w=>`<div class="item"><b>${w.name}</b> <span class="pill">${w.location_hint||''}</span><br><span class="small">${w.opening}</span><br><span class="small">Topics: ${Object.keys(w.topics||{}).join(', ')}</span></div>`).join('');
  const ev=state.graph.evidence.map(e=>`<div class="item"><b>${e.name}</b> <span class="pill">${e.location_hint||''}</span><br><span class="small">${e.surface}</span></div>`).join('');
  $('nodeList').innerHTML=ws+ev;
}
function renderModules(){
  const stats=[['Locations',LIB.location_modules.length],['Witnesses',LIB.witness_modules.length],['Evidence',LIB.evidence_modules.length],['Entities',LIB.entity_modules.length],['Signs',LIB.sign_modules.length],['Prep',LIB.prep_modules.length],['Complications',LIB.complication_modules.length],['Campaign Themes',LIB.campaign_themes.length]];
  $('moduleStats').innerHTML=stats.map(([k,v])=>`<div class="item center"><div class="kicker" style="letter-spacing:.12em">${k}</div><h1 style="font-size:42px">${v}</h1></div>`).join('');
}
function renderCharacters(){
  $('characterList').innerHTML=state.characters.length?state.characters.map(c=>`<div class="item"><b>${escapeHtml(c.name||c.identity?.name||'Unnamed')}</b><br><span class="small">Skills: ${Array.isArray(c.skills)?c.skills.length:Object.keys(c.skills||{}).length}</span></div>`).join(''):'<div class="item small">No characters imported.</div>';
}
function renderPrivate(){
  const p=$('privateViewPlayer').value||state.activePlayer||state.players[0]; const logs=state.privateLogs[p]||[];
  $('privateLog').innerHTML=logs.map(m=>`<div class="msg private"><div class="meta">${m.time} · ${m.meta||''}</div><div>${escapeHtml(m.text).replace(/\n/g,'<br>')}</div></div>`).join('')||'<div class="msg private">No private branch logs yet.</div>';
  const rows=[];
  for(const pl of state.players){ for(const c of state.privateClues[pl]||[]) rows.push(`<div class="item"><b>${pl}</b>: ${escapeHtml(c.text)}<br><button class="btn ghost revealBtn" data-player="${escapeAttr(pl)}" data-clue="${escapeAttr(c.id)}">Reveal to Party</button></div>`); }
  }
  $('privateRevealList').innerHTML=rows.join('')||'<div class="item small">No private clues to reveal.</div>';
}
function renderHelp(){
  const cmds=['look','look church basement','move church basement','ask Mrs Harlan about her son','ask Mrs Harlan about meetings','investigate bell chain','research black star symbol','prep silence ward','cast veil snap on inverted bell','attack entity','private Alex: sneak into lower room','Riley: investigate altar; Sam: talk survivor; Alex: prep salt line','reveal'];
  $('helpCommands').innerHTML=cmds.map(c=>`<div class="item"><span class="kbd">${escapeHtml(c)}</span></div>`).join('');
}
function renderDebug(){ $('debugJson').value=JSON.stringify(state,null,2); }
function escapeHtml(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function escapeAttr(s){return escapeHtml(s).replace(/"/g,'&quot;');}

function bindUI(){
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.querySelectorAll('.tabPage').forEach(p=>p.classList.add('hidden')); $(`tab-${b.dataset.tab}`).classList.remove('hidden'); render();}));
  $('newCaseBtn').onclick=()=>buildCase(); $('saveBtn').onclick=()=>{save(); log('Case saved to this device.','system');};
  $('addPressureBtn').onclick=()=>adjustPressure(1,'manual adjustment'); $('reducePressureBtn').onclick=()=>adjustPressure(-1,'manual adjustment');
  $('runCommandBtn').onclick=()=>{ const raw=$('commandInput').value.trim(); if(!raw)return; for(const a of parseCommands(raw)) handleAction(a); $('commandInput').value=''; render(); };
  $('clearInputBtn').onclick=()=>$('commandInput').value='';
  $('caseMode').onchange=e=>{state.mode=e.target.value; save();}; $('diceMode').onchange=e=>{state.diceMode=e.target.value; save();}; $('seedStyle').onchange=e=>{state.seedStyle=e.target.value; save();}; $('activePlayer').onchange=e=>{state.activePlayer=e.target.value; save();}; $('privateViewPlayer').onchange=()=>renderPrivate();
  $('addPlayerBtn').onclick=()=>{addPlayer($('newPlayerName').value); $('newPlayerName').value='';};
  document.body.addEventListener('click',e=>{ const q=e.target.closest('.quick,.suggestion'); if(q){$('commandInput').value=q.dataset.cmd; $('commandInput').focus();} const rb=e.target.closest('.revealBtn'); if(rb){ const pl=rb.dataset.player, clue=rb.dataset.clue; const arr=state.privateClues[pl]||[]; const i=arr.findIndex(c=>c.id===clue); if(i>=0){ const c=arr.splice(i,1)[0]; state.clues.push({...c,revealed:true}); log(`${pl} reveals: ${c.text}`,'clue','public','party','Reveal'); } }});
  $('exportBtn').onclick=()=>download(`night_wardens_autogm_case_${Date.now()}.json`,JSON.stringify(state,null,2));
  $('importCaseFile').onchange=e=>readFile(e.target.files[0],txt=>{state=JSON.parse(txt); save(); render(); log('Imported case JSON.','system');});
  $('importCharacterFile').onchange=e=>readFile(e.target.files[0],txt=>{ const c=JSON.parse(txt); state.characters.push(c); const name=c.name||c.identity?.name; if(name)addPlayer(name); save(); render(); log(`Imported character ${name||'Unnamed'}.`,'system');});
  $('loadDebugBtn').onclick=()=>{state=JSON.parse($('debugJson').value); save(); render();}; $('refreshDebugBtn').onclick=()=>renderDebug();
}
function readFile(file,cb){ if(!file)return; const r=new FileReader(); r.onload=()=>cb(r.result); r.readAsText(file); }
function download(name,text){ const blob=new Blob([text],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }

if(!Array.prototype.pushUnique){Object.defineProperty(Array.prototype,'pushUnique',{value:function(v){if(!this.includes(v))this.push(v);return this.length;},enumerable:false});}
init();
})();
