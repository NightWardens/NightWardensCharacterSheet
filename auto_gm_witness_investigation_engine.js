/*
Night Wardens Auto-GM Pass 4
Witness + Investigation Engine

Consumes parser actions + roll results + case state.
Outputs public/private narration, changed trust/fear, revealed clues,
investigation narrowing, false leads, and pressure changes.
*/

(function(global){
  const NW = global.NightWardensAutoGM = global.NightWardensAutoGM || {};

  function clone(obj){ return JSON.parse(JSON.stringify(obj || {})); }
  function norm(s){ return String(s || "").toLowerCase().trim(); }
  function includesAny(text, arr){
    const t = norm(text);
    return (arr || []).some(x => t.includes(norm(x)));
  }
  function clamp(n,min,max){ return Math.max(min, Math.min(max, Number(n)||0)); }

  const TOPIC_ALIASES = {
    bell: ["bell", "ringing", "church bell", "sound underground"],
    victim: ["victim", "missing person", "body", "dead", "survivor", "son", "daughter"],
    church: ["church", "chapel", "altar", "basement", "mine", "sanctuary"],
    symbol: ["symbol", "sigil", "mark", "circle", "glyph", "nine circles", "black star"],
    demon: ["demon", "possession", "black eyes", "sulfur", "infernal"],
    spirit: ["ghost", "spirit", "haunting", "apparition", "dead miner"],
    ritual: ["ritual", "chant", "summon", "sacrifice", "circle", "catalyst"],
    timeline: ["when", "time", "last seen", "before", "after", "timeline"],
    authority: ["sheriff", "police", "warden", "government", "cover up", "records"]
  };

  function classifyTopic(raw){
    const t = norm(raw);
    if(!t) return "general";
    for(const [key, aliases] of Object.entries(TOPIC_ALIASES)){
      if(includesAny(t, aliases)) return key;
    }
    return t.replace(/[^a-z0-9 ]/g,"").slice(0,60) || "general";
  }

  function defaultCaseState(){
    return {
      id: "case_" + Date.now(),
      title: "Untitled Hunt",
      phase: "investigation",
      pressure: { clock: 0, max: 6, notes: [] },
      investigation: {
        possibilities: ["Vengeful Spirit", "Possessor Demon", "Changeling", "Wendigo"],
        eliminated: [],
        confirmedEntity: null,
        trueEntity: null,
        weaknessKnown: false,
        anchorKnown: false,
        killConditionKnown: false,
        clueScore: 0,
        falseLeads: [],
        publicClues: [],
        privateClues: {},
        clueLog: []
      },
      witnesses: [],
      evidence: [],
      locations: [],
      researchClues: []
    };
  }

  function getWitness(caseState, target){
    const t = norm(target);
    const witnesses = caseState.witnesses || [];
    return witnesses.find(w =>
      norm(w.id) === t ||
      norm(w.name) === t ||
      norm(w.role) === t ||
      norm(w.alias || "").includes(t) ||
      t.includes(norm(w.name)) ||
      t.includes(norm(w.role))
    );
  }

  function getEvidence(caseState, target){
    const t = norm(target);
    return (caseState.evidence || []).find(e =>
      norm(e.id) === t ||
      norm(e.name) === t ||
      norm(e.type) === t ||
      norm(e.location || "").includes(t) ||
      t.includes(norm(e.name)) ||
      t.includes(norm(e.type))
    );
  }

  function getLocation(caseState, target){
    const t = norm(target);
    return (caseState.locations || []).find(l =>
      norm(l.id) === t ||
      norm(l.name) === t ||
      t.includes(norm(l.name))
    );
  }

  function relationshipDeltaFromRoll(roll){
    if(!roll) return 0;
    if(roll.outcome === "criticalSuccess") return 2;
    if(roll.outcome === "strongSuccess") return 1;
    if(roll.outcome === "success") return 1;
    if(roll.outcome === "partial") return 0;
    if(roll.outcome === "failure") return -1;
    if(roll.outcome === "criticalFailure") return -2;
    return 0;
  }

  function pressureDeltaFromRoll(roll, actionKind){
    if(!roll) return 0;
    if(roll.outcome === "criticalFailure") return actionKind === "attack" ? 2 : 1;
    if(roll.outcome === "failure") return 1;
    return 0;
  }

  function cluePowerFromRoll(roll){
    if(!roll) return 0;
    if(roll.outcome === "criticalSuccess") return 4;
    if(roll.outcome === "strongSuccess") return 3;
    if(roll.outcome === "success") return 2;
    if(roll.outcome === "partial") return 1;
    if(roll.outcome === "failure") return 0;
    if(roll.outcome === "criticalFailure") return -1;
    return 0;
  }

  function addPublicClue(caseState, clue, source){
    if(!clue) return;
    const entry = typeof clue === "string" ? { text: clue } : clone(clue);
    entry.source = entry.source || source || "unknown";
    entry.visibility = "public";
    entry.revealedAt = new Date().toISOString();
    caseState.investigation.publicClues = caseState.investigation.publicClues || [];
    caseState.investigation.clueLog = caseState.investigation.clueLog || [];
    if(!caseState.investigation.publicClues.some(c => c.text === entry.text)){
      caseState.investigation.publicClues.push(entry);
      caseState.investigation.clueLog.push(entry);
    }
  }

  function addPrivateClue(caseState, actor, clue, source){
    if(!clue) return;
    const entry = typeof clue === "string" ? { text: clue } : clone(clue);
    entry.source = entry.source || source || "unknown";
    entry.visibility = "private";
    entry.actor = actor || "unknown";
    entry.revealedAt = new Date().toISOString();
    caseState.investigation.privateClues = caseState.investigation.privateClues || {};
    caseState.investigation.privateClues[actor] = caseState.investigation.privateClues[actor] || [];
    caseState.investigation.clueLog = caseState.investigation.clueLog || [];
    if(!caseState.investigation.privateClues[actor].some(c => c.text === entry.text)){
      caseState.investigation.privateClues[actor].push(entry);
      caseState.investigation.clueLog.push(entry);
    }
  }

  function chooseClue(witness, topic, accessLevel, rollPower){
    const t = classifyTopic(topic);
    const all = [
      ...(witness.publicClues || []).map(c => ({...c, sensitivity: c.sensitivity ?? 0, clueType:"public"})),
      ...(witness.guardedClues || []).map(c => ({...c, sensitivity: c.sensitivity ?? 1, clueType:"guarded"})),
      ...(witness.secrets || []).map(c => ({...c, sensitivity: c.sensitivity ?? 2, clueType:"secret"})),
      ...(witness.confessions || []).map(c => ({...c, sensitivity: c.sensitivity ?? 3, clueType:"confession"}))
    ];
    const topicMatches = all.filter(c => {
      const topics = (c.topics || []).map(norm);
      const text = norm(c.text || "");
      return t === "general" || topics.includes(t) || text.includes(t);
    });
    const pool = topicMatches.length ? topicMatches : all;
    const allowed = pool
      .filter(c => Number(c.sensitivity || 0) <= accessLevel)
      .sort((a,b) => Number(b.sensitivity||0) - Number(a.sensitivity||0));
    if(allowed.length) return allowed[0];

    if(rollPower <= 0 && witness.lies && witness.lies.length){
      const lieMatches = witness.lies.filter(c => {
        const topics = (c.topics || []).map(norm);
        const text = norm(c.text || "");
        return t === "general" || topics.includes(t) || text.includes(t);
      });
      return { ...(lieMatches[0] || witness.lies[0]), clueType:"lie", isFalseLead:true };
    }
    return null;
  }

  function applyClueEffects(caseState, clue){
    if(!clue) return;
    const inv = caseState.investigation;
    if(clue.eliminate){
      for(const ent of clue.eliminate){
        if(!inv.eliminated.includes(ent)) inv.eliminated.push(ent);
        inv.possibilities = (inv.possibilities || []).filter(x => x !== ent);
      }
    }
    if(clue.suggest && Array.isArray(clue.suggest)){
      for(const ent of clue.suggest){
        if(!inv.possibilities.includes(ent) && !inv.eliminated.includes(ent)) inv.possibilities.push(ent);
      }
    }
    if(clue.confirmEntity) inv.confirmedEntity = clue.confirmEntity;
    if(clue.revealsWeakness) inv.weaknessKnown = true;
    if(clue.revealsAnchor) inv.anchorKnown = true;
    if(clue.revealsKillCondition) inv.killConditionKnown = true;
    if(clue.isFalseLead){
      inv.falseLeads = inv.falseLeads || [];
      inv.falseLeads.push({ text: clue.text, source: clue.source || "witness", at: new Date().toISOString() });
    }
  }

  function interrogateWitness(caseStateInput, action, rollResult, options={}){
    const caseState = clone(caseStateInput || defaultCaseState());
    const actor = action.actor || options.actor || "Warden";
    const target = action.target || "witness";
    const topic = classifyTopic(action.topic || action.raw || action.target || "general");
    let witness = getWitness(caseState, target) || (caseState.witnesses || [])[0];
    if(!witness){
      return { caseState, publicText: "There is no witness registered for this scene yet.", privateText: "", changed: false, revealed: [] };
    }

    const rollPower = cluePowerFromRoll(rollResult);
    const trustDelta = relationshipDeltaFromRoll(rollResult);
    const pressureDelta = pressureDeltaFromRoll(rollResult, "talk");

    witness.trust = clamp((witness.trust || 0) + trustDelta, -5, 5);
    if(rollPower >= 2) witness.fear = clamp((witness.fear || 0) - 1, 0, 5);
    if(rollPower <= 0) witness.fear = clamp((witness.fear || 0) + 1, 0, 5);

    const accessLevel = (witness.trust || 0) - Math.floor((witness.fear || 0)/2) + rollPower;
    const clue = chooseClue(witness, topic, accessLevel, rollPower);
    const revealed = [];

    let publicText = `${actor} questions ${witness.name} about ${topic}.`;
    let privateText = "";

    if(clue){
      clue.source = witness.name;
      clue.topic = topic;
      applyClueEffects(caseState, clue);
      revealed.push(clue);

      if(action.privacy === "private" || clue.private){
        addPrivateClue(caseState, actor, clue, witness.name);
        privateText = `${witness.name} gives ${actor} a private lead: ${clue.text}`;
        publicText += " The conversation visibly shifts, but the full detail is private.";
      } else {
        addPublicClue(caseState, clue, witness.name);
        publicText += ` ${witness.name} reveals: ${clue.text}`;
      }
    } else if(rollPower <= 0){
      publicText += ` ${witness.name} shuts down, contradicts themselves, or gives a lead that may be unreliable.`;
      caseState.investigation.falseLeads.push({ text:`${witness.name} gave no reliable answer about ${topic}.`, source:witness.name, at:new Date().toISOString() });
    } else {
      publicText += ` ${witness.name} does not know enough to answer that directly, but their reaction confirms the topic matters.`;
    }

    if(pressureDelta){
      caseState.pressure.clock = clamp((caseState.pressure.clock || 0) + pressureDelta, 0, caseState.pressure.max || 6);
      caseState.pressure.notes.push(`${actor}'s questioning increased pressure by ${pressureDelta}.`);
    }
    return { caseState, publicText, privateText, changed:true, revealed, witness };
  }

  function investigateEvidence(caseStateInput, action, rollResult, options={}){
    const caseState = clone(caseStateInput || defaultCaseState());
    const actor = action.actor || options.actor || "Warden";
    const target = action.target || "scene";
    let evidence = getEvidence(caseState, target);
    if(!evidence){
      const location = getLocation(caseState, target);
      if(location && location.evidenceIds){
        evidence = (caseState.evidence || []).find(e => location.evidenceIds.includes(e.id));
      }
    }

    const rollPower = cluePowerFromRoll(rollResult);
    const pressureDelta = pressureDeltaFromRoll(rollResult, "investigate");
    const revealed = [];
    let publicText = `${actor} investigates ${target}.`;
    let privateText = "";

    if(evidence){
      evidence.examined = true;
      const cluePool = [
        ...(evidence.surfaceClues || []).map(c => ({...c, sensitivity: c.sensitivity ?? 0, clueType:"surface"})),
        ...(evidence.deepClues || []).map(c => ({...c, sensitivity: c.sensitivity ?? 2, clueType:"deep"})),
        ...(evidence.hiddenClues || []).map(c => ({...c, sensitivity: c.sensitivity ?? 3, clueType:"hidden"}))
      ].sort((a,b)=>Number(a.sensitivity||0)-Number(b.sensitivity||0));
      const allowed = cluePool.filter(c => Number(c.sensitivity || 0) <= rollPower);
      const clue = allowed[allowed.length-1] || (rollPower <= 0 ? null : cluePool[0]);
      if(clue){
        clue.source = evidence.name;
        applyClueEffects(caseState, clue);
        revealed.push(clue);
        if(action.privacy === "private" || clue.private){
          addPrivateClue(caseState, actor, clue, evidence.name);
          privateText = `${actor} notices privately: ${clue.text}`;
          publicText += " Something about the evidence seems important, but the detail remains with that Warden for now.";
        } else {
          addPublicClue(caseState, clue, evidence.name);
          publicText += ` Clue found: ${clue.text}`;
        }
      } else {
        publicText += " The scene resists easy answers. Nothing reliable is found yet.";
      }
    } else {
      if(rollPower >= 2){
        const generic = { text: `The ${target} shows a pressure pattern matching the case domain, but not enough to name the entity yet.`, topics: ["general"] };
        addPublicClue(caseState, generic, target);
        revealed.push(generic);
        publicText += ` ${generic.text}`;
      } else {
        publicText += " No useful lead is found, and the delay gives the threat room to move.";
      }
    }
    if(pressureDelta){
      caseState.pressure.clock = clamp((caseState.pressure.clock || 0) + pressureDelta, 0, caseState.pressure.max || 6);
      caseState.pressure.notes.push(`${actor}'s investigation increased pressure by ${pressureDelta}.`);
    }
    return { caseState, publicText, privateText, changed:true, revealed, evidence };
  }

  function researchTopic(caseStateInput, action, rollResult, options={}){
    const caseState = clone(caseStateInput || defaultCaseState());
    const actor = action.actor || options.actor || "Warden";
    const topic = classifyTopic(action.topic || action.target || action.raw || "records");
    const rollPower = cluePowerFromRoll(rollResult);
    const revealed = [];
    let publicText = `${actor} researches ${topic}.`;
    let privateText = "";

    const researchPool = caseState.researchClues || [
      { text:"Records confirm the case predates the current incident.", topics:["timeline","records"], sensitivity:1 },
      { text:"The symbol belongs to a structured occult working, not random graffiti.", topics:["symbol","ritual"], sensitivity:1 },
      { text:"The pattern points toward an anchor, vessel, or tether sustaining the threat.", topics:["anchor","ritual","spirit","demon"], sensitivity:2, revealsAnchor:true },
      { text:"The correct weakness can only be trusted after the entity type is confirmed.", topics:["weakness","general"], sensitivity:2, revealsWeakness:true },
      { text:"An older Warden file mentions the same nine-circle black star symbol.", topics:["symbol","authority"], sensitivity:3 }
    ];

    const candidates = researchPool.filter(c => {
      const topics = (c.topics || []).map(norm);
      const text = norm(c.text || "");
      return topics.includes(topic) || text.includes(topic) || topic === "general" || topic === "records";
    });
    const pool = candidates.length ? candidates : researchPool;
    const clue = pool.filter(c => Number(c.sensitivity||0) <= rollPower).sort((a,b)=>Number(b.sensitivity||0)-Number(a.sensitivity||0))[0];

    if(clue){
      clue.source = "Research";
      applyClueEffects(caseState, clue);
      revealed.push(clue);
      if(action.privacy === "private" || clue.private){
        addPrivateClue(caseState, actor, clue, "Research");
        privateText = `${actor}'s private research lead: ${clue.text}`;
        publicText += " The research produces a lead, but it is currently private.";
      } else {
        addPublicClue(caseState, clue, "Research");
        publicText += ` Research lead: ${clue.text}`;
      }
    } else if(rollPower <= 0){
      const falseLead = { text:`The records point toward a plausible but unconfirmed explanation for ${topic}.`, isFalseLead:true, source:"Research", topics:[topic] };
      caseState.investigation.falseLeads.push(falseLead);
      publicText += ` ${falseLead.text}`;
      if(rollPower < 0){
        caseState.pressure.clock = clamp((caseState.pressure.clock || 0)+1,0,caseState.pressure.max||6);
      }
    } else {
      publicText += " The search finds background noise, but no decisive answer.";
    }
    return { caseState, publicText, privateText, changed:true, revealed };
  }

  function narrowInvestigation(caseStateInput, rollResult, options={}){
    const caseState = clone(caseStateInput || defaultCaseState());
    const inv = caseState.investigation;
    const rollPower = cluePowerFromRoll(rollResult);
    let text = "";
    if(rollPower >= 4){
      if(!inv.confirmedEntity && inv.trueEntity) inv.confirmedEntity = inv.trueEntity;
      inv.weaknessKnown = true;
      inv.anchorKnown = true;
      text = "Critical investigation progress: the entity type, weakness, and an anchor clue become available.";
    } else if(rollPower >= 3){
      if(!inv.confirmedEntity && inv.trueEntity) inv.confirmedEntity = inv.trueEntity;
      text = "Strong investigation progress: the exact entity type can now be identified.";
    } else if(rollPower >= 2){
      while((inv.possibilities || []).length > 3){
        const removed = inv.possibilities.shift();
        if(removed && !inv.eliminated.includes(removed)) inv.eliminated.push(removed);
      }
      text = "Investigation progress: narrow the case to 2–3 possible entity types.";
    } else if(rollPower >= 1){
      if((inv.possibilities || []).length > 1){
        const removed = inv.possibilities[0];
        if(removed && !inv.eliminated.includes(removed)) inv.eliminated.push(removed);
        inv.possibilities = inv.possibilities.slice(1);
      }
      text = "Partial progress: remove one possibility or gain a vague clue with a cost.";
    } else {
      text = "No reliable narrowing. Add a false lead, danger trigger, time loss, suspicion, or escalation.";
      inv.falseLeads.push({ text:"A failed investigation creates uncertainty or a misleading theory.", source:"narrowInvestigation", at:new Date().toISOString() });
      caseState.pressure.clock = clamp((caseState.pressure.clock || 0)+1,0,caseState.pressure.max||6);
    }
    return { caseState, text };
  }

  function resolveAction(caseStateInput, action, rollResult, options={}){
    const intent = norm(action.intent || action.verb || "");
    if(["talk","ask","interview","question","persuade","pressure"].includes(intent)) return interrogateWitness(caseStateInput, action, rollResult, options);
    if(["investigate","inspect","examine","search","track","look"].includes(intent)) {
      const res = investigateEvidence(caseStateInput, action, rollResult, options);
      const narrowed = narrowInvestigation(res.caseState, rollResult, options);
      res.caseState = narrowed.caseState;
      res.publicText += " " + narrowed.text;
      return res;
    }
    if(["research","study","decode","analyze"].includes(intent)) {
      const res = researchTopic(caseStateInput, action, rollResult, options);
      const narrowed = narrowInvestigation(res.caseState, rollResult, options);
      res.caseState = narrowed.caseState;
      res.publicText += " " + narrowed.text;
      return res;
    }
    return {
      caseState: clone(caseStateInput || defaultCaseState()),
      publicText: `No witness/investigation handler matched intent '${intent}'.`,
      privateText: "",
      changed:false,
      revealed:[]
    };
  }

  NW.WitnessInvestigationEngine = {
    defaultCaseState,
    classifyTopic,
    interrogateWitness,
    investigateEvidence,
    researchTopic,
    narrowInvestigation,
    resolveAction,
    addPublicClue,
    addPrivateClue,
    applyClueEffects
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = NW.WitnessInvestigationEngine;
  }
})(typeof window !== "undefined" ? window : globalThis);
