/* Night Wardens Auto-GM Pass 5
 * Creature AI + Clue Trail Engine
 *
 * Purpose:
 * - Turns the hidden entity into an active pressure source.
 * - Tracks behavior state, suspicion, hunger/aggression/fear, knowledge of Wardens.
 * - Generates signs/clues left behind by creature actions.
 * - Escalates by pressure clock, phase, tarot domain, investigation results, and Warden mistakes.
 *
 * Browser + Node compatible. No dependencies.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NightWardensCreatureAI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_RNG = () => Math.random();

  const STATE_SEQUENCE = ["dormant", "watching", "stalking", "hunting", "manifesting", "cornered", "fleeing", "contained", "banished"];

  const DOMAIN_STATE_BIAS = {
    blades: { aggression: 2, concealment: 0, hunger: 1, ritual: 0 },
    blood: { aggression: 0, concealment: 1, hunger: 1, ritual: 0 },
    relics: { aggression: 1, concealment: 1, hunger: 2, ritual: 0 },
    sigils: { aggression: 0, concealment: 2, hunger: 0, ritual: 2 }
  };

  const ENTITY_ARCHETYPES = {
    spirit: {
      defaultState: "watching",
      motives: ["revenge", "grief loop", "territorial haunting", "unfinished message"],
      behaviorWeights: { watch: 3, mislead: 2, haunt: 4, attack: 2, flee: 1, negotiate: 1 },
      signTags: ["cold_spot", "emf_spike", "repeated_phrase", "object_moved", "dream_echo"],
      weaknesses: ["salt", "iron", "anchor object", "remains", "emotional resolution"]
    },
    demon: {
      defaultState: "stalking",
      motives: ["corruption", "possession", "contract enforcement", "seal weakening"],
      behaviorWeights: { watch: 1, mislead: 4, tempt: 4, attack: 3, possess: 3, flee: 1, ritual: 2 },
      signTags: ["sulfur", "black_eyes", "layered_voice", "animal_panic", "burned_sigil"],
      weaknesses: ["holy water", "true name", "exorcism", "devil trap", "anchor destruction"]
    },
    fae: {
      defaultState: "watching",
      motives: ["bargain collection", "identity theft", "territory defense", "stolen child"],
      behaviorWeights: { watch: 3, mislead: 5, bargain: 4, attack: 2, flee: 2, lure: 3 },
      signTags: ["missing_time", "iron_aversion", "unseasonal_growth", "polite_threat", "memory_gap"],
      weaknesses: ["iron", "true name", "threshold rules", "contract reversal", "rowan"]
    },
    beast: {
      defaultState: "hunting",
      motives: ["feeding", "territory", "transformation impulse", "nest protection"],
      behaviorWeights: { watch: 1, stalk: 4, attack: 5, flee: 2, feed: 4, ambush: 3 },
      signTags: ["tracks", "half_eaten_body", "claw_marks", "animal_silence", "blood_trail"],
      weaknesses: ["silver", "fire", "bait trap", "tracking", "killbox"]
    },
    djinn: {
      defaultState: "watching",
      motives: ["wish distortion", "isolation", "vessel protection", "reality game"],
      behaviorWeights: { watch: 2, mislead: 5, isolate: 4, attack: 1, bargain: 2, flee: 2, illusion: 5 },
      signTags: ["reality_mismatch", "contradicting_story", "vessel_symbol", "missing_time", "false_room"],
      weaknesses: ["vessel", "binding phrase", "sealed container", "true environment", "ritual seal"]
    },
    cult: {
      defaultState: "stalking",
      motives: ["summoning", "coverup", "sacrifice", "ritual completion"],
      behaviorWeights: { watch: 2, mislead: 3, attack: 2, ritual: 5, flee: 1, recruit: 2, sabotage: 4 },
      signTags: ["chant_fragment", "circle_residue", "witness_intimidation", "missing_records", "staged_scene"],
      weaknesses: ["ritual disruption", "anchor denial", "witness testimony", "symbols", "evidence chain"]
    }
  };

  const BEHAVIOR_LIBRARY = {
    watch: {
      label: "Watch from concealment",
      publicTemplate: "Something unseen observes the Wardens without revealing itself.",
      privateTemplate: "{actor} feels watched. The feeling fades when they look directly toward it.",
      pressure: 0,
      createsSigns: ["cold_spot", "animal_silence", "unseen_observer"]
    },
    stalk: {
      label: "Stalk a separated target",
      publicTemplate: "The active threat shifts position and begins following the most isolated Warden.",
      privateTemplate: "{actor} hears movement pacing them from just outside the light.",
      pressure: 1,
      createsSigns: ["tracks", "blood_trail", "scratched_wall"]
    },
    haunt: {
      label: "Haunt the scene",
      publicTemplate: "The scene answers with a haunting: old sounds, displaced objects, and a repeated emotional pattern.",
      privateTemplate: "{actor} hears a phrase repeat in a voice that should not be there.",
      pressure: 1,
      createsSigns: ["repeated_phrase", "object_moved", "dream_echo"]
    },
    mislead: {
      label: "Plant false certainty",
      publicTemplate: "The case offers a clue that feels useful but points too cleanly toward the wrong answer.",
      privateTemplate: "{actor} finds a clue that looks decisive, but one detail feels staged.",
      pressure: 1,
      createsSigns: ["false_clue", "staged_scene", "contradicting_story"]
    },
    lure: {
      label: "Lure a target",
      publicTemplate: "A sound, light, voice, or familiar sign draws attention toward a dangerous location.",
      privateTemplate: "{actor} notices something meant specifically for them: a voice, shape, or symbol pulling them away.",
      pressure: 1,
      createsSigns: ["false_beacon", "familiar_voice", "threshold_mark"]
    },
    attack: {
      label: "Attack",
      publicTemplate: "The threat strikes. The attack is direct enough to prove the hunt has moved into open danger.",
      privateTemplate: "{actor} is hit by the first real strike before the others fully understand what is happening.",
      pressure: 2,
      createsSigns: ["fresh_attack", "blood_spatter", "impact_mark"]
    },
    ambush: {
      label: "Ambush",
      publicTemplate: "The enemy uses the team's assumptions against them and attacks from the wrong angle.",
      privateTemplate: "{actor} realizes too late that the safest-looking route was the trap.",
      pressure: 2,
      createsSigns: ["staged_scene", "hidden_approach", "fresh_attack"]
    },
    flee: {
      label: "Flee or reposition",
      publicTemplate: "The threat withdraws before the Wardens can finish confirming the truth.",
      privateTemplate: "{actor} sees the shape retreat through a route that should not exist.",
      pressure: 0,
      createsSigns: ["dropped_token", "escape_route", "distorted_path"]
    },
    feed: {
      label: "Feed",
      publicTemplate: "The threat feeds or replenishes itself. If ignored, it will return stronger.",
      privateTemplate: "{actor} finds evidence that the entity has fed recently and is no longer desperate.",
      pressure: 2,
      createsSigns: ["half_eaten_body", "drained_victim", "blood_trail"]
    },
    possess: {
      label: "Possession pressure",
      publicTemplate: "A host, witness, or Warden becomes a possible doorway for the entity.",
      privateTemplate: "{actor} feels a thought arrive that does not belong to them.",
      pressure: 2,
      createsSigns: ["black_eyes", "layered_voice", "memory_gap"]
    },
    tempt: {
      label: "Tempt or bargain",
      publicTemplate: "The threat offers a shortcut, a bargain, or a seemingly merciful answer.",
      privateTemplate: "{actor} hears the offer clearly: one secret in exchange for one compromise.",
      pressure: 1,
      createsSigns: ["contract_trace", "polite_threat", "private_offer"]
    },
    bargain: {
      label: "Invoke bargain law",
      publicTemplate: "Rules of invitation, debt, promise, or exchange begin shaping the scene.",
      privateTemplate: "{actor} realizes a casual phrase may have counted as agreement.",
      pressure: 1,
      createsSigns: ["offering_removed", "polite_threat", "threshold_mark"]
    },
    ritual: {
      label: "Advance ritual",
      publicTemplate: "The occult structure progresses. A circle strengthens, a seal weakens, or a catalyst nears completion.",
      privateTemplate: "{actor} sees a symbol complete itself one line at a time.",
      pressure: 2,
      createsSigns: ["circle_residue", "chant_fragment", "burned_sigil"]
    },
    sabotage: {
      label: "Sabotage preparation",
      publicTemplate: "Gear, wards, evidence, or escape routes are compromised.",
      privateTemplate: "{actor} notices the team's preparation has been altered by someone who knew exactly where to touch it.",
      pressure: 1,
      createsSigns: ["damaged_gear", "moved_salt", "missing_records"]
    },
    isolate: {
      label: "Isolate a Warden",
      publicTemplate: "The space bends socially, physically, or supernaturally to separate one Warden from the group.",
      privateTemplate: "{actor} looks back and the hallway is longer than it was.",
      pressure: 2,
      createsSigns: ["false_room", "missing_time", "distorted_path"]
    },
    illusion: {
      label: "Rewrite local reality",
      publicTemplate: "The immediate environment stops agreeing with itself.",
      privateTemplate: "{actor} sees two versions of the room overlap, and only one has a door.",
      pressure: 1,
      createsSigns: ["reality_mismatch", "false_room", "contradicting_story"]
    },
    recruit: {
      label: "Recruit or pressure NPC",
      publicTemplate: "An NPC is pressured, recruited, blackmailed, or turned into a tool of the threat.",
      privateTemplate: "{actor} notices a witness has started repeating phrases they did not know earlier.",
      pressure: 1,
      createsSigns: ["witness_intimidation", "changed_behavior", "shared_phrase"]
    },
    negotiate: {
      label: "Try to communicate",
      publicTemplate: "The entity attempts contact, but the message arrives distorted by motive and hunger.",
      privateTemplate: "{actor} receives a message meant only for them.",
      pressure: 0,
      createsSigns: ["repeated_phrase", "private_message", "symbol_response"]
    }
  };

  const SIGN_LIBRARY = {
    cold_spot: { label: "Cold Spot", type: "environmental", clue: "A localized temperature drop suggests spirit activity or threshold instability.", skills: ["Awareness", "Presence Sense", "Investigation"] },
    emf_spike: { label: "EMF Spike", type: "technical", clue: "Electromagnetic activity spikes around the anchor path or manifestation zone.", skills: ["Tinkering", "Forensics", "Presence Sense"] },
    repeated_phrase: { label: "Repeated Phrase", type: "witness/social", clue: "A phrase repeats across witnesses, dreams, or recordings, pointing to motive or anchor memory.", skills: ["Investigation", "Insight", "Spirit Communication"] },
    object_moved: { label: "Moved Object", type: "physical", clue: "A moved object marks the entity's preferred path or emotional focus.", skills: ["Investigation", "Awareness"] },
    dream_echo: { label: "Dream Echo", type: "psychic", clue: "A dream repeats a scene the entity cannot say directly.", skills: ["Composure", "Spirit Communication", "Occult Knowledge"] },
    sulfur: { label: "Sulfur Trace", type: "infernal", clue: "Sulfur, ash, or scorched air points toward infernal manifestation.", skills: ["Occult Knowledge", "Presence Sense"] },
    black_eyes: { label: "Black-Eyed Reflection", type: "host tell", clue: "A host reflection shows infernal pressure before the body does.", skills: ["Awareness", "Composure", "Occult Knowledge"] },
    layered_voice: { label: "Layered Voice", type: "host tell", clue: "Layered speech implies possession, legion behavior, or a ritual channel.", skills: ["Spirit Communication", "Occult Knowledge"] },
    animal_panic: { label: "Animal Panic", type: "environmental", clue: "Animals refuse thresholds or panic near a hidden supernatural presence.", skills: ["Survival", "Awareness", "Instinct"] },
    burned_sigil: { label: "Burned Sigil", type: "ritual", clue: "A burned symbol reveals active ritual structure, infernal contact, or a failed ward.", skills: ["Sigil Reading", "Occult Knowledge", "Ritual Analysis"] },
    missing_time: { label: "Missing Time", type: "temporal", clue: "Missing time indicates fae contact, djinn illusion, or threshold distortion.", skills: ["Investigation", "Composure", "Occult Knowledge"] },
    iron_aversion: { label: "Iron Aversion", type: "behavioral", clue: "A subject avoids iron unconsciously, narrowing toward fae or changeling influence.", skills: ["Insight", "Investigation"] },
    unseasonal_growth: { label: "Unseasonal Growth", type: "environmental", clue: "Flowers, rot, frost, or growth out of season indicate fae territory or living curse.", skills: ["Survival", "Occult Knowledge"] },
    polite_threat: { label: "Polite Threat", type: "social", clue: "Formal language hides coercion, bargain law, or court fae influence.", skills: ["Insight", "Charisma", "Occult Knowledge"] },
    memory_gap: { label: "Memory Gap", type: "mental", clue: "Inconsistent memory points to possession, fae manipulation, or reality distortion.", skills: ["Interview", "Insight", "Composure"] },
    tracks: { label: "Unnatural Tracks", type: "physical", clue: "Tracks show size, gait, direction, and whether the threat is physical or staged.", skills: ["Tracking", "Survival", "Investigation"] },
    half_eaten_body: { label: "Half-Eaten Body", type: "body", clue: "Feeding pattern points toward beast, wendigo, devouring demon, or staged misdirection.", skills: ["Forensics", "Survival", "Occult Knowledge"] },
    claw_marks: { label: "Claw Marks", type: "physical", clue: "Claw depth and spacing narrow creature type and strength.", skills: ["Tracking", "Forensics"] },
    animal_silence: { label: "Animal Silence", type: "environmental", clue: "A sudden absence of animals marks predator territory or supernatural fear pressure.", skills: ["Awareness", "Survival"] },
    blood_trail: { label: "Blood Trail", type: "physical", clue: "Blood direction and amount reveal whether the victim was carried, dragged, or baited.", skills: ["Tracking", "Forensics"] },
    reality_mismatch: { label: "Reality Mismatch", type: "reality", clue: "The scene contradicts records, memory, or geometry, pointing toward djinn or threshold effects.", skills: ["Investigation", "Composure", "Occult Knowledge"] },
    contradicting_story: { label: "Contradicting Story", type: "witness/social", clue: "Contradictions are patterned, not random, suggesting manipulation.", skills: ["Insight", "Investigation", "Interview"] },
    vessel_symbol: { label: "Vessel Symbol", type: "ritual", clue: "Marks on a container or host indicate an anchor, vessel, or binding phrase.", skills: ["Sigil Reading", "Occult Knowledge"] },
    false_room: { label: "False Room", type: "reality", clue: "An impossible room, extra hallway, or wrong door suggests illusion or spatial manipulation.", skills: ["Awareness", "Composure", "Occult Knowledge"] },
    chant_fragment: { label: "Chant Fragment", type: "ritual", clue: "A partial chant identifies ritual stage, entity class, or catalyst.", skills: ["Occult Knowledge", "Ritual Analysis"] },
    circle_residue: { label: "Circle Residue", type: "ritual", clue: "Residue shows what was contained, summoned, or excluded.", skills: ["Sigil Reading", "Ritual Casting", "Investigation"] },
    witness_intimidation: { label: "Witness Intimidation", type: "social", clue: "Fearful witnesses indicate cult pressure, demon threats, or organized coverup.", skills: ["Insight", "Charisma", "Investigation"] },
    missing_records: { label: "Missing Records", type: "records", clue: "Removed files indicate human involvement, institutional coverup, or entity-aware faction.", skills: ["Research", "Forgery", "Archive Retrieval"] },
    staged_scene: { label: "Staged Scene", type: "physical/social", clue: "The scene is designed to produce a wrong theory.", skills: ["Investigation", "Forensics", "Pattern Study"] },
    fresh_attack: { label: "Fresh Attack", type: "violence", clue: "The attack timing indicates current location, hunger, or confidence.", skills: ["Investigation", "Tracking", "Awareness"] },
    damaged_gear: { label: "Damaged Gear", type: "sabotage", clue: "Preparation was targeted; the enemy knows Warden methods.", skills: ["Tinkering", "Awareness", "Investigation"] },
    threshold_mark: { label: "Threshold Mark", type: "ritual/entry", clue: "Doorways, windows, or crossings are part of the entity's access logic.", skills: ["Occult Knowledge", "Sigil Reading"] },
    false_clue: { label: "False Clue", type: "misdirection", clue: "A clue too convenient to trust; compare it against independent evidence.", skills: ["Investigation", "Insight", "Pattern Study"] },
    unseen_observer: { label: "Unseen Observer", type: "presence", clue: "The threat has line-of-sight or supernatural awareness of the team.", skills: ["Awareness", "Presence Sense"] },
    scratched_wall: { label: "Scratched Wall", type: "physical", clue: "Scratches indicate pathing, distress, or deliberate marking.", skills: ["Investigation", "Tracking"] },
    impact_mark: { label: "Impact Mark", type: "violence", clue: "Impact direction reveals attacker position and force.", skills: ["Forensics", "Investigation"] },
    hidden_approach: { label: "Hidden Approach", type: "positioning", clue: "The attack used a route the team has not mapped.", skills: ["Awareness", "Navigation"] },
    dropped_token: { label: "Dropped Token", type: "object", clue: "A left-behind object may be bait, anchor, or accidental evidence.", skills: ["Investigation", "Occult Knowledge"] },
    escape_route: { label: "Escape Route", type: "movement", clue: "The entity's exit path reveals constraints or territory.", skills: ["Tracking", "Navigation"] },
    distorted_path: { label: "Distorted Path", type: "reality", clue: "Movement does not match normal space; threshold rules are active.", skills: ["Composure", "Occult Knowledge"] },
    drained_victim: { label: "Drained Victim", type: "body", clue: "Draining pattern indicates vampire, wraith, demon, or ritual siphon.", skills: ["Forensics", "Occult Knowledge"] },
    contract_trace: { label: "Contract Trace", type: "infernal/fae", clue: "An agreement has supernatural weight and can be exploited through wording.", skills: ["Occult Knowledge", "Insight", "Research"] },
    private_offer: { label: "Private Offer", type: "temptation", clue: "The entity is testing individual weakness, not just group defenses.", skills: ["Composure", "Will", "Insight"] },
    offering_removed: { label: "Offering Removed", type: "fae/ritual", clue: "An accepted offering may create invitation, debt, or proof of entity presence.", skills: ["Occult Knowledge", "Investigation"] },
    moved_salt: { label: "Moved Salt", type: "sabotage", clue: "A protective line was altered by physical agent, host, or trickster force.", skills: ["Awareness", "Tinkering", "Investigation"] },
    changed_behavior: { label: "Changed Behavior", type: "witness", clue: "A witness changed after contact, pressure, or partial influence.", skills: ["Insight", "Interview"] },
    shared_phrase: { label: "Shared Phrase", type: "pattern", clue: "Multiple mouths repeat one source intelligence.", skills: ["Pattern Study", "Investigation"] },
    private_message: { label: "Private Message", type: "communication", clue: "The entity knows or claims to know something personal.", skills: ["Composure", "Spirit Communication"] },
    symbol_response: { label: "Symbol Response", type: "ritual", clue: "A mark reacts to names, presence, blood, or light.", skills: ["Sigil Reading", "Occult Knowledge"] }
  };

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function weightedChoice(weights, rng = DEFAULT_RNG) {
    const entries = Object.entries(weights || {}).filter(([, w]) => Number(w) > 0);
    const total = entries.reduce((sum, [, w]) => sum + Number(w), 0);
    if (!total) return null;
    let roll = rng() * total;
    for (const [key, weight] of entries) {
      roll -= Number(weight);
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  function normalizeEntityType(entity) {
    const raw = String(entity?.type || entity?.category || entity?.entityType || "spirit").toLowerCase();
    if (raw.includes("demon") || raw.includes("infernal") || raw.includes("possess")) return "demon";
    if (raw.includes("fae") || raw.includes("changeling") || raw.includes("redcap") || raw.includes("hag")) return "fae";
    if (raw.includes("beast") || raw.includes("creature") || raw.includes("were") || raw.includes("wendigo") || raw.includes("vampire") || raw.includes("rugaru")) return "beast";
    if (raw.includes("djinn")) return "djinn";
    if (raw.includes("cult") || raw.includes("human")) return "cult";
    return "spirit";
  }

  function getArchetype(entity) {
    return ENTITY_ARCHETYPES[normalizeEntityType(entity)] || ENTITY_ARCHETYPES.spirit;
  }

  function ensureCreatureState(caseState) {
    const next = caseState || {};
    if (!next.creatureAI) {
      const entity = next.trueEntity || next.entity || {};
      const archetype = getArchetype(entity);
      next.creatureAI = {
        state: entity.state || archetype.defaultState,
        suspicion: 0,
        aggression: 0,
        hunger: 0,
        fear: 0,
        ritualProgress: 0,
        knowsWardens: false,
        targetActor: null,
        lastAction: null,
        behaviorHistory: [],
        discoveredSigns: [],
        hiddenSigns: [],
        entityMemory: [],
        escalationTier: 0
      };
    }
    if (!Array.isArray(next.publicLog)) next.publicLog = [];
    if (!next.privateLogs) next.privateLogs = {};
    if (!Array.isArray(next.clues)) next.clues = [];
    if (!Array.isArray(next.hiddenClues)) next.hiddenClues = [];
    if (typeof next.pressureClock !== "number") next.pressureClock = 0;
    return next;
  }

  function derivePressureTier(clock) {
    if (clock >= 10) return "crisis";
    if (clock >= 7) return "high";
    if (clock >= 4) return "moderate";
    if (clock >= 1) return "low";
    return "quiet";
  }

  function advanceStateByPressure(ai, pressureClock) {
    const tier = derivePressureTier(pressureClock);
    if (ai.state === "contained" || ai.state === "banished") return ai.state;
    if (tier === "quiet" && ai.state === "dormant") return "watching";
    if (tier === "low" && ["dormant", "watching"].includes(ai.state)) return "stalking";
    if (tier === "moderate" && ["dormant", "watching", "stalking"].includes(ai.state)) return "hunting";
    if (tier === "high" && ["dormant", "watching", "stalking", "hunting"].includes(ai.state)) return "manifesting";
    if (tier === "crisis" && ai.state !== "banished") return "cornered";
    return ai.state;
  }

  function buildBehaviorWeights(caseState, parsedAction = {}, rollResult = {}) {
    const entity = caseState.trueEntity || caseState.entity || {};
    const archetype = getArchetype(entity);
    const weights = { ...archetype.behaviorWeights };
    const domain = String(caseState.caseSeed?.suit || caseState.domain || "").toLowerCase();
    const bias = DOMAIN_STATE_BIAS[domain] || {};
    const ai = caseState.creatureAI || {};
    const intent = parsedAction.intent || "";

    if (caseState.pressureClock >= 7) {
      weights.attack = (weights.attack || 0) + 2;
      weights.ritual = (weights.ritual || 0) + 1;
      weights.flee = (weights.flee || 0) + 1;
    }
    if (rollResult?.outcome === "criticalFailure" || rollResult?.success === false) {
      weights.attack = (weights.attack || 0) + 2;
      weights.mislead = (weights.mislead || 0) + 1;
      weights.sabotage = (weights.sabotage || 0) + 1;
    }
    if (["research", "investigate"].includes(intent)) {
      weights.mislead = (weights.mislead || 0) + 2;
      weights.watch = (weights.watch || 0) + 1;
    }
    if (["talk", "ask", "social"].includes(intent)) {
      weights.tempt = (weights.tempt || 0) + 1;
      weights.recruit = (weights.recruit || 0) + 1;
      weights.mislead = (weights.mislead || 0) + 1;
    }
    if (["prep", "ward", "trap"].includes(intent)) {
      weights.sabotage = (weights.sabotage || 0) + 2;
      weights.attack = (weights.attack || 0) + 1;
    }
    if (["attack", "cast", "confront"].includes(intent)) {
      weights.attack = (weights.attack || 0) + 2;
      weights.flee = (weights.flee || 0) + 1;
    }
    if (ai.suspicion >= 3) weights.stalk = (weights.stalk || 0) + 2;
    if (ai.aggression + (bias.aggression || 0) >= 3) weights.attack = (weights.attack || 0) + 2;
    if (ai.hunger + (bias.hunger || 0) >= 3) weights.feed = (weights.feed || 0) + 2;
    if ((bias.ritual || 0) >= 2) weights.ritual = (weights.ritual || 0) + 2;
    return weights;
  }

  function selectTargetActor(caseState, parsedAction = {}) {
    const actors = [];
    if (parsedAction.actor) actors.push(parsedAction.actor);
    if (Array.isArray(caseState.party)) {
      for (const p of caseState.party) actors.push(typeof p === "string" ? p : p.name);
    }
    const ai = caseState.creatureAI || {};
    if (ai.targetActor) return ai.targetActor;
    return actors.filter(Boolean)[0] || "the nearest Warden";
  }

  function createSigns(caseState, behaviorKey, rng = DEFAULT_RNG) {
    const behavior = BEHAVIOR_LIBRARY[behaviorKey] || BEHAVIOR_LIBRARY.watch;
    const entity = caseState.trueEntity || caseState.entity || {};
    const archetype = getArchetype(entity);
    const pool = Array.from(new Set([...(behavior.createsSigns || []), ...(archetype.signTags || [])]));
    const count = behaviorKey === "attack" || behaviorKey === "ritual" ? 2 : 1;
    const chosen = [];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length);
      const key = pool.splice(idx, 1)[0];
      const sign = SIGN_LIBRARY[key];
      if (sign) chosen.push({ key, ...deepClone(sign), discovered: false, createdAt: Date.now(), sourceBehavior: behaviorKey });
    }
    return chosen;
  }

  function addLog(caseState, privacy, actor, text, meta = {}) {
    const entry = { id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 10000), time: new Date().toISOString(), actor: actor || null, text, meta };
    if (privacy === "private" && actor) {
      if (!caseState.privateLogs[actor]) caseState.privateLogs[actor] = [];
      caseState.privateLogs[actor].push(entry);
    } else {
      caseState.publicLog.push(entry);
    }
    return entry;
  }

  function creatureTakeTurn(caseStateInput, parsedAction = {}, rollResult = {}, options = {}) {
    const rng = options.rng || DEFAULT_RNG;
    const caseState = ensureCreatureState(deepClone(caseStateInput));
    const ai = caseState.creatureAI;
    ai.state = advanceStateByPressure(ai, caseState.pressureClock);

    const weights = buildBehaviorWeights(caseState, parsedAction, rollResult);
    let behaviorKey = options.forceBehavior || weightedChoice(weights, rng) || "watch";
    if (!BEHAVIOR_LIBRARY[behaviorKey]) behaviorKey = "watch";

    const behavior = BEHAVIOR_LIBRARY[behaviorKey];
    const actor = selectTargetActor(caseState, parsedAction);
    const privacy = parsedAction.privacy === "private" ? "private" : "public";

    const createdSigns = createSigns(caseState, behaviorKey, rng);
    for (const sign of createdSigns) {
      // Hidden until found. Violent signs can be immediately public.
      if (["fresh_attack", "blood_spatter", "impact_mark", "half_eaten_body"].includes(sign.key)) {
        sign.discovered = true;
        caseState.clues.push(sign);
        ai.discoveredSigns.push(sign.key);
      } else {
        caseState.hiddenClues.push(sign);
        ai.hiddenSigns.push(sign.key);
      }
    }

    const publicText = behavior.publicTemplate.replaceAll("{actor}", actor);
    const privateText = behavior.privateTemplate.replaceAll("{actor}", actor);
    addLog(caseState, privacy, actor, privacy === "private" ? privateText : publicText, { behavior: behaviorKey, state: ai.state, createdSigns: createdSigns.map(s => s.key) });

    ai.lastAction = behaviorKey;
    ai.behaviorHistory.push({ behavior: behaviorKey, state: ai.state, pressureBefore: caseState.pressureClock, actor, time: new Date().toISOString() });
    ai.behaviorHistory = ai.behaviorHistory.slice(-20);
    ai.suspicion += ["investigate", "research", "talk", "attack", "cast", "prep"].includes(parsedAction.intent) ? 1 : 0;
    ai.aggression += ["attack", "ambush", "feed"].includes(behaviorKey) ? 1 : 0;
    ai.hunger += behaviorKey === "feed" ? 1 : 0;
    ai.ritualProgress += behaviorKey === "ritual" ? 1 : 0;
    ai.knowsWardens = ai.knowsWardens || ["attack", "stalk", "ambush", "watch", "mislead"].includes(behaviorKey);
    caseState.pressureClock += behavior.pressure || 0;
    ai.escalationTier = Math.max(ai.escalationTier || 0, Math.floor(caseState.pressureClock / 3));

    return {
      caseState,
      behavior: { key: behaviorKey, ...behavior },
      createdSigns,
      pressureTier: derivePressureTier(caseState.pressureClock)
    };
  }

  function discoverSigns(caseStateInput, parsedAction = {}, rollResult = {}, options = {}) {
    const caseState = ensureCreatureState(deepClone(caseStateInput));
    const actor = parsedAction.actor || "Warden";
    const target = String(parsedAction.target || parsedAction.topic || "").toLowerCase();
    const outcome = rollResult.outcome || (rollResult.success ? "success" : "failure");
    const takeCount = outcome === "criticalSuccess" ? 3 : outcome === "strongSuccess" ? 2 : outcome === "success" ? 1 : outcome === "partial" ? 1 : 0;

    if (!takeCount) {
      caseState.pressureClock += 1;
      addLog(caseState, parsedAction.privacy, actor, `${actor} searches, but the signs do not line up yet. The delay gives the threat room to move.`, { discoverSigns: false });
      return { caseState, discovered: [], falseLead: true };
    }

    const hidden = caseState.hiddenClues || [];
    const matches = hidden.filter(s => {
      if (!target) return true;
      return String(s.label + " " + s.type + " " + s.clue + " " + (s.skills || []).join(" ")).toLowerCase().includes(target);
    });
    const source = matches.length ? matches : hidden;
    const discovered = source.slice(0, takeCount).map(s => ({ ...s, discovered: true }));

    const discoveredIds = new Set(discovered.map(s => s.createdAt + ":" + s.key));
    caseState.hiddenClues = hidden.filter(s => !discoveredIds.has(s.createdAt + ":" + s.key));
    caseState.clues = [...(caseState.clues || []), ...discovered];

    if (discovered.length) {
      addLog(caseState, parsedAction.privacy, actor, `${actor} finds ${discovered.map(s => s.label).join(", ")}. ${discovered[0].clue}`, { discoveredSigns: discovered.map(s => s.key) });
    }

    return { caseState, discovered, falseLead: false };
  }

  function applyPressureEscalation(caseStateInput, options = {}) {
    const caseState = ensureCreatureState(deepClone(caseStateInput));
    const ai = caseState.creatureAI;
    const before = ai.state;
    ai.state = advanceStateByPressure(ai, caseState.pressureClock);
    const after = ai.state;
    if (before !== after) {
      addLog(caseState, "public", null, `Pressure escalates: the threat shifts from ${before} to ${after}.`, { stateChange: [before, after] });
    }
    return caseState;
  }

  function getKnownCreatureProfile(caseState) {
    const entity = caseState?.trueEntity || caseState?.entity || {};
    const archetype = getArchetype(entity);
    return {
      type: normalizeEntityType(entity),
      state: caseState?.creatureAI?.state || archetype.defaultState,
      knownSigns: (caseState?.clues || []).map(c => c.label || c.key),
      suspectedWeaknesses: archetype.weaknesses,
      motives: archetype.motives
    };
  }

  return {
    STATE_SEQUENCE,
    ENTITY_ARCHETYPES,
    BEHAVIOR_LIBRARY,
    SIGN_LIBRARY,
    ensureCreatureState,
    creatureTakeTurn,
    discoverSigns,
    applyPressureEscalation,
    getKnownCreatureProfile,
    derivePressureTier,
    _private: { weightedChoice, normalizeEntityType, buildBehaviorWeights, createSigns }
  };
});
