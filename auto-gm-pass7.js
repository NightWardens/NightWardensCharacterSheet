/* Night Wardens Auto-GM Pass 7 — Website Integration
   Combines parser, roll engine, witness/investigation, creature AI, and shared/private campaign layer into one static-page app.
   No external dependencies. GitHub Pages friendly.
*/
(function(){
'use strict';

const VERSION = 'pass7-website-integration-v1';
const qs = new URLSearchParams(location.search);
const campaignId = qs.get('campaignId') || qs.get('campaign') || 'local';
const campaignCode = qs.get('campaignCode') || qs.get('code') || '';
const caseId = qs.get('caseId') || 'main';
const STORAGE_KEY = `nw_autogm_pass7_${campaignId}_${caseId}`;

const DATA = {
  commandExamples: [
    'look', 'Riley: investigate altar', 'Sam: ask Mrs Harlan about the bell',
    'private Alex: research black star symbol', 'Riley: prep salt line; Sam: cast Veil Snap',
    'Alex: move church basement', 'Riley: shoot the demon with silver', 'private Morgan: reveal clue 1'
  ],
  attributes: ['Force','Prowess','Intellect','Instinct','Will','Charisma','Endurance','Grit','Tinkering'],
  skills: {
    Investigation:{attribute:'Intellect',supports:['Awareness','Forensics','Occult Knowledge'],use:'Search scenes, connect clues, narrow entity possibilities.'},
    Awareness:{attribute:'Instinct',supports:['Investigation','Survival'],use:'Notice danger, anomalies, hidden movement, and ambush conditions.'},
    Research:{attribute:'Intellect',supports:['Occult Knowledge','History','Symbolism'],use:'Gather information, records, lore, patterns.'},
    'Occult Knowledge':{attribute:'Intellect',supports:['Research','Ritual Analysis','Symbolism'],use:'Identify supernatural signs, rituals, and likely weaknesses.'},
    Symbolism:{attribute:'Intellect',supports:['Research','Occult Knowledge'],use:'Decode symbols and hidden meanings.'},
    Forensics:{attribute:'Intellect',supports:['Investigation','Tinkering'],use:'Analyze evidence, wounds, recordings, and scene reconstruction.'},
    Tracking:{attribute:'Instinct',supports:['Survival','Awareness'],use:'Follow trails, locate targets, identify movement behavior.'},
    Survival:{attribute:'Instinct',supports:['Awareness','Endurance'],use:'Operate in harsh areas and read terrain.'},
    Persuasion:{attribute:'Charisma',supports:['Insight','Investigation'],use:'Convince witnesses and lower resistance.'},
    Insight:{attribute:'Charisma',supports:['Awareness','Investigation'],use:'Read motives, lies, emotional fractures.'},
    Interrogation:{attribute:'Charisma',supports:['Intimidation','Insight'],use:'Pressure a witness or suspect.'},
    Intimidation:{attribute:'Charisma',supports:['Force','Insight'],use:'Control through fear or direct threat.'},
    Deception:{attribute:'Charisma',supports:['Disguise','Insight'],use:'Lie, mislead, maintain cover.'},
    Stealth:{attribute:'Prowess',supports:['Awareness','Survival'],use:'Move unseen or set ambush position.'},
    Firearms:{attribute:'Prowess',supports:['Awareness','Weapon Handling'],use:'Ranged attacks and precision shots.'},
    'Melee Combat':{attribute:'Force',supports:['Close Quarters','Weapon Handling'],use:'Close combat attacks.'},
    'Weapon Handling':{attribute:'Prowess',supports:['Firearms','Melee Combat'],use:'Control weapon and reduce mishaps.'},
    'Trap Setting':{attribute:'Tinkering',supports:['Crafting','Engineering'],use:'Create and place traps.'},
    Crafting:{attribute:'Tinkering',supports:['Engineering','Improvisation'],use:'Create or modify useful gear.'},
    Engineering:{attribute:'Tinkering',supports:['Crafting','Mechanism Design'],use:'Build devices and countermeasures.'},
    Tinkering:{attribute:'Tinkering',supports:['Engineering','Crafting'],use:'Modify gear, devices, and traps.'},
    'Ritual Basics':{attribute:'Will',supports:['Occult Knowledge','Focus'],use:'Attempt basic unstable rituals.'},
    'Ritual Casting':{attribute:'Will',supports:['Occult Knowledge','Focus'],use:'Controlled ritual work.'},
    Warding:{attribute:'Will',supports:['Ritual Casting','Sigil Reading'],use:'Protective circles and thresholds.'},
    Binding:{attribute:'Will',supports:['Ritual Casting','Occult Knowledge'],use:'Restrict or contain entities.'},
    'Energy Control':{attribute:'Will',supports:['Focus','Ritual Basics'],use:'Quick spell control.'},
    Focus:{attribute:'Will',supports:['Ritual Casting','Composure'],use:'Maintain concentration.'},
    'Sigil Reading':{attribute:'Intellect',supports:['Symbolism','Occult Knowledge'],use:'Read occult geometry.'},
    'Spirit Communication':{attribute:'Charisma',supports:['Will','Presence Sense'],use:'Speak with spirits.'},
    'Presence Sense':{attribute:'Instinct',supports:['Will','Occult Knowledge'],use:'Detect/classify supernatural presence.'},
    Endurance:{attribute:'Endurance',supports:['Resistance','Survival'],use:'Resist fatigue, injury, bodily stress.'},
    Resistance:{attribute:'Endurance',supports:['Will','Composure'],use:'Resist supernatural effects.'},
    Composure:{attribute:'Will',supports:['Endurance','Resistance'],use:'Resist fear, panic, and collapse.'}
  },
  tarot: {
    majors: [
      ['The Fool','Unknown beginning','Open a hidden layer, new force, or second thread.','Assumptions fail; the Wardens walk into the wrong story.'],
      ['The Magician','Power and control','Tools, leverage, or deliberate supernatural method enters play.','Power destabilizes and turns unsafe.'],
      ['The High Priestess','Hidden truth','Reveal the real nature of a threat or key secret.','False certainty or misleading evidence.'],
      ['The Empress','Growth','Spread influence, infestation, healing, or a life-tied force.','Growth becomes corruption.'],
      ['The Emperor','Authority','A faction, hierarchy, or command structure intervenes.','Oppressive control or blocked access.'],
      ['The Hierophant','Doctrine and rite','Divine law, sacred structure, or ritual order enters play.','Corrupted rite or rigid dogma harms the hunt.'],
      ['The Lovers','Bond and choice','A relationship, pact, or tether defines the case.','Betrayal, fracture, or painful severance.'],
      ['The Chariot','Momentum','Push the hunt forward fast; chase, pursuit, acceleration.','Loss of control; pace turns hostile.'],
      ['Strength','Restraint and will','Gain control over fear, affliction, or pressure.','Self-control breaks; threat gets inside.'],
      ['The Hermit','Isolation and insight','A solitary clue, witness, or hidden record becomes key.','Lose support; the team is cut off.'],
      ['Wheel of Fortune','Cycle and reversal','Shift direction, timing, or pressure track.','Bad timing or reversal hurts the team.'],
      ['Justice','Truth and consequence','Expose a lie, debt, or old wrong tied to the case.','False accusation or skewed judgment.'],
      ['The Hanged Man','Sacrifice','Progress requires a real cost or delay.','Painful stall or wasted opportunity.'],
      ['Death','Transformation','Threat changes form; one phase ends and another begins.','Mutation or unstable escalation.'],
      ['Temperance','Balance','Stabilize a scene, reduce pressure, control mixed forces.','Imbalance doubles the danger.'],
      ['The Devil','Corruption','Temptation, possession, affliction, or dark leverage grows.','A brief chance to resist, never free.'],
      ['The Tower','Collapse','Trigger catastrophe, breach, or structural failure.','Collapse delayed, dread builds.'],
      ['The Star','Hope','A major clue, recovery window, or moral center appears.','False hope or comforting clue misleads.'],
      ['The Moon','Illusion','Confusion, concealment, and false readings cloud the hunt.','The hidden thing is forced into view.'],
      ['The Sun','Clarity','Expose truth, reveal path, remove false leads.','Success arrives with cost or arrogant mistake.'],
      ['Judgment','Reckoning','Force confrontation; reveal what must be answered.','Outcome postponed, pressure remains.'],
      ['The World','Completion','Resolve a case, close a loop, mark a milestone.','Unfinished thread survives the ending.']
    ],
    suits: {
      Blades:{domain:'Violence',opening:['fresh attack','damaged room','fleeing witness','blood trail'],prep:'Containment, direct offense, fast response',entities:['Wraith','Vengeful Spirit','Poltergeist','War Mask Demon','Rugaru']},
      Blood:{domain:'Victims / Emotion',opening:['family tension','grief object','survivor testimony','missing person'],prep:'Interviews, empathy, anchor truth, emotional context',entities:['Woman in White','Possessor Demon','Onryo','Changeling','Djinn']},
      Relics:{domain:'Preparation / Creature Hunt',opening:['tracks','torn gear','prior hunter notes','rare item rumor'],prep:'Special ammo, traps, movement, caches',entities:['Werewolf','Vampire','Wendigo','Rugaru','Redcap']},
      Sigils:{domain:'Occult Structure',opening:['circle residue','chant fragment','symbol trace','ritual site'],prep:'Wards, binding, threshold control, catalyst denial',entities:['Crossroads Demon','Djinn','Changeling','Bargain Keeper','Veil Render']}
    },
    values: ['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Page','Knight','Queen','King']
  },
  entities: {
    'Wraith':{type:'Spirit',weakness:'silver or tether object',anchor:'tether object',kill:'destroy the tether object',behaviors:['stalk','haunt','drain','ambush'],signs:['cold spot','life-drain fatigue','shadow moves against light','EMF spike']},
    'Vengeful Spirit':{type:'Spirit',weakness:'remains or emotional resolution',anchor:'remains or unresolved grudge',kill:'burn remains or resolve the grudge',behaviors:['haunt','target','manifest strike','mislead'],signs:['repeating phrase','temperature drop','old photo shifts','witness sees dead person']},
    'Poltergeist':{type:'Spirit',weakness:'source individual and emotional stabilization',anchor:'anchor person',kill:'identify anchor person and resolve trigger',behaviors:['throw objects','escalate','isolate','attack'],signs:['objects moved','broken glass','electrical surge','activity centered on one person']},
    'Woman in White':{type:'Tragic Spirit',weakness:'truth of betrayal or rest completion',anchor:'death site or personal object',kill:'resolve emotional loop or lay remains to rest',behaviors:['lure','possess briefly','weep','haunt'],signs:['roadside sighting','wet footprints','old wedding fabric','crying heard nearby']},
    'Onryo':{type:'Vengeful Spirit',weakness:'remains plus truth of injustice',anchor:'murder site or grudge object',kill:'locate remains and resolve injustice',behaviors:['target','curse','manifest strike','terrorize'],signs:['anger imprint','same figure seen repeatedly','records tied to suspect','cold pressure']},
    'Crossroads Demon':{type:'Infernal',weakness:'contract loophole, anchor, true name',anchor:'contract object or crossroads token',kill:'break contract and bind/destroy anchor',behaviors:['tempt','bargain','possess','mislead'],signs:['sulfur','sudden success then tragedy','calm stranger','contract residue']},
    'Possessor Demon':{type:'Infernal',weakness:'exorcism, consecrated ground, holy water',anchor:'host body or entry sigil',kill:'separate from host then trap/banish',behaviors:['possess','isolate','lie','attack through host'],signs:['black-eyed reflection','personality inversion','memory gaps','unnatural pain tolerance']},
    'War Mask Demon':{type:'Infernal Battle Demon',weakness:'relic-grade wards, host exhaustion, binding circle',anchor:'blood-soaked war relic or host rage',kill:'immobilize host, exorcise/bind, sanctified finish',behaviors:['charge','terrorize','attack','break cover'],signs:['blood haze','heat around weapons','host ignores wounds','barricades broken']},
    'Veil Render':{type:'High Demon / Rift',weakness:'stable sacred geometry, repaired thresholds',anchor:'layered rift anchor',kill:'collapse rift then bind/banish',behaviors:['distort space','trap','mislead','deny exit'],signs:['doors lead wrong','maps fail','missing time','sound travels incorrectly']},
    'Djinn':{type:'Entity',weakness:'vessel',anchor:'lamp, jar, ring, or sealed object',kill:'destroy or seal the vessel',behaviors:['illusion','isolate','tempt','bargain'],signs:['contradicting stories','reality mismatch','wish distortion','false comfort']},
    'Changeling':{type:'Fae',weakness:'iron and true identity reveal',anchor:'exchange bargain or threshold',kill:'reveal true form, break bargain, strike with iron',behaviors:['mimic','hide','manipulate','flee'],signs:['personality shift','missing history','aversion to iron','subtle habit errors']},
    'Bargain Keeper':{type:'Court Fae',weakness:'contract contradiction, iron threshold',anchor:'accepted gift or bargain',kill:'reverse terms then bind or drive out',behaviors:['bargain','pressure etiquette','tempt','mislead'],signs:['perfect manners','offerings vanish cleanly','records of prosperity then loss','impossible requests']},
    'Redcap':{type:'Predatory Fae',weakness:'iron, consecrated ground, cap/blood source',anchor:'blood-soaked ruin or cap',kill:'remove blood source/cap and finish with iron',behaviors:['ambush','feed','rush','flee to ruins'],signs:['rust footprints','old blood smell','broken teeth','short vicious figure']},
    'Werewolf':{type:'Creature',weakness:'silver',anchor:'curse bloodline or transformed host',kill:'silver strike, often heart/decapitation depending strain',behaviors:['stalk','hunt','ambush','flee when wounded'],signs:['large canine tracks','torn bodies','moon-linked pattern','animal panic']},
    'Vampire':{type:'Undead Predator',weakness:'sunlight, heart destruction, invitation rules',anchor:'nest, bloodline, sire link',kill:'destroy heart and force sunlight/fire',behaviors:['stalk','charm','feed','retreat to nest'],signs:['bloodless victim','charm-marked witness','no reflection tell','night pattern']},
    'Wendigo':{type:'Apex Beast',weakness:'fire only',anchor:'wilderness hunger zone',kill:'burn completely before it feeds again',behaviors:['mimic voice','ambush','feed','terrorize'],signs:['familiar voices in dark','half-eaten bodies','unnatural cold','large prints']},
    'Rugaru':{type:'Creature',weakness:'fire or containment depending stage',anchor:'blood hunger transformation',kill:'stop transformation or burn fully manifested predator',behaviors:['stalk','feed','rage','hide among humans'],signs:['meat craving','violent outburst','blood smell','family pattern']}
  },
  witnesses: [
    {name:'Mrs Harlan',role:'grieving mother',trust:0,fear:2,knows:{bell:'She heard the church bell under the floor at 3:13 a.m.',son:'Her son came home with ash under his nails.',church:'The old basement door was sealed by Wardens decades ago.'},hides:{cult:'Her son attended meetings under the church.'},lieTrigger:'direct accusation'},
    {name:'Deputy Vale',role:'local deputy',trust:0,fear:1,knows:{records:'Three old case files were removed from the station archive.',attack:'The wounds do not match any animal in the county.',mine:'The mine map shows a sealed chamber below the altar.'},hides:{sheriff:'The sheriff ordered him not to contact federal help.'},lieTrigger:'mention sheriff'},
    {name:'Eli Cross',role:'survivor',trust:-1,fear:3,knows:{bell:'The bell rang from below, not above.',symbol:'He saw nine circles around a black star.',voice:'The missing victim spoke in two voices.'},hides:{ritual:'He helped draw part of the circle because he thought it was a joke.'},lieTrigger:'ask about ritual'},
    {name:'Father Ansel',role:'retired priest',trust:1,fear:2,knows:{church:'The church was built to hide a seal, not serve a parish.',sigil:'The sigil is a containment geometry, not worship.',warden:'A Warden team died sealing something under the mine.'},hides:{key:'He still has the old reliquary key.'},lieTrigger:'threaten church'}
  ],
  failureConsequences: {
    movement:[{id:'broken_leg',label:'Broken Leg',text:'Landing goes wrong. Leg breaks hard enough to cut movement in half.',setbacks:{movement:2},movementMultiplier:.5},{id:'sprained_ankle',label:'Sprained Ankle',text:'Pain flares through the ankle. Movement is unreliable.',setbacks:{movement:1},movementMultiplier:.75}],
    social:[{id:'suspicion',label:'Suspicion',text:'The witness closes down and becomes harder to question.',pressure:1},{id:'lie_taken',label:'False Lead',text:'A false detail enters the theory board.',pressure:1}],
    investigation:[{id:'ambush_sign',label:'Missed Danger',text:'The search misses the real warning and the entity gains position.',pressure:1},{id:'false_positive',label:'False Positive',text:'The clue points to the wrong entity type until corrected.',pressure:1}],
    ritual:[{id:'backlash',label:'Ritual Backlash',text:'The working answers wrong. Strain and occult attention spike.',pressure:2,setbacks:{will:1}},{id:'wrong_door',label:'Wrong Door Opens',text:'The rite exposes a different layer of the case.',pressure:2}],
    combat:[{id:'wounded',label:'Wounded',text:'The counterattack lands. The Warden takes a wound penalty.',pressure:1,setbacks:{all:1}},{id:'disarmed',label:'Disarmed',text:'Weapon or key gear is knocked away.',pressure:1}]
  }
};

const stateDefault = () => ({
  version: VERSION,
  campaignId, campaignCode, caseId,
  mode:'solo', diceMode:'3d6', autoRoll:true, creatureResponse:true,
  phase:'seed', pressure:0, location:'Warden briefing room',
  activePlayer:'Party', characters:{}, currentPrivatePlayer:'Party',
  tarot:{season:null,caseSeed:null}, trueEntity:null, possibleEntities:[], eliminatedEntities:[],
  known:{weakness:false,anchor:false,kill:false,type:false},
  visibleSymptom:'No active case. Draw a new tarot case to begin.',
  clues:[], privateClues:{}, prep:[], conditions:{}, witnesses:[], hiddenSigns:[], discoveredSigns:[],
  publicLog:[], privateLog:{}, revealQueue:[], debug:[], createdAt:Date.now(), updatedAt:Date.now()
});
let S = loadState() || stateDefault();
let selectedCharacter = null;

function $(id){return document.getElementById(id)}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function id(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function rollDie(sides=6){return Math.floor(Math.random()*sides)+1}
function rollDice(mode){const n=mode==='2d6'?2:3; const dice=Array.from({length:n},()=>rollDie(6)); return {dice,total:dice.reduce((a,b)=>a+b,0),mode};}
function now(){return new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}
function saveState(){S.updatedAt=Date.now(); localStorage.setItem(STORAGE_KEY, JSON.stringify(S));}
function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function logDebug(x){S.debug.unshift({time:now(),data:x}); S.debug=S.debug.slice(0,40);}
function addPublic(type, title, text, extra={}){S.publicLog.push({id:id('pub'),time:now(),type,title,text,...extra});}
function addPrivate(player,type,title,text,extra={}){player=player||S.activePlayer||'Unknown'; if(!S.privateLog[player]) S.privateLog[player]=[]; S.privateLog[player].push({id:id('priv'),time:now(),type,title,text,...extra}); S.currentPrivatePlayer=player;}
function addClue(text, tags=[], privacy='public', player='Party'){const clue={id:id('clue'),text,tags,privacy,player,time:now()}; if(privacy==='private'){if(!S.privateClues[player]) S.privateClues[player]=[]; S.privateClues[player].push(clue); S.revealQueue.push({...clue,queued:false});} else S.clues.push(clue); return clue;}
function addPrep(text, tags=[]){if(!S.prep.some(p=>p.text.toLowerCase()===text.toLowerCase())) S.prep.push({id:id('prep'),text,tags,time:now()});}
function pressureBand(){return S.pressure>=10?'CRISIS':S.pressure>=7?'HIGH':S.pressure>=4?'MODERATE':S.pressure>=1?'LOW':'QUIET'}
function adjustPressure(n, reason=''){S.pressure=Math.max(0, Math.min(12, S.pressure+n)); if(n!==0) addPublic('system','Pressure Clock',`${n>0?'+':''}${n} pressure. ${reason} Current band: ${pressureBand()}.`);}

function normalizeCharacter(raw){
  const c = raw.character || raw;
  const name = c.name || c.identity?.name || c.characterName || c.profile?.name || `Warden ${Object.keys(S.characters).length+1}`;
  const attrsIn = c.attributes || c.stats || {};
  const attrs = {};
  for(const a of DATA.attributes){ const k=a.toLowerCase(); attrs[a]=Number(attrsIn[a] ?? attrsIn[k] ?? attrsIn[a.toUpperCase()] ?? 9); }
  // map older names
  attrs.Endurance = Number(attrs.Endurance || attrs.Grit || attrsIn.grit || attrsIn.Grit || 9);
  attrs.Grit = Number(attrs.Grit || attrs.Endurance || 9);
  attrs.Tinkering = Number(attrs.Tinkering || attrs.Intellect || 9);
  const skills = {};
  const sIn = c.skills || c.skillRanks || {};
  if(Array.isArray(sIn)){ for(const s of sIn){ skills[s.name||s.skill]=Number(s.rank||s.value||1); } }
  else { for(const [k,v] of Object.entries(sIn)){ skills[k]=typeof v==='object'?Number(v.rank||v.value||0):Number(v); } }
  const move = Number(c.move || c.movement || c.pace?.move || 4);
  return {id:c.id||id('char'), name, role:c.role||c.class||'', attrs, skills, move, currentMove:c.currentMove||move, conditions:c.conditions||[], raw:c};
}
function getActor(action){return action.actor || S.activePlayer || 'Party'}
function getChar(actor){return S.characters[actor] || Object.values(S.characters).find(c=>c.name?.toLowerCase()===String(actor).toLowerCase()) || null}
function skillRank(char, skill){ if(!char||!skill) return 0; if(char.skills[skill]!=null) return Number(char.skills[skill])||0; const found=Object.keys(char.skills).find(k=>k.toLowerCase()===String(skill).toLowerCase()); return found?Number(char.skills[found])||0:0; }
function attrValue(char, attr){ if(!char||!attr) return 9; return Number(char.attrs[attr] ?? char.attrs[String(attr).toLowerCase()] ?? 9); }

function parser(input){
  const globalPrivacy = /^\s*(private|secret|solo|public|party|shared)\b/i.exec(input)?.[1]?.toLowerCase();
  let cleaned = input.replace(/^\s*(private|secret|solo|public|party|shared)\b\s*/i,'').trim();
  const chunks = cleaned.split(/\s*;\s*/).filter(Boolean);
  return chunks.map(chunk=>parseOne(chunk, globalPrivacy));
}
function parseOne(raw, inheritedPrivacy){
  let text=raw.trim(); let privacy = inheritedPrivacy && ['private','secret','solo'].includes(inheritedPrivacy)?'private':'public';
  const p = /^(private|secret|solo|public|party|shared)\s+/i.exec(text);
  if(p){ privacy = ['private','secret','solo'].includes(p[1].toLowerCase())?'private':'public'; text=text.slice(p[0].length).trim(); }
  let actor='Party';
  const ap = /^([A-Za-z][\w '-]{1,30})\s*:\s*(.+)$/.exec(text);
  if(ap){ actor=ap[1].trim(); text=ap[2].trim(); }
  const lower=text.toLowerCase();
  const intent = detectIntent(lower);
  const topic = (/(?:about|regarding|on)\s+(.+)$/i.exec(text)||[])[1] || '';
  const target = detectTarget(text, intent);
  const location = (/(?:to|into|inside|at|in)\s+(church basement|basement|altar|hospital|archive|morgue|woods|mine|safehouse|church|cemetery|house|road|station)/i.exec(text)||[])[1] || '';
  const item = detectItem(text);
  return {id:id('act'), raw, text, privacy, actor, intent, target, topic, location, item, rollProfile:rollProfile(intent, target, text), createdAt:Date.now()};
}
function detectIntent(l){
  if(/\b(reveal|share|tell party|show party)\b/.test(l)) return 'reveal';
  if(/\b(look|observe|survey|scan)\b/.test(l)) return 'look';
  if(/\b(ask|talk|question|interview|press|comfort|threaten|intimidate|persuade|deceive)\b/.test(l)) return 'talk';
  if(/\b(research|look up|lookup|archive|records|cross-reference|read)\b/.test(l)) return 'research';
  if(/\b(investigate|search|examine|inspect|check|analyze|process|study)\b/.test(l)) return 'investigate';
  if(/\b(prep|prepare|ready|set up|setup|place|draw|load|ward|trap|craft)\b/.test(l)) return 'prepare';
  if(/\b(cast|ritual|rite|banish|bind|exorcise|cleanse|summon|invoke)\b/.test(l)) return 'cast';
  if(/\b(attack|shoot|stab|strike|hit|grapple|shove|tackle|fire|slash)\b/.test(l)) return 'attack';
  if(/\b(move|go|travel|enter|leave|return|approach|retreat|follow|split)\b/.test(l)) return 'move';
  if(/\b(use|activate|trigger|apply|throw|pour|ignite)\b/.test(l)) return 'use';
  if(/\b(help|assist|support|aid|cover)\b/.test(l)) return 'help';
  return 'unknown';
}
function detectTarget(text,intent){
  const t=text.replace(/about .+$/i,''); const l=t.toLowerCase();
  const names = DATA.witnesses.map(w=>w.name.toLowerCase());
  for(const n of names){ if(l.includes(n)) return DATA.witnesses.find(w=>w.name.toLowerCase()===n).name; }
  const targetWords=['witness','survivor','altar','symbol','sigil','bell','body','corpse','tracks','claw marks','blood','records','church','basement','mine','entity','demon','ghost','creature','door','circle','anchor','vessel','relic','salt line','holy water'];
  for(const w of targetWords){ if(l.includes(w)) return w; }
  const parts=t.split(/\s+/).filter(Boolean); return parts.slice(1).join(' ') || (intent==='look'?'scene':'');
}
function detectItem(text){ const l=text.toLowerCase(); const items=['salt','salt line','holy water','silver','iron','shotgun','fire','ward','trap','binding circle','veil snap','spirit lantern','emf','rosary']; return items.find(i=>l.includes(i))||''; }
function rollProfile(intent,target,text){
  const l=(text||'').toLowerCase();
  if(intent==='look') return {rollNeeded:false, attribute:'Instinct', primarySkill:'Awareness', supportSkills:['Investigation','Presence Sense']};
  if(intent==='investigate') return l.includes('sigil')||l.includes('symbol')||l.includes('altar') ? {rollNeeded:true,attribute:'Intellect',primarySkill:'Occult Knowledge',supportSkills:['Investigation','Sigil Reading']} : {rollNeeded:true,attribute:'Instinct',primarySkill:'Investigation',supportSkills:['Awareness','Forensics']};
  if(intent==='research') return {rollNeeded:true,attribute:'Intellect',primarySkill:l.includes('symbol')||l.includes('sigil')?'Occult Knowledge':'Research',supportSkills:['History','Symbolism']};
  if(intent==='talk') return {rollNeeded:true,attribute:'Charisma',primarySkill:l.includes('threaten')||l.includes('intimidate')?'Intimidation':l.includes('lie')||l.includes('deceive')?'Deception':l.includes('comfort')?'Persuasion':'Insight',supportSkills:['Investigation','Persuasion']};
  if(intent==='prepare') return l.includes('trap')||l.includes('gear')||l.includes('salt') ? {rollNeeded:true,attribute:'Tinkering',primarySkill:'Trap Setting',supportSkills:['Crafting','Engineering']} : {rollNeeded:true,attribute:'Intellect',primarySkill:'Investigation',supportSkills:['Occult Knowledge','Tinkering']};
  if(intent==='cast') return {rollNeeded:true,attribute:'Will',primarySkill:l.includes('bind')?'Binding':l.includes('ward')?'Warding':l.includes('ritual')||l.includes('exorcise')?'Ritual Casting':'Energy Control',supportSkills:['Occult Knowledge','Focus']};
  if(intent==='attack') return l.includes('shoot')||l.includes('fire') ? {rollNeeded:true,attribute:'Prowess',primarySkill:'Firearms',supportSkills:['Awareness','Weapon Handling']} : {rollNeeded:true,attribute:'Force',primarySkill:'Melee Combat',supportSkills:['Weapon Handling','Close Quarters']};
  if(intent==='move') return {rollNeeded:/jump|roof|leap|climb|sprint|run|flee/i.test(text),attribute:'Prowess',primarySkill:'Athletics',supportSkills:['Awareness','Survival']};
  return {rollNeeded:false, attribute:'Instinct', primarySkill:'Awareness', supportSkills:[]};
}

function actionSetbacks(action,char){
  let set=0; const reasons=[];
  const band=pressureBand();
  if(['MODERATE','HIGH','CRISIS'].includes(band) && ['attack','cast','investigate','move'].includes(action.intent)){ set++; reasons.push('active pressure'); }
  if(['HIGH','CRISIS'].includes(band) && ['talk','research','prepare'].includes(action.intent)){ set++; reasons.push('case under high pressure'); }
  const conds = char?.conditions || [];
  for(const c of conds){
    const affects = c.affects || c.setbacks || {};
    if(affects.all){ set+=Number(affects.all); reasons.push(c.label||'condition'); }
    if(action.intent==='move' && affects.movement){ set+=Number(affects.movement); reasons.push(c.label||'movement injury'); }
    if(action.rollProfile.attribute==='Will' && affects.will){ set+=Number(affects.will); reasons.push(c.label||'will strain'); }
  }
  if(action.intent==='attack' && !S.known.weakness){ set+=2; reasons.push('attacking before confirming weakness'); }
  if(action.intent==='cast' && !S.prep.some(p=>/circle|ward|salt|sigil|component/i.test(p.text))){ set++; reasons.push('improvised occult work'); }
  return {setbacks:set,reasons};
}
function resolveRoll(action){
  if(!action.rollProfile.rollNeeded) return {rolled:false,tier:'none',text:'No roll required.'};
  const actor=getActor(action); const char=getChar(actor);
  const rp=action.rollProfile;
  if(!S.autoRoll || !char){return {rolled:false,needsManual:true,tier:'manual',text:`Manual roll suggested: ${rp.attribute} + ${rp.primarySkill}.`};}
  const {dice,total,mode}=rollDice(S.diceMode);
  const attr=attrValue(char,rp.attribute);
  const primary=skillRank(char,rp.primarySkill);
  const supportRanks=(rp.supportSkills||[]).map(s=>skillRank(char,s));
  const supportOffset=Math.min(2, supportRanks.filter(x=>x>0).length);
  const sb=actionSetbacks(action,char);
  const finalSetbacks=Math.max(0, sb.setbacks-supportOffset);
  const target=attr+primary-finalSetbacks;
  const margin=target-total;
  let tier='failure';
  if(total<=target) tier = margin>=6?'criticalSuccess':margin>=4?'exceptionalSuccess':margin>=2?'strongSuccess':'success';
  else tier = margin<=-5?'severeFailure':margin<=-3?'failure':'partialFailure';
  if(mode==='3d6' && total<=4) tier='criticalSuccess';
  if(mode==='3d6' && total>=17) tier='criticalFailure';
  if(mode==='2d6' && total===2) tier='criticalSuccess';
  if(mode==='2d6' && total===12) tier='criticalFailure';
  const result={rolled:true,actor,character:char.name,dice,total,target,margin,tier,profile:rp,setbacks:sb.setbacks,finalSetbacks,supportOffset,reasons:sb.reasons};
  if(['failure','severeFailure','criticalFailure','partialFailure'].includes(tier)) applyFailureConsequence(action,result,char);
  return result;
}
function tierLabel(t){return ({criticalSuccess:'Critical Success',exceptionalSuccess:'Exceptional Success',strongSuccess:'Strong Success',success:'Success',partialFailure:'Partial / Cost',failure:'Failure',severeFailure:'Severe Failure',criticalFailure:'Critical Failure',manual:'Manual Roll'})[t]||t;}
function applyFailureConsequence(action,result,char){
  const severe=['severeFailure','criticalFailure'].includes(result.tier);
  let pool='investigation';
  if(action.intent==='talk') pool='social'; else if(action.intent==='cast') pool='ritual'; else if(action.intent==='attack') pool='combat'; else if(action.intent==='move') pool='movement';
  let c = severe ? DATA.failureConsequences[pool]?.[0] : pick(DATA.failureConsequences[pool]||DATA.failureConsequences.investigation);
  if(action.intent==='move' && /roof|jump|leap|climb|fall/i.test(action.raw)) c=DATA.failureConsequences.movement[0];
  if(!c) return;
  if(char && c.setbacks){ char.conditions=char.conditions||[]; char.conditions.push({id:c.id,label:c.label,text:c.text,affects:c.setbacks,createdAt:Date.now()}); }
  if(char && c.movementMultiplier){ char.currentMove=Math.max(1, Math.floor((char.currentMove||char.move||4)*c.movementMultiplier)); }
  if(c.pressure || severe) S.pressure=Math.min(12,S.pressure+(c.pressure||1));
  result.consequence=c;
}

function startNewCase(){
  const maj = drawMajor(); const minor=drawMinor(); const suit=DATA.tarot.suits[minor.suit]; const entityName=pick(suit.entities); const ent=DATA.entities[entityName];
  S = {...stateDefault(), campaignId, campaignCode, caseId, mode:S.mode||'solo', diceMode:S.diceMode||'3d6', characters:S.characters||{}};
  S.tarot.season=maj; S.tarot.caseSeed=minor; S.trueEntity=entityName; S.possibleEntities=Array.from(new Set([...suit.entities, ...Object.keys(DATA.entities).filter(e=>DATA.entities[e].type===ent.type).slice(0,2)])).slice(0,5);
  S.location = pick(['abandoned church','church basement','hospital room','old mine entrance','family house','county archive','roadside wreck']);
  S.visibleSymptom = `${pick(suit.opening)} tied to ${suit.domain.toLowerCase()}.`;
  S.witnesses = structuredClone(DATA.witnesses);
  S.hiddenSigns = ent.signs.map(s=>({id:id('sign'),text:s,entity:entityName,discovered:false}));
  addPublic('system','New Tarot Case',`Season pressure: ${maj.name}. Case seed: ${minor.label}${minor.reversed?' reversed':''}. Visible symptom: ${S.visibleSymptom}`);
  addPublic('system','Auto-GM Directive',`Investigate first. Prepare second. Confront last. The case currently suggests ${suit.domain}; ${suit.prep} matters most.`);
  saveState(); render();
}
function drawMajor(){const m=pick(DATA.tarot.majors); const rev=Math.random()<.28; return {name:m[0],theme:m[1],use:rev?m[3]:m[2],reversed:rev};}
function drawMinor(){const suits=Object.keys(DATA.tarot.suits); const suit=pick(suits); const value=pick(DATA.tarot.values); const rev=Math.random()<.28; const label=`${value} of ${suit}`; const idx=DATA.tarot.values.indexOf(value); const tier=idx<=2?1:idx<=4?2:idx<=6?3:idx<=8?4:idx===9?5:value==='Page'?3:value==='Knight'?4:value==='Queen'?5:5; return {suit,value,label,reversed:rev,tier,domain:DATA.tarot.suits[suit].domain};}

function handleCommand(input){
  if(!input.trim()) return; const actions=parser(input); logDebug({input,actions});
  for(const action of actions){ processAction(action); }
  if(actions.length>1) addPublic('system','Simultaneous Action Resolution',`${actions.length} split-party actions resolved. Public results are shown here; private results are stored by player branch.`);
  saveState(); render();
}
function processAction(action){
  const roll=resolveRoll(action); const out = routeAction(action,roll);
  const targetLog = action.privacy==='private' ? addPrivate : addPublic;
  if(action.privacy==='private') addPrivate(action.actor, out.type||'action', out.title, out.text, {action,roll}); else addPublic(out.type||'action', out.title, out.text, {action,roll});
  if(roll.rolled){ const line = `${roll.character} rolled ${roll.dice.join('+')} = ${roll.total} vs ${roll.target}. ${tierLabel(roll.tier)}. ${roll.reasons?.length?'Setbacks: '+roll.reasons.join(', ')+'.':''} ${roll.consequence?'Consequence: '+roll.consequence.text:''}`; (action.privacy==='private'?addPrivate:addPublic)(action.actor,'roll',`Roll: ${roll.profile.attribute} + ${roll.profile.primarySkill}`,line,{roll}); }
  if(S.creatureResponse && ['failure','severeFailure','criticalFailure','partialFailure'].includes(roll.tier)) creatureAct(action,roll);
  else if(S.creatureResponse && ['attack','cast','prepare'].includes(action.intent) && Math.random()<0.35) creatureAct(action,roll);
}
function routeAction(action,roll){
  switch(action.intent){
    case 'look': return doLook(action,roll);
    case 'investigate': return doInvestigate(action,roll);
    case 'research': return doResearch(action,roll);
    case 'talk': return doTalk(action,roll);
    case 'prepare': return doPrepare(action,roll);
    case 'cast': return doCast(action,roll);
    case 'attack': return doAttack(action,roll);
    case 'move': return doMove(action,roll);
    case 'reveal': return doReveal(action,roll);
    case 'use': return doUse(action,roll);
    case 'help': return {type:'action',title:'Assist',text:`${action.actor} assists the next related action. Treat this as support fiction for a +1 or setback offset if relevant.`};
    default: return {type:'system',title:'Unclear Command',text:`The Auto-GM cannot fully parse “${action.raw}.” Try a verb like investigate, research, talk, prep, cast, attack, move, look, or reveal.`};
  }
}
function doLook(){
  const ent = DATA.entities[S.trueEntity] || {};
  const publicSigns=S.discoveredSigns.map(s=>s.text).slice(-3).join(', ') || 'none confirmed yet';
  return {type:'system',title:'Scene Look',text:`Current location: ${S.location}. Visible symptom: ${S.visibleSymptom}. Pressure: ${pressureBand()}. Discovered signs: ${publicSigns}. Possible entities remain: ${S.possibleEntities.join(', ') || 'unknown'}.`};
}
function successful(roll){return !roll.rolled || ['success','strongSuccess','exceptionalSuccess','criticalSuccess'].includes(roll.tier)}
function strong(roll){return !roll.rolled || ['strongSuccess','exceptionalSuccess','criticalSuccess'].includes(roll.tier)}
function critical(roll){return !roll.rolled || ['criticalSuccess','exceptionalSuccess'].includes(roll.tier)}
function doInvestigate(action,roll){
  if(!successful(roll)){ addClue(`False or incomplete read at ${action.target||'the scene'}; the team cannot trust this clue yet.`,['false lead'],action.privacy,action.actor); return {type:'action',title:'Investigation Complication',text:`${action.actor} investigates ${action.target||'the scene'}, but the clue trail muddies. The Auto-GM adds a false lead or hidden danger.`}; }
  const sign = S.hiddenSigns.find(s=>!s.discovered) || {id:id('sign'),text:pick(DATA.entities[S.trueEntity]?.signs||['unnatural disturbance']),entity:S.trueEntity};
  sign.discovered=true; S.discoveredSigns.push(sign);
  addClue(`Sign discovered: ${sign.text}.`,['sign',DATA.entities[S.trueEntity]?.type||'entity'],action.privacy,action.actor);
  if(strong(roll)) narrowEntities(2, action.privacy, action.actor);
  if(critical(roll)){ S.known.type=true; S.known.weakness=true; addClue(`Critical read: this points toward ${S.trueEntity}. Likely weakness: ${DATA.entities[S.trueEntity].weakness}.`,['entity','weakness'],action.privacy,action.actor); }
  return {type:'action',title:'Investigation Result',text:`${action.actor} finds a usable sign: ${sign.text}. ${strong(roll)?'The clue narrows the entity list.':''}`};
}
function doResearch(action,roll){
  if(!successful(roll)){ addClue(`Research on ${action.topic||action.target||'the case'} produces a misleading match.`,['false lead','research'],action.privacy,action.actor); return {type:'action',title:'Research False Lead',text:`The archive gives ${action.actor} a pattern that almost fits. Almost is dangerous.`}; }
  const ent=DATA.entities[S.trueEntity];
  let text=`Research connects the case to ${ent.type} behavior.`;
  if(strong(roll)){ S.known.anchor=true; text+=` The likely anchor is ${ent.anchor}.`; }
  if(critical(roll)){ S.known.kill=true; text+=` End condition: ${ent.kill}.`; }
  addClue(text,['research','lore'],action.privacy,action.actor); narrowEntities(strong(roll)?2:1,action.privacy,action.actor);
  return {type:'action',title:'Research Result',text};
}
function findWitness(target){
  if(!target || target==='witness' || target==='survivor') return S.witnesses[0] || DATA.witnesses[0];
  const l=target.toLowerCase(); return S.witnesses.find(w=>w.name.toLowerCase().includes(l)||l.includes(w.name.toLowerCase())) || S.witnesses.find(w=>w.role.toLowerCase().includes(l)) || S.witnesses[0] || DATA.witnesses[0];
}
function doTalk(action,roll){
  const w=findWitness(action.target); const topic=(action.topic||action.target||'case').toLowerCase();
  if(!w) return {type:'action',title:'No Witness',text:'No matching witness is present in the current scene.'};
  if(!successful(roll)){ w.fear=Math.min(4,(w.fear||0)+1); if(w.lieTrigger && topic.includes(w.lieTrigger.split(' ')[0])){ addClue(`${w.name} lies under pressure about ${topic}.`,['lie','witness'],action.privacy,action.actor); } return {type:'action',title:'Witness Shuts Down',text:`${w.name} pulls back. Fear increases. Future questioning may be harder unless trust is rebuilt.`}; }
  w.trust=Math.min(4,(w.trust||0)+1);
  let key=Object.keys(w.knows||{}).find(k=>topic.includes(k)) || Object.keys(w.knows||{})[0];
  let text=w.knows[key] || `${w.name} provides a timeline detail but not the whole truth.`;
  if(strong(roll) && w.hides){ const hk=Object.keys(w.hides)[0]; text += ` Hidden truth slips out: ${w.hides[hk]}`; }
  addClue(`${w.name}: ${text}`,['witness',w.role],action.privacy,action.actor);
  return {type:'action',title:`Witness: ${w.name}`,text};
}
function doPrepare(action,roll){
  const prep = action.item || action.target || 'field preparation';
  addPrep(prep, [action.intent]);
  if(successful(roll)){ if(S.pressure>0) S.pressure--; return {type:'action',title:'Preparation Secured',text:`${action.actor} prepares ${prep}. The hunt becomes slightly more survivable.`}; }
  return {type:'action',title:'Preparation Flaw',text:`${action.actor} tries to prepare ${prep}, but something is incomplete, unstable, or poorly matched.`};
}
function doCast(action,roll){
  if(!successful(roll)){ return {type:'action',title:'Occult Backlash',text:`${action.actor}'s rite strains against the case. The occult structure pushes back.`}; }
  const l=action.raw.toLowerCase();
  if(/veil snap|reveal|presence|sense/.test(l)){ S.known.type=true; addClue(`Occult reveal confirms the pressure is consistent with ${DATA.entities[S.trueEntity].type}.`,['spell','entity'],action.privacy,action.actor); }
  if(/ward|circle|protect/.test(l)) addPrep('warded circle',['ward','ritual']);
  if(/bind|exorcise|banish/.test(l) && S.known.kill){ addPrep('banishment/exorcism procedure started',['ritual','endgame']); }
  return {type:'action',title:'Occult Action',text:`${action.actor}'s working takes hold. ${strong(roll)?'The rite produces a clearer answer or safer position.':'It helps, but the case still demands proof.'}`};
}
function doAttack(action,roll){
  const ent=DATA.entities[S.trueEntity];
  const hasWeakness = S.known.weakness || S.prep.some(p=>ent.weakness.toLowerCase().split(/[, ]+/).some(w=>w.length>3 && p.text.toLowerCase().includes(w)));
  if(!hasWeakness){ adjustPressure(1,'Blind attack against an unconfirmed weakness.'); return {type:'action',title:'Blind Attack',text:`The hit may land, but ${S.trueEntity||'the threat'} is not meaningfully ended. Damage alone is not the solution.`}; }
  if(!successful(roll)) return {type:'action',title:'Attack Fails',text:`The entity uses the opening to reposition, counter, or escalate.`};
  if(S.known.kill && S.prep.length>0 && critical(roll)){ return {type:'action',title:'End Condition Window',text:`The attack opens a real chance to complete the kill/banish condition: ${ent.kill}.`}; }
  return {type:'action',title:'Effective Hit',text:`The attack works because the team has the right pressure. Weakness applied: ${ent.weakness}. The entity is hurt, exposed, or driven back.`};
}
function doMove(action,roll){
  const actor=getActor(action); const loc=action.location || action.target || 'new location';
  if(successful(roll)){ return {type:'action',title:'Movement',text:`${actor} moves to ${loc}. ${action.privacy==='private'?'This branch is now separate from the party view.':''}`}; }
  return {type:'action',title:'Movement Complication',text:`${actor}'s movement goes wrong. The Auto-GM applies injury, delay, exposure, or separation.`};
}
function doReveal(action){
  const actor=getActor(action); const queue=(S.privateClues[actor]||[]); const clue=queue[queue.length-1];
  if(!clue) return {type:'system',title:'Nothing to Reveal',text:`${actor} has no private clue queued.`};
  S.clues.push({...clue,privacy:'public',revealedBy:actor});
  addPublic('reveal',`Private Clue Revealed by ${actor}`,clue.text);
  return {type:'reveal',title:'Reveal Complete',text:`${actor} reveals a private discovery to the party.`};
}
function doUse(action,roll){
  const item=action.item||action.target||'gear'; if(successful(roll)){addPrep(`used ${item}`,[item]); return {type:'action',title:'Gear Used',text:`${action.actor} uses ${item}. It changes the scene position or reduces danger if it matches the threat.`};}
  return {type:'action',title:'Gear Misfire',text:`${item} fails, breaks, runs out, or works at the wrong moment.`};
}
function narrowEntities(count=1,privacy='public',player='Party'){
  if(S.possibleEntities.length<=1){S.known.type=true;return;}
  const wrong=S.possibleEntities.filter(e=>e!==S.trueEntity);
  for(let i=0;i<count && wrong.length;i++){const rem=wrong.shift(); S.possibleEntities=S.possibleEntities.filter(e=>e!==rem); S.eliminatedEntities.push(rem);}
  if(S.possibleEntities.length===1){S.known.type=true; addClue(`Entity identification confirmed: ${S.trueEntity}.`,['entity'],privacy,player);}
}
function creatureAct(action,roll){
  if(!S.trueEntity) return; const ent=DATA.entities[S.trueEntity];
  const behavior = chooseBehavior(ent, action, roll); let text='';
  switch(behavior){
    case 'attack': text=`${S.trueEntity} exploits the failed moment and attacks from a bad angle.`; adjustPressure(1,'Entity attack.'); break;
    case 'ambush': text=`A staged detail reveals itself as an ambush. The entity was waiting for the team to look the wrong way.`; adjustPressure(1,'Ambush triggered.'); break;
    case 'haunt': text=`The air tightens. A haunting sign intensifies: ${pick(ent.signs)}.`; S.hiddenSigns.push({id:id('sign'),text:pick(ent.signs),entity:S.trueEntity,discovered:false}); break;
    case 'mislead': text=`The threat contaminates the clue trail. A detail now points toward the wrong conclusion.`; addClue('A misleading sign enters the case. Verify before preparing.', ['false lead'], action.privacy, action.actor); break;
    case 'flee': text=`The entity withdraws to protect its anchor: ${S.known.anchor?ent.anchor:'unknown anchor'}.`; break;
    case 'possess': text=`Possession pressure spikes. Anyone isolated should make a Will/Composure check if confronted directly.`; adjustPressure(1,'Possession pressure.'); break;
    case 'bargain': text=`The threat offers leverage instead of violence. The offer sounds useful, which is the problem.`; break;
    default: text=`The entity watches and changes position. It has learned something from the Wardens.`;
  }
  if(action.privacy==='private') addPrivate(action.actor,'creature',`Private Entity Response: ${behavior}`,text); else addPublic('creature',`Entity Response: ${behavior}`,text);
}
function chooseBehavior(ent, action, roll){
  if(S.pressure>=10) return pick(['attack','ambush','possess','flee']);
  if(action.intent==='talk') return pick(['mislead','haunt','watch']);
  if(action.intent==='research' || action.intent==='investigate') return roll && ['failure','criticalFailure','severeFailure'].includes(roll.tier)?pick(['ambush','mislead','haunt']):pick(['watch','flee']);
  if(action.intent==='attack') return pick(['attack','flee','ambush']);
  if(action.intent==='cast') return pick(['haunt','possess','flee','mislead']);
  return pick(ent.behaviors||['watch']);
}

function render(){
  $('campaignTag').textContent = campaignId==='local'?'Local Case':`Campaign ${campaignCode||campaignId}`;
  $('caseMode').value=S.mode||'solo'; $('diceMode').value=S.diceMode||'3d6'; $('autoRoll').checked=!!S.autoRoll; $('creatureResponse').checked=!!S.creatureResponse;
  const players=['Party',...Object.keys(S.characters),...Object.keys(S.privateLog)].filter((v,i,a)=>v&&a.indexOf(v)===i);
  $('activePlayer').innerHTML = players.map(p=>`<option ${p===S.activePlayer?'selected':''}>${esc(p)}</option>`).join('');
  const pct=Math.min(100,S.pressure/12*100); $('pressureMeter').style.width=pct+'%'; $('pressureText').innerHTML=`<b>${pressureBand()}</b> — ${S.pressure}/12. Failures, bad prep, blind attacks, and hostile rituals advance this clock.`;
  $('prepList').innerHTML = S.prep.length?S.prep.map(p=>`<div class="item"><b>${esc(p.text)}</b><div class="small">${esc((p.tags||[]).join(', '))}</div></div>`).join(''):'<div class="item small">No prep logged yet.</div>';
  renderTranscript(); renderSnapshot(); renderLists(); renderPanels(); renderCharacters(); renderPrivate(); renderHelp(); renderRaw(); saveState();
}
function renderTranscript(){
  $('publicTranscript').innerHTML = S.publicLog.length?S.publicLog.map(m=>msgHtml(m)).join(''):'<div class="msg system"><div class="meta">SYSTEM</div>No transcript yet. Draw a case or type <b>look</b>.</div>';
  $('publicTranscript').scrollTop=$('publicTranscript').scrollHeight;
}
function msgHtml(m){const cls=`msg ${m.type==='roll'?'roll ':''}${m.type==='roll' && m.roll && ['failure','severeFailure','criticalFailure','partialFailure'].includes(m.roll.tier)?'fail ':m.type==='roll'?'success ':''}${m.type==='system'?'system ':''}${m.type==='private'?'private ':''}`;return `<div class="${cls}"><div class="meta">${esc(m.time)} • ${esc(m.type||'log')}</div><b>${esc(m.title||'Update')}</b><div>${esc(m.text||'')}</div></div>`}
function renderSnapshot(){
  const ent=S.trueEntity?DATA.entities[S.trueEntity]:null;
  $('caseSnapshot').innerHTML = [
    ['Phase',S.phase],['Location',S.location],['Visible Symptom',S.visibleSymptom],['Season',S.tarot.season?`${S.tarot.season.name}${S.tarot.season.reversed?' reversed':''}`:'none'],['Case Seed',S.tarot.caseSeed?`${S.tarot.caseSeed.label}${S.tarot.caseSeed.reversed?' reversed':''}`:'none'],['Known Type',S.known.type?S.trueEntity:'unconfirmed'],['Known Weakness',S.known.weakness&&ent?ent.weakness:'unknown'],['Known Anchor',S.known.anchor&&ent?ent.anchor:'unknown'],['Kill Condition',S.known.kill&&ent?ent.kill:'unknown']
  ].map(([k,v])=>`<div class="item"><b>${esc(k)}:</b> ${esc(v)}</div>`).join('');
}
function renderLists(){
  $('clueList').innerHTML=S.clues.length?S.clues.map(c=>`<div class="item"><b>${esc(c.time)}</b> ${esc(c.text)}<div class="small">${esc((c.tags||[]).join(', '))}</div></div>`).join(''):'<div class="item small">No public clues discovered yet.</div>';
  $('entityList').innerHTML=S.possibleEntities.length?S.possibleEntities.map(e=>`<div class="item ${e===S.trueEntity&&S.known.type?'active':''}"><b>${esc(e)}</b><div class="small">${esc(DATA.entities[e]?.type||'Unknown')} ${S.known.type&&e===S.trueEntity?'— confirmed':''}</div></div>`).join(''):'<div class="item small">No entity list generated.</div>';
}
function renderPanels(){
  const season=S.tarot.season, seed=S.tarot.caseSeed;
  $('tarotPanel').innerHTML = `${season?`<div class="item"><h3>${esc(season.name)}${season.reversed?' Reversed':''}</h3><p>${esc(season.theme)} — ${esc(season.use)}</p></div>`:''}${seed?`<div class="item"><h3>${esc(seed.label)}${seed.reversed?' Reversed':''}</h3><p>${esc(seed.domain)} • Threat Tier ${seed.tier}</p></div>`:''}` || '<div class="item small">No tarot case yet.</div>';
  $('investigationPanel').innerHTML = `<div class="item"><b>Discovered signs:</b> ${S.discoveredSigns.map(s=>esc(s.text)).join(', ')||'none'}</div><div class="item"><b>Eliminated:</b> ${S.eliminatedEntities.join(', ')||'none'}</div><div class="item"><b>Public clues:</b> ${S.clues.length}</div>`;
  $('witnessPanel').innerHTML = (S.witnesses||[]).map(w=>`<div class="item"><b>${esc(w.name)}</b> — ${esc(w.role)}<div class="small">Trust ${w.trust} • Fear ${w.fear} • Topics: ${esc(Object.keys(w.knows||{}).join(', '))}</div></div>`).join('')||'<div class="item small">No witnesses.</div>';
  const ent=DATA.entities[S.trueEntity]||{}; $('creaturePanel').innerHTML = S.trueEntity?`<div class="item"><h3>${esc(S.trueEntity)}</h3><p>${esc(ent.type)}</p><p><b>Behaviors:</b> ${esc((ent.behaviors||[]).join(', '))}</p><p><b>Signs:</b> ${esc((ent.signs||[]).join(', '))}</p></div>`:'<div class="item small">Entity hidden until case is seeded.</div>';
}
function renderCharacters(){
  const chars=Object.values(S.characters);
  $('characterList').innerHTML=chars.length?chars.map(c=>`<div class="item ${selectedCharacter===c.name?'active':''}"><div class="row spread"><b>${esc(c.name)}</b><button class="btn ghost" onclick="NWAutoGM.selectCharacter('${esc(c.name)}')">View</button></div><div class="small">${esc(c.role||'No role')} • Move ${esc(c.currentMove||c.move||4)} • ${Object.keys(c.skills||{}).length} skills</div></div>`).join(''):'<div class="item small">No characters imported.</div>';
  const c=getChar(selectedCharacter)||chars[0]; if(c && !selectedCharacter) selectedCharacter=c.name;
  $('selectedCharacterPanel').innerHTML = c?`<div class="item"><h3>${esc(c.name)}</h3><p>${esc(c.role||'')}</p><div class="grid cols3">${Object.entries(c.attrs||{}).map(([k,v])=>`<div class="item"><b>${esc(k)}</b><br>${esc(v)}</div>`).join('')}</div><h3>Skills</h3><div class="thinList">${Object.entries(c.skills||{}).map(([k,v])=>`<span class="pill">${esc(k)} ${esc(v)}</span> `).join('')||'<span class="small">No skills found.</span>'}</div><h3>Conditions</h3>${(c.conditions||[]).map(x=>`<div class="item"><b>${esc(x.label)}</b><div class="small">${esc(x.text||'')}</div></div>`).join('')||'<div class="small">No active conditions.</div>'}</div>`:'<div class="item small">Select/import a character.</div>';
}
function renderPrivate(){
  const players=Object.keys(S.privateLog); $('privateBranchTabs').innerHTML=players.length?players.map(p=>`<button class="btn ${S.currentPrivatePlayer===p?'violet':'ghost'}" onclick="NWAutoGM.setPrivate('${esc(p)}')">${esc(p)}</button>`).join(''):'<span class="small">No private branches yet.</span>';
  const logs=S.privateLog[S.currentPrivatePlayer]||[]; $('privateTranscript').innerHTML=logs.length?logs.map(m=>msgHtml({...m,type:'private'})).join(''):'<div class="msg private"><div class="meta">PRIVATE</div>No private entries for this player.</div>';
  $('privateClueList').innerHTML=Object.entries(S.privateClues).flatMap(([p,arr])=>arr.map(c=>({p,...c}))).map(c=>`<div class="item"><b>${esc(c.p)}</b>: ${esc(c.text)}<div class="row"><button class="btn violet" onclick="NWAutoGM.revealClue('${esc(c.p)}','${esc(c.id)}')">Reveal to Party</button></div></div>`).join('')||'<div class="item small">No private clues yet.</div>';
}
function renderHelp(){
  $('helpExamples').innerHTML=DATA.commandExamples.map(x=>`<div class="item mono">${esc(x)}</div>`).join('');
  $('intentHelp').innerHTML=['look','investigate','research','talk','prepare','cast','attack','move','use','reveal','help'].map(i=>`<div class="item"><b>${i}</b><div class="small">${esc(helpText(i))}</div></div>`).join('');
}
function helpText(i){return {look:'scene summary without advancing danger',investigate:'field clues, signs, evidence, entity narrowing',research:'archives, lore, symbol work, weakness/anchor discovery',talk:'witness topics, secrets, lies, trust/fear',prepare:'gear, wards, traps, salt lines, special ammo',cast:'quick spells, rites, exorcisms, bindings, wards',attack:'combat pressure; works best after weakness and kill condition are known',move:'change location or private branch position',use:'activate gear/relics/items',reveal:'move private discovery into public party transcript',help:'support another Warden'}[i]||''}
function renderRaw(){ $('rawState').value=JSON.stringify(S,null,2); $('debugPanel').textContent=JSON.stringify(S.debug.slice(0,12),null,2); }

function exportJson(obj, filename){ const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function importJsonFile(file, cb){ const r=new FileReader(); r.onload=()=>{try{cb(JSON.parse(r.result))}catch(e){alert('Could not parse JSON: '+e.message)}}; r.readAsText(file); }

function wire(){
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.querySelectorAll('.tabPage').forEach(p=>p.classList.add('hidden')); $(`tab-${b.dataset.tab}`).classList.remove('hidden'); renderRaw();}));
  $('newCaseBtn').onclick=startNewCase; $('saveBtn').onclick=()=>{saveState();alert('Auto-GM case saved to this browser/device.');};
  $('exportBtn').onclick=()=>exportJson(S,`night_wardens_auto_gm_${campaignId}_${caseId}.json`);
  $('importCaseFile').onchange=e=>importJsonFile(e.target.files[0], obj=>{S=obj; saveState(); render();});
  $('runCommandBtn').onclick=()=>{handleCommand($('commandInput').value); $('commandInput').value='';};
  $('lookBtn').onclick=()=>handleCommand('look'); $('clearCommandBtn').onclick=()=>$('commandInput').value='';
  $('commandInput').addEventListener('keydown',e=>{if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){e.preventDefault();$('runCommandBtn').click();}});
  $('caseMode').onchange=e=>{S.mode=e.target.value; saveState(); render();}; $('diceMode').onchange=e=>{S.diceMode=e.target.value; saveState(); render();};
  $('activePlayer').onchange=e=>{S.activePlayer=e.target.value; saveState(); render();}; $('autoRoll').onchange=e=>{S.autoRoll=e.target.checked; saveState();}; $('creatureResponse').onchange=e=>{S.creatureResponse=e.target.checked; saveState();};
  $('addPressureBtn').onclick=()=>{adjustPressure(1,'Manual field pressure adjustment.'); render();}; $('reducePressureBtn').onclick=()=>{adjustPressure(-1,'Manual pressure relief.'); render();};
  $('importCharacterFile').onchange=e=>importJsonFile(e.target.files[0], obj=>{ const c=normalizeCharacter(obj); S.characters[c.name]=c; S.activePlayer=c.name; selectedCharacter=c.name; saveState(); render(); });
  $('addBlankCharacterBtn').onclick=()=>{const name=$('manualActorName').value.trim()||`Warden ${Object.keys(S.characters).length+1}`; S.characters[name]=normalizeCharacter({name,attributes:{},skills:{Investigation:1,Awareness:1,Composure:1},move:4}); S.activePlayer=name; selectedCharacter=name; saveState(); render();};
  $('applyRawBtn').onclick=()=>{try{S=JSON.parse($('rawState').value);saveState();render()}catch(e){alert(e.message)}}; $('refreshRawBtn').onclick=renderRaw;
  $('revealSelectedBtn').onclick=()=>handleCommand(`private ${S.currentPrivatePlayer||S.activePlayer}: reveal clue`);
}

window.NWAutoGM={selectCharacter(n){selectedCharacter=n; render();},setPrivate(p){S.currentPrivatePlayer=p; render();},revealClue(player, clueId){const arr=S.privateClues[player]||[]; const c=arr.find(x=>x.id===clueId); if(c){S.clues.push({...c,privacy:'public',revealedBy:player}); addPublic('reveal',`Private Clue Revealed by ${player}`,c.text); saveState(); render();}},state:()=>S,handleCommand};

if(!S.publicLog || !S.publicLog.length){ addPublic('system','Auto-GM Loaded','Pass 7 integration ready. Draw a new tarot case, import characters, or type “look.”'); }
wire(); render();
})();
