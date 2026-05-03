/*
Night Wardens Auto-GM — Pass 3: Character Roll Integration
Standalone browser/node friendly module.

Purpose:
- Consume structured actions from Pass 2 parser.
- Read Night Wardens character JSON.
- Find attributes and skills.
- Calculate 3d6 roll-under targets.
- Apply setbacks from conditions, spell effects, creature attacks, environment, and failure fallout.
- Resolve success tiers and produce public/private narration hooks.

Core rule:
3d6 <= Attribute + primary skill rank + up to 2 support skill offsets - setbacks

Support-skill rule used here:
Each relevant support skill with rank >= 1 offsets 1 setback, max 2.
This mirrors the field-reference shorthand while keeping the rulebook's 3d6 engine.
*/

(function(global){
  "use strict";

  const DEFAULT_CONFIG = {
    dice: { count: 3, sides: 6 },
    partialWindow: 2,
    criticalSuccessTotal: 4,
    criticalFailureTotal: 17,
    maxSupportOffset: 2,
    defaultAttributeBase: 9,
    attributeAliases: {
      grit: "endurance",
      endurance: "endurance",
      force: "force",
      strength: "force",
      prowess: "prowess",
      dexterity: "prowess",
      intellect: "intellect",
      intelligence: "intellect",
      instinct: "instinct",
      perception: "instinct",
      will: "will",
      willpower: "will",
      charisma: "charisma",
      presence: "charisma"
    },
    skillAliases: {
      "research": "Research",
      "occult": "Occult Knowledge",
      "occult knowledge": "Occult Knowledge",
      "investigation": "Investigation",
      "awareness": "Awareness",
      "stealth": "Stealth",
      "survival": "Survival",
      "endurance": "Endurance",
      "composure": "Composure",
      "ritual basics": "Ritual Basics",
      "ritual casting": "Ritual Casting",
      "binding": "Binding",
      "warding": "Warding",
      "melee combat": "Melee Combat",
      "firearms": "Firearms",
      "tinkering": "Tinkering",
      "presence sense": "Presence Sense",
      "spirit communication": "Spirit Communication",
      "insight": "Insight",
      "energy control": "Energy Control",
      "focus": "Focus",
      "sigil reading": "Sigil Reading",
      "curse handling": "Curse Handling",
      "forbidden magic": "Forbidden Magic",
      "entity binding": "Entity Binding"
    }
  };

  const DEFAULT_SETBACK_LIBRARY = {
    environmental: {
      darkness_light: { id:"darkness_light", label:"Dim light / weak darkness", amount:1, tags:["vision","environment"] },
      darkness_heavy: { id:"darkness_heavy", label:"Heavy darkness", amount:2, tags:["vision","environment"] },
      smoke: { id:"smoke", label:"Smoke / obscured air", amount:1, tags:["vision","breathing","environment"] },
      storm: { id:"storm", label:"Storm / hard weather", amount:1, tags:["environment","movement"] },
      unstable_rooftop: { id:"unstable_rooftop", label:"Unstable rooftop footing", amount:2, tags:["movement","height","environment"] },
      cursed_ground: { id:"cursed_ground", label:"Cursed ground", amount:2, tags:["supernatural","will","ritual"] }
    },
    injury: {
      shaken: { id:"shaken", label:"Shaken", amount:1, tags:["all"], duration:"next_roll" },
      wounded: { id:"wounded", label:"Wounded", amount:1, tags:["all"], duration:"until_treated" },
      critical: { id:"critical", label:"Critical", amount:2, tags:["all"], duration:"until_stabilized" },
      broken_leg: { id:"broken_leg", label:"Broken Leg", amount:2, tags:["movement","prowess","jump","sprint","climb"], movementMultiplier:0.5, duration:"until_treated" },
      broken_arm: { id:"broken_arm", label:"Broken Arm", amount:2, tags:["attack","force","melee","grapple","craft"], duration:"until_treated" },
      concussion: { id:"concussion", label:"Concussion", amount:2, tags:["intellect","research","focus","ritual"], duration:"until_treated" },
      deep_laceration: { id:"deep_laceration", label:"Deep Laceration / Bleeding", amount:1, tags:["all"], escalation:"bleeding", duration:"until_treated" },
      sprained_ankle: { id:"sprained_ankle", label:"Sprained Ankle", amount:1, tags:["movement","jump","sprint"], movementFlatPenalty:1, duration:"scene" }
    },
    supernatural: {
      fear_aura_1: { id:"fear_aura_1", label:"Fear Aura", amount:1, tags:["will","composure","social","attack"] },
      fear_aura_2: { id:"fear_aura_2", label:"Strong Fear Aura", amount:2, tags:["will","composure","social","attack"] },
      demonic_influence: { id:"demonic_influence", label:"Demonic Influence", amount:2, tags:["will","composure","ritual","social"] },
      reality_distortion: { id:"reality_distortion", label:"Reality Distortion", amount:2, tags:["instinct","awareness","navigation","investigation","movement"] },
      identity_distortion: { id:"identity_distortion", label:"Identity Distortion", amount:1, tags:["investigation","social","insight"] },
      curse_pressure: { id:"curse_pressure", label:"Curse Pressure", amount:2, tags:["endurance","recovery","ritual","will"] },
      possession_pressure: { id:"possession_pressure", label:"Possession Pressure", amount:2, tags:["will","composure","ritual"] }
    },
    spell: {
      force_pulse_recoil: { id:"force_pulse_recoil", label:"Force Pulse recoil", amount:1, tags:["physical","movement","attack"], duration:"next_roll" },
      shield_burst_recoil: { id:"shield_burst_recoil", label:"Shield Burst recoil", amount:1, tags:["will","ritual","physical"], duration:"next_roll" },
      grave_chill_self: { id:"grave_chill_self", label:"Grave Chill backlash", amount:1, tags:["prowess","movement","attack"], duration:"next_roll" },
      static_hex_glitch: { id:"static_hex_glitch", label:"Static Hex gear glitch", amount:1, tags:["technical","tinkering","gear"], duration:"scene" },
      ritual_burn: { id:"ritual_burn", label:"Ritual Burn", amount:1, tags:["prowess","will","ritual"], duration:"until_treated" }
    },
    creatureAttack: {
      wendigo_cold_exposure: { id:"wendigo_cold_exposure", label:"Wendigo cold exposure", amount:1, tags:["endurance","movement","attack"] },
      wraith_life_drain: { id:"wraith_life_drain", label:"Wraith life drain", amount:2, tags:["endurance","will","recovery"] },
      demon_pain_split: { id:"demon_pain_split", label:"Demonic pain split", amount:1, tags:["will","composure"] },
      fae_glamour: { id:"fae_glamour", label:"Fae glamour confusion", amount:1, tags:["investigation","social","instinct"] },
      poltergeist_debris: { id:"poltergeist_debris", label:"Flying debris pressure", amount:2, tags:["movement","prowess","attack"] }
    }
  };

  const FAILURE_OUTCOMES = {
    jump_or_fall: [
      {
        id:"failed_rooftop_jump_broken_leg",
        when:{ intents:["move","jump","flee","climb"], targetKeywords:["roof","rooftop","ledge","window","fire escape","gap"], marginMin:3 },
        result:"You fail to find a safe landing line. The impact buckles your leg.",
        applyConditions:["broken_leg","shaken"],
        movementMultiplier:0.5,
        pressureDelta:1,
        tags:["movement","injury","fall"],
        publicNarration:"The landing goes wrong. Bone pops under the impact. Movement actions now suffer 2 setbacks and movement is halved until treated.",
        privateNarration:"Your body knows the injury before your mind catches up. You can still act, but movement is now dangerous."
      },
      {
        id:"failed_jump_sprain",
        when:{ intents:["move","jump","flee","climb"], targetKeywords:["gap","fence","wall","stair","window"], marginMin:1, marginMax:2 },
        result:"You land badly and twist your ankle.",
        applyConditions:["sprained_ankle"],
        pressureDelta:0,
        tags:["movement","injury"],
        publicNarration:"The landing is ugly. You stay upright, but your footing is compromised.",
        privateNarration:"Every step sends a sharp warning through your ankle."
      }
    ],
    investigation: [
      {
        id:"false_lead",
        when:{ intents:["investigate","research","inspect"], marginMin:1 },
        result:"The clue is real, but the interpretation is wrong.",
        applyCaseFlags:["false_lead"],
        pressureDelta:1,
        tags:["clue","misdirection"],
        publicNarration:"The evidence seems to point one way, but something in the pattern is off."
      },
      {
        id:"danger_trigger",
        when:{ intents:["investigate","inspect","touch","open"], marginMin:3 },
        result:"The investigation disturbs the site and wakes the pressure inside it.",
        applyCaseFlags:["danger_triggered"],
        pressureDelta:1,
        tags:["clue","danger"],
        publicNarration:"The moment the search goes too far, the room answers."
      }
    ],
    social: [
      {
        id:"witness_shuts_down",
        when:{ intents:["talk","ask","interrogate","persuade"], marginMin:1 },
        result:"The witness closes off or lies to protect themselves.",
        applyCaseFlags:["witness_guarded"],
        pressureDelta:0,
        tags:["witness","social"],
        publicNarration:"The witness gives you something, but not the whole truth."
      },
      {
        id:"suspicion_raised",
        when:{ intents:["talk","ask","interrogate","impersonate"], marginMin:3 },
        result:"The conversation raises suspicion or draws outside attention.",
        applyCaseFlags:["suspicion"],
        pressureDelta:1,
        tags:["social","complication"],
        publicNarration:"The conversation turns. Someone is going to remember this."
      }
    ],
    combat: [
      {
        id:"enemy_counter",
        when:{ intents:["attack","shoot","strike","confront"], marginMin:1 },
        result:"The target reads the attack and punishes the opening.",
        applyConditions:["shaken"],
        pressureDelta:1,
        tags:["combat"],
        publicNarration:"The attack fails to land cleanly, and the threat immediately presses the mistake."
      },
      {
        id:"bad_position",
        when:{ intents:["attack","shoot","strike","confront"], marginMin:3 },
        result:"The attack puts the Warden in a bad position.",
        applyConditions:["shaken"],
        applyCaseFlags:["bad_position"],
        pressureDelta:1,
        tags:["combat","position"],
        publicNarration:"The failed attack leaves the Warden exposed."
      }
    ],
    occult: [
      {
        id:"ritual_backlash",
        when:{ intents:["cast","ritual","ward","bind","banish"], marginMin:1 },
        result:"The working backlashes through the caster.",
        applyConditions:["ritual_burn"],
        pressureDelta:1,
        tags:["magic","backlash"],
        publicNarration:"The circle flares wrong. The magic works against the hand that shaped it."
      },
      {
        id:"hostile_attention",
        when:{ intents:["cast","ritual","ward","bind","banish"], marginMin:4 },
        result:"The spell draws hostile attention.",
        applyCaseFlags:["hostile_attention"],
        pressureDelta:2,
        tags:["magic","attention"],
        publicNarration:"Something heard the working and noticed the caster."
      }
    ]
  };

  function deepClone(x){ return JSON.parse(JSON.stringify(x)); }
  function normalize(s){ return String(s || "").trim().toLowerCase(); }
  function titleCase(s){ return String(s || "").replace(/\w\S*/g, t => t.charAt(0).toUpperCase()+t.slice(1).toLowerCase()); }

  function rollDice(count=3, sides=6, rng=Math.random){
    const rolls = [];
    for(let i=0;i<count;i++) rolls.push(Math.floor(rng()*sides)+1);
    return { rolls, total: rolls.reduce((a,b)=>a+b,0) };
  }

  function normalizeAttribute(attr, config=DEFAULT_CONFIG){
    const key = normalize(attr);
    return config.attributeAliases[key] || key;
  }

  function getAttributeValue(character, attr, config=DEFAULT_CONFIG){
    const key = normalizeAttribute(attr, config);
    const attrs = character.attributes || {};
    if(attrs[key] != null) return Number(attrs[key]) || config.defaultAttributeBase;
    const title = titleCase(key);
    if(attrs[title] != null) return Number(attrs[title]) || config.defaultAttributeBase;
    return config.defaultAttributeBase;
  }

  function normalizeSkillName(skill, config=DEFAULT_CONFIG){
    if(!skill) return "";
    const key = normalize(skill);
    return config.skillAliases[key] || String(skill).trim();
  }

  function getSkillRank(character, skill, config=DEFAULT_CONFIG){
    const name = normalizeSkillName(skill, config);
    if(!name) return 0;
    const skills = character.skills || {};
    if(skills[name] != null) return Number(skills[name]) || 0;
    const key = normalize(name);
    for(const [k,v] of Object.entries(skills)){
      if(normalize(k) === key) return Number(v) || 0;
    }
    if(Array.isArray(character.skillList)){
      const found = character.skillList.find(s => normalize(s.name) === key);
      if(found) return Number(found.rank) || 0;
    }
    return 0;
  }

  function conditionApplies(condition, action){
    const tags = condition.tags || [];
    if(tags.includes("all")) return true;
    const hay = [
      action.intent, action.target, action.targetType, action.topic, action.location,
      action.rollProfile?.attribute, action.rollProfile?.primarySkill,
      ...(action.rollProfile?.supportSkills || [])
    ].map(normalize).join(" ");
    return tags.some(t => hay.includes(normalize(t)));
  }

  function flattenSetbackLibrary(library=DEFAULT_SETBACK_LIBRARY){
    const out = {};
    Object.values(library).forEach(group => {
      Object.entries(group).forEach(([k,v]) => out[v.id || k] = v);
    });
    return out;
  }

  function getActiveConditionObjects(character, caseState={}, library=DEFAULT_SETBACK_LIBRARY){
    const flat = flattenSetbackLibrary(library);
    const raw = [
      ...(character.conditions || []),
      ...(character.activeSetbacks || []),
      ...(caseState.globalSetbacks || []),
      ...(caseState.sceneSetbacks || [])
    ];
    return raw.map(c => typeof c === "string" ? flat[c] || {id:c,label:c,amount:1,tags:["all"]} : c).filter(Boolean);
  }

  function calculateSetbacks(character, action, caseState={}, library=DEFAULT_SETBACK_LIBRARY, config=DEFAULT_CONFIG){
    const conditionObjects = getActiveConditionObjects(character, caseState, library);
    const applied = [];
    let total = Number(action.baseSetbacks || 0) || 0;

    for(const condition of conditionObjects){
      if(conditionApplies(condition, action)){
        const amount = Number(condition.amount || 0);
        if(amount){
          total += amount;
          applied.push({ id:condition.id, label:condition.label || condition.id, amount, source:condition.source || "condition" });
        }
      }
    }

    // Action-specific contextual setbacks from parser/case state.
    if(Array.isArray(action.contextSetbacks)){
      for(const s of action.contextSetbacks){
        const amount = Number(s.amount || 0);
        total += amount;
        applied.push({ id:s.id || "context", label:s.label || s.id || "Context setback", amount, source:"action" });
      }
    }

    const supportSkills = action.rollProfile?.supportSkills || [];
    const supportUsed = [];
    for(const skill of supportSkills.slice(0,2)){
      const rank = getSkillRank(character, skill, config);
      if(rank >= 1){
        supportUsed.push({ skill: normalizeSkillName(skill, config), rank, offset:1 });
      }
    }
    const supportOffset = Math.min(config.maxSupportOffset, supportUsed.reduce((a,s)=>a+s.offset,0), total);
    const finalSetbacks = Math.max(0, total - supportOffset);

    return { total, applied, supportUsed, supportOffset, finalSetbacks };
  }

  function calculateMovement(character, library=DEFAULT_SETBACK_LIBRARY){
    let move = Number(character.move ?? character.movement ?? 4) || 4;
    const flat = flattenSetbackLibrary(library);
    const conditions = (character.conditions || []).map(c => typeof c === "string" ? flat[c] || c : c);
    let multiplier = 1;
    let flatPenalty = 0;
    const reasons = [];
    for(const c of conditions){
      if(c && typeof c === "object"){
        if(c.movementMultiplier != null){
          multiplier *= Number(c.movementMultiplier);
          reasons.push(`${c.label || c.id}: movement x${c.movementMultiplier}`);
        }
        if(c.movementFlatPenalty != null){
          flatPenalty += Number(c.movementFlatPenalty);
          reasons.push(`${c.label || c.id}: movement -${c.movementFlatPenalty}`);
        }
      }
    }
    return { base: move, current: Math.max(0, Math.floor(move * multiplier - flatPenalty)), multiplier, flatPenalty, reasons };
  }

  function calculateRollTarget(character, action, caseState={}, options={}){
    const config = {...DEFAULT_CONFIG, ...(options.config || {})};
    const library = options.setbackLibrary || DEFAULT_SETBACK_LIBRARY;
    const rollProfile = action.rollProfile || {};
    const attribute = normalizeAttribute(rollProfile.attribute || action.attribute || "instinct", config);
    const attrValue = getAttributeValue(character, attribute, config);
    const primarySkill = normalizeSkillName(rollProfile.primarySkill || action.primarySkill || "", config);
    const primaryRank = getSkillRank(character, primarySkill, config);
    const setbackCalc = calculateSetbacks(character, action, caseState, library, config);
    const target = attrValue + primaryRank - setbackCalc.finalSetbacks;
    return {
      attribute,
      attrValue,
      primarySkill,
      primaryRank,
      supportSkills: setbackCalc.supportUsed,
      setbacks: setbackCalc,
      target
    };
  }

  function classifyRoll(total, target, config=DEFAULT_CONFIG){
    if(total <= config.criticalSuccessTotal) return { tier:"critical_success", label:"Critical Success", success:true, margin: target-total };
    if(total >= config.criticalFailureTotal) return { tier:"critical_failure", label:"Critical Failure", success:false, margin: target-total };
    if(total <= target) {
      const margin = target - total;
      if(margin >= 5) return { tier:"strong_success", label:"Strong Success", success:true, margin };
      return { tier:"success", label:"Success", success:true, margin };
    }
    const miss = total - target;
    if(miss <= config.partialWindow) return { tier:"partial", label:"Partial / Cost", success:false, partial:true, margin: target-total };
    return { tier:"failure", label:"Failure", success:false, margin: target-total };
  }

  function selectFailureOutcome(action, rollResult, category=null){
    if(rollResult.success) return null;
    const marginMiss = Math.abs(Math.min(0, rollResult.margin));
    const intent = normalize(action.intent);
    const target = normalize([action.target, action.location, action.topic].join(" "));
    const categories = category ? [category] : ["jump_or_fall","investigation","social","combat","occult"];
    for(const cat of categories){
      const rows = FAILURE_OUTCOMES[cat] || [];
      for(const row of rows){
        const w = row.when || {};
        if(w.intents && !w.intents.map(normalize).includes(intent)) continue;
        if(w.marginMin != null && marginMiss < w.marginMin) continue;
        if(w.marginMax != null && marginMiss > w.marginMax) continue;
        if(w.targetKeywords && !w.targetKeywords.some(k => target.includes(normalize(k)))) continue;
        return deepClone(row);
      }
    }
    return null;
  }

  function applyOutcomeToState(character, caseState, outcome, library=DEFAULT_SETBACK_LIBRARY){
    const nextCharacter = deepClone(character);
    const nextCase = deepClone(caseState || {});
    nextCharacter.conditions = nextCharacter.conditions || [];
    nextCase.flags = nextCase.flags || [];
    if(outcome){
      for(const c of (outcome.applyConditions || [])){
        if(!nextCharacter.conditions.includes(c)) nextCharacter.conditions.push(c);
      }
      for(const f of (outcome.applyCaseFlags || [])){
        if(!nextCase.flags.includes(f)) nextCase.flags.push(f);
      }
      if(outcome.pressureDelta){
        nextCase.pressureClock = Number(nextCase.pressureClock || 0) + Number(outcome.pressureDelta);
      }
      if(outcome.movementMultiplier){
        // already represented by condition, but useful for UI.
        nextCharacter.lastMovementMultiplier = outcome.movementMultiplier;
      }
    }
    nextCharacter.movementState = calculateMovement(nextCharacter, library);
    return { character: nextCharacter, caseState: nextCase };
  }

  function resolveAction(character, action, caseState={}, options={}){
    const config = {...DEFAULT_CONFIG, ...(options.config || {})};
    const library = options.setbackLibrary || DEFAULT_SETBACK_LIBRARY;
    const rng = options.rng || Math.random;
    const targetCalc = calculateRollTarget(character, action, caseState, {config, setbackLibrary:library});
    const dice = action.fixedRoll ? {rolls: action.fixedRoll, total: action.fixedRoll.reduce((a,b)=>a+b,0)} : rollDice(config.dice.count, config.dice.sides, rng);
    const result = classifyRoll(dice.total, targetCalc.target, config);
    const failureOutcome = selectFailureOutcome(action, result, options.failureCategory || null);
    const stateUpdate = applyOutcomeToState(character, caseState, failureOutcome, library);

    const narration = buildNarration(action, targetCalc, dice, result, failureOutcome);
    return {
      action,
      target: targetCalc,
      dice,
      result,
      failureOutcome,
      narration,
      updatedCharacter: stateUpdate.character,
      updatedCaseState: stateUpdate.caseState
    };
  }

  function buildNarration(action, targetCalc, dice, result, failureOutcome){
    const who = action.actor || "Warden";
    const intent = action.intent || "acts";
    const target = action.target ? ` ${action.target}` : "";
    let line = `${who} attempts to ${intent}${target}. Rolled ${dice.rolls.join("+")} = ${dice.total} vs target ${targetCalc.target}. ${result.label}.`;
    if(targetCalc.setbacks.applied.length){
      line += ` Setbacks: ${targetCalc.setbacks.applied.map(s=>`${s.label} ${s.amount}`).join(", ")}.`;
    }
    if(targetCalc.setbacks.supportUsed.length){
      line += ` Support offset: ${targetCalc.setbacks.supportUsed.map(s=>`${s.skill} r${s.rank}`).join(", ")}.`;
    }
    if(failureOutcome){
      line += ` ${failureOutcome.publicNarration || failureOutcome.result}`;
    }
    return line;
  }

  function resolveBatch(charactersByName, actions, caseState={}, options={}){
    const outputs = [];
    let nextChars = deepClone(charactersByName);
    let nextCase = deepClone(caseState);
    for(const action of actions){
      const actorKey = Object.keys(nextChars).find(k => normalize(k) === normalize(action.actor)) || action.actor;
      const character = nextChars[actorKey] || options.defaultCharacter || { name: action.actor, attributes:{}, skills:{} };
      const resolved = resolveAction(character, action, nextCase, options);
      nextChars[actorKey] = resolved.updatedCharacter;
      nextCase = resolved.updatedCaseState;
      outputs.push(resolved);
    }
    return { outputs, charactersByName: nextChars, caseState: nextCase };
  }

  const api = {
    DEFAULT_CONFIG,
    DEFAULT_SETBACK_LIBRARY,
    FAILURE_OUTCOMES,
    rollDice,
    normalizeAttribute,
    normalizeSkillName,
    getAttributeValue,
    getSkillRank,
    calculateSetbacks,
    calculateMovement,
    calculateRollTarget,
    classifyRoll,
    selectFailureOutcome,
    applyOutcomeToState,
    resolveAction,
    resolveBatch
  };

  if(typeof module !== "undefined" && module.exports) module.exports = api;
  global.NightWardensRollEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
