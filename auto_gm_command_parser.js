/*
Night Wardens Auto-GM Command Parser — Pass 2
Turns typed player input into structured action objects for the Auto-GM engine.

Design goals:
- Works in browser or Node.
- No external dependencies.
- Accepts Infocom-style input:
  "look"
  "Riley: ask Mrs Harlan about the bell"
  "private Alex: research sigil"
  "public Riley: investigate altar; Sam: prep salt line; Alex: attack entity"
- Produces normalized actions that later passes can resolve with character sheets, rolls, witnesses, entities, and campaign state.

Expected output action shape:
{
  raw, privacy, actor, verb, intent, target, topic, location, item, skillHint,
  rollProfile, confidence, flags, tokens, unresolved
}
*/

(function(global){
  "use strict";

  const DEFAULT_LEXICON = {
    privacyWords: {
      public: ["public", "party", "shared", "group", "open"],
      private: ["private", "secret", "solo", "whisper", "hidden", "dm", "gm"]
    },
    verbSynonyms: {
      look: ["look", "examine", "inspect", "view", "observe", "survey", "scan"],
      investigate: ["investigate", "search", "check", "inspect", "examine", "analyze", "process", "study"],
      talk: ["talk", "ask", "question", "interview", "press", "persuade", "comfort", "threaten", "intimidate", "deceive"],
      research: ["research", "lookup", "look up", "cross-reference", "archive", "google", "records", "read"],
      prepare: ["prep", "prepare", "ready", "setup", "set up", "place", "draw", "load", "ward", "trap", "craft"],
      cast: ["cast", "ritual", "rite", "banish", "bind", "exorcise", "ward", "summon", "cleanse", "invoke"],
      move: ["move", "go", "travel", "enter", "leave", "return", "approach", "retreat", "follow"],
      attack: ["attack", "shoot", "stab", "strike", "hit", "grapple", "shove", "tackle", "fire", "slash"],
      use: ["use", "activate", "trigger", "apply", "throw", "pour", "ignite"],
      help: ["help", "assist", "support", "aid", "cover"],
      wait: ["wait", "hold", "listen", "pause", "ready action"],
      inventory: ["inventory", "gear", "items", "equipment"],
      status: ["status", "sheet", "health", "marks", "state"],
      split: ["split", "send", "assign"],
      join: ["join", "regroup", "meet"],
      note: ["note", "record", "log", "write"]
    },
    intents: {
      look: { skillHint: "Awareness", defaultAttribute: "Instinct", phase: "any" },
      investigate: { skillHint: "Investigation", defaultAttribute: "Intellect", phase: "investigation" },
      talk: { skillHint: "Insight/Persuasion/Deception/Intimidation", defaultAttribute: "Charisma", phase: "investigation" },
      research: { skillHint: "Research/Occult Knowledge", defaultAttribute: "Intellect", phase: "investigation" },
      prepare: { skillHint: "Crafting/Tinkering/Survival/Warding", defaultAttribute: "Intellect", phase: "preparation" },
      cast: { skillHint: "Ritual Basics/Ritual Casting/Binding/Warding", defaultAttribute: "Will", phase: "occult" },
      move: { skillHint: "Navigation/Stealth/Survival", defaultAttribute: "Prowess", phase: "any" },
      attack: { skillHint: "Melee Combat/Firearms/Energy Control", defaultAttribute: "Force/Prowess/Will", phase: "confrontation" },
      use: { skillHint: "Relevant gear skill", defaultAttribute: "Varies", phase: "any" },
      help: { skillHint: "Assist with relevant skill", defaultAttribute: "Varies", phase: "any" },
      wait: { skillHint: "Composure/Awareness", defaultAttribute: "Will/Instinct", phase: "any" },
      inventory: { skillHint: "None", defaultAttribute: "None", phase: "meta" },
      status: { skillHint: "None", defaultAttribute: "None", phase: "meta" },
      split: { skillHint: "None", defaultAttribute: "None", phase: "meta" },
      join: { skillHint: "None", defaultAttribute: "None", phase: "meta" },
      note: { skillHint: "None", defaultAttribute: "None", phase: "meta" }
    },
    targetTypes: {
      witness: ["witness", "survivor", "victim", "sheriff", "priest", "mother", "father", "child", "neighbor", "doctor", "nurse", "cop", "deputy", "handler", "quartermaster"],
      location: ["church", "basement", "mine", "hospital", "motel", "road", "woods", "graveyard", "cemetery", "safehouse", "archive", "crime scene", "house", "room", "attic", "tunnel", "altar"],
      evidence: ["body", "corpse", "blood", "ash", "symbol", "sigil", "circle", "bell", "phone", "recording", "footprints", "tracks", "scratches", "door", "window", "journal", "file", "photo"],
      entity: ["entity", "ghost", "spirit", "demon", "fae", "djinn", "werewolf", "wendigo", "vampire", "creature", "monster", "possessor", "thing"],
      gear: ["salt", "iron", "silver", "holy water", "shotgun", "knife", "blade", "trap", "ward", "rosary", "lantern", "chain", "relic", "sigil", "circle", "ammo", "gasoline", "fire"],
      spell: ["veil snap", "force pulse", "lantern spark", "grave chill", "shield burst", "ash mark", "static hex", "spirit lash", "protective circle", "binding chain", "exorcist's litany", "anchor revelation"]
    },
    prepositions: ["about", "with", "using", "at", "to", "from", "in", "into", "on", "under", "near", "inside", "outside", "through"],
    filler: ["the", "a", "an", "please", "i", "we", "my", "our", "their", "his", "her", "its", "and", "then"],
    conjunctions: [";", " and then ", " then ", " & "]
  };

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function normalizeText(str){
    return String(str || "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lower(str){ return normalizeText(str).toLowerCase(); }

  function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function wordBoundaryRegex(phrase){
    return new RegExp("(^|\\b)" + escapeRegExp(phrase).replace(/\s+/g, "\\s+") + "(\\b|$)", "i");
  }

  function findFirstPhrase(text, phrases){
    const sorted = [...phrases].sort((a,b)=>b.length-a.length);
    for(const phrase of sorted){
      if(wordBoundaryRegex(phrase).test(text)) return phrase;
    }
    return null;
  }

  function detectPrivacy(text, lexicon){
    const l = lower(text);
    for(const [privacy, words] of Object.entries(lexicon.privacyWords)){
      const match = findFirstPhrase(l, words);
      if(match) return { privacy, word: match };
    }
    return { privacy: "public", word: null };
  }

  function stripLeadingPrivacy(text, privacyHit){
    if(!privacyHit || !privacyHit.word) return text;
    const rx = new RegExp("^\\s*" + escapeRegExp(privacyHit.word) + "\\s+", "i");
    return text.replace(rx, "").trim();
  }

  function splitCommands(input, lexicon){
    let text = normalizeText(input);
    if(!text) return [];
    // Normalize line breaks as separators.
    text = text.replace(/\n+/g, "; ");
    // Preserve "and" inside names/topics by prioritizing semicolon. Then handle common command connectors.
    let parts = text.split(";").map(s=>s.trim()).filter(Boolean);
    if(parts.length === 1){
      // Only split on " then " and " and then " for safety.
      parts = parts[0].split(/\s+(?:and\s+then|then)\s+/i).map(s=>s.trim()).filter(Boolean);
    }
    return parts;
  }

  function parseActorPrefix(text){
    // Supports "Riley: investigate altar" and "Riley investigate altar" only when first token is capitalized and command verb follows.
    const colon = text.match(/^([^:]{1,40}):\s*(.+)$/);
    if(colon) return { actor: colon[1].trim(), body: colon[2].trim(), confidence: 1 };
    return { actor: null, body: text.trim(), confidence: 0 };
  }

  function detectIntent(text, lexicon){
    const l = lower(text);
    const candidates = [];
    for(const [intent, synonyms] of Object.entries(lexicon.verbSynonyms)){
      for(const phrase of synonyms){
        const rx = wordBoundaryRegex(phrase);
        const m = l.match(rx);
        if(m){
          candidates.push({ intent, phrase, index: m.index, length: phrase.length });
        }
      }
    }
    if(!candidates.length) return { intent: "unknown", verb: null, confidence: 0 };
    candidates.sort((a,b)=>{
      // Prefer earliest match, then longer phrase.
      if(a.index !== b.index) return a.index - b.index;
      return b.length - a.length;
    });
    const best = candidates[0];
    return { intent: best.intent, verb: best.phrase, confidence: best.index <= 5 ? 0.95 : 0.75 };
  }

  function removeVerb(text, verb){
    if(!verb) return text;
    return text.replace(wordBoundaryRegex(verb), " ").replace(/\s+/g," ").trim();
  }

  function tokenize(text, lexicon){
    return lower(text)
      .replace(/[^\w\s'/-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter(t => !lexicon.filler.includes(t));
  }

  function detectKnownTarget(text, lexicon){
    const l = lower(text);
    const hits = [];
    for(const [type, terms] of Object.entries(lexicon.targetTypes)){
      const phrase = findFirstPhrase(l, terms);
      if(phrase) hits.push({ type, value: phrase, index: l.indexOf(phrase), confidence: phrase.length > 4 ? 0.8 : 0.65 });
    }
    if(!hits.length) return null;
    hits.sort((a,b)=>a.index-b.index || b.value.length-a.value.length);
    return hits[0];
  }

  function extractTopic(text, lexicon){
    const l = lower(text);
    const topicPreps = ["about", "regarding", "concerning", "on"];
    for(const prep of topicPreps){
      const rx = new RegExp("\\b" + prep + "\\b\\s+(.+)$", "i");
      const m = text.match(rx);
      if(m) return m[1].trim();
    }
    return "";
  }

  function extractLocation(text){
    const rx = /\b(?:to|at|in|inside|near|under|outside|into|from)\s+(.+)$/i;
    const m = text.match(rx);
    if(m) return m[1].trim();
    return "";
  }

  function inferRollProfile(action, lexicon){
    const meta = lexicon.intents[action.intent] || {};
    let attribute = meta.defaultAttribute || "Varies";
    let skill = meta.skillHint || "Relevant Skill";
    let supports = [];

    const t = (action.target || "").toLowerCase();
    const topic = (action.topic || "").toLowerCase();
    const raw = (action.raw || "").toLowerCase();

    if(action.intent === "attack"){
      if(/shoot|fire|gun|shotgun|pistol|rifle|crossbow/.test(raw)){ attribute = "Prowess"; skill = "Firearms"; }
      else if(/cast|spell|energy|lash|pulse/.test(raw)){ attribute = "Will"; skill = "Energy Control"; }
      else { attribute = "Force"; skill = "Melee Combat"; }
      supports = ["Awareness", "Kill Setup"];
    }

    if(action.intent === "talk"){
      if(/threaten|intimidate|scare/.test(raw)){ attribute = "Charisma"; skill = "Intimidation"; }
      else if(/lie|deceive|cover|pretend/.test(raw)){ attribute = "Charisma"; skill = "Deception"; }
      else if(/comfort|calm|empathy/.test(raw)){ attribute = "Charisma"; skill = "Insight"; }
      else { attribute = "Charisma"; skill = "Persuasion/Insight"; }
      supports = ["Investigation", "Observation"];
    }

    if(action.intent === "investigate"){
      if(/track|footprint|trail|woods|blood trail/.test(raw)){ attribute = "Instinct"; skill = "Tracking"; supports = ["Survival", "Awareness"]; }
      else if(/body|forensic|corpse|wound|blood/.test(raw)){ attribute = "Intellect"; skill = "Forensics"; supports = ["Investigation", "Occult Knowledge"]; }
      else if(/symbol|sigil|circle|ritual|altar/.test(raw)){ attribute = "Intellect"; skill = "Occult Knowledge"; supports = ["Investigation", "Sigil Reading"]; }
      else { attribute = "Intellect"; skill = "Investigation"; supports = ["Awareness", "Occult Knowledge"]; }
    }

    if(action.intent === "research"){
      if(/symbol|sigil|ritual|demon|fae|spirit|ghost|entity|curse/.test(raw + " " + topic)){ attribute = "Intellect"; skill = "Occult Knowledge"; supports = ["Research", "Symbolism"]; }
      else { attribute = "Intellect"; skill = "Research"; supports = ["Investigation", "Archive Retrieval"]; }
    }

    if(action.intent === "prepare"){
      if(/trap|rig|wire|device|ammo|craft/.test(raw)){ attribute = "Intellect"; skill = "Tinkering"; supports = ["Crafting", "Trap Setting"]; }
      else if(/salt|ward|circle|sigil/.test(raw)){ attribute = "Will"; skill = "Warding"; supports = ["Ritual Basics", "Occult Knowledge"]; }
      else { attribute = "Intellect"; skill = "Preparation"; supports = ["Survival", "Awareness"]; }
    }

    if(action.intent === "cast"){
      if(/bind|chain|hold/.test(raw)){ attribute = "Will"; skill = "Binding"; supports = ["Ritual Casting", "Sigil Reading"]; }
      else if(/ward|circle|protect/.test(raw)){ attribute = "Will"; skill = "Warding"; supports = ["Ritual Basics", "Sigil Reading"]; }
      else if(/exorcise|banish|cleanse/.test(raw)){ attribute = "Will"; skill = "Ritual Casting"; supports = ["Occult Knowledge", "Spirit Communication"]; }
      else if(/veil snap|presence|reveal|see/.test(raw)){ attribute = "Will"; skill = "Ritual Basics"; supports = ["Presence Sense", "Occult Knowledge"]; }
      else { attribute = "Will"; skill = "Energy Control/Ritual Basics"; supports = ["Focus", "Occult Knowledge"]; }
    }

    if(action.intent === "move"){
      if(/sneak|stealth|quiet/.test(raw)){ attribute = "Prowess"; skill = "Stealth"; supports = ["Awareness", "Survival"]; }
      else { attribute = "Prowess"; skill = "Movement"; supports = ["Awareness", "Survival"]; }
    }

    return {
      attribute,
      primarySkill: skill,
      supportSkills: supports.slice(0,2),
      phase: meta.phase || "any",
      rollNeeded: !["look","inventory","status","note","split","join","wait"].includes(action.intent)
    };
  }

  function parseSingleCommand(input, options = {}){
    const lexicon = options.lexicon || DEFAULT_LEXICON;
    const originalRaw = normalizeText(input);
    let privacyHit = detectPrivacy(originalRaw, lexicon);
    let stripped = stripLeadingPrivacy(originalRaw, privacyHit);
    const actorHit = parseActorPrefix(stripped);
    let body = actorHit.body;
    const intentHit = detectIntent(body, lexicon);
    let remainder = removeVerb(body, intentHit.verb);

    // Split command special case: "split Riley to church basement"
    let actor = actorHit.actor || options.defaultActor || null;
    if(intentHit.intent === "split"){
      const m = body.match(/\bsplit\s+(.+?)\s+(?:to|at|in|into)\s+(.+)$/i) || body.match(/\bsend\s+(.+?)\s+(?:to|at|in|into)\s+(.+)$/i);
      if(m){
        actor = m[1].trim();
        remainder = m[2].trim();
      }
    }

    // If no actor and command starts with "Name verb", infer actor if possible.
    if(!actor && options.knownActors && options.knownActors.length){
      for(const known of options.knownActors){
        const rx = new RegExp("^" + escapeRegExp(known) + "\\s+", "i");
        if(rx.test(body)){
          actor = known;
          body = body.replace(rx, "").trim();
          const newIntent = detectIntent(body, lexicon);
          Object.assign(intentHit, newIntent);
          remainder = removeVerb(body, intentHit.verb);
          break;
        }
      }
    }

    const knownTarget = detectKnownTarget(remainder || body, lexicon);
    const topic = extractTopic(body, lexicon);
    const location = extractLocation(body);
    const tokens = tokenize(body, lexicon);

    let target = "";
    let targetType = "";
    if(knownTarget){
      target = knownTarget.value;
      targetType = knownTarget.type;
    } else {
      // Use preposition-free remainder as soft target.
      target = remainder
        .replace(/\b(about|regarding|concerning)\b.+$/i, "")
        .replace(/\b(with|using|at|to|from|in|into|on|under|near|inside|outside|through)\b.+$/i, "")
        .trim();
      targetType = target ? "unknown" : "";
    }

    const action = {
      raw: originalRaw,
      privacy: privacyHit.privacy,
      actor,
      verb: intentHit.verb,
      intent: intentHit.intent,
      target,
      targetType,
      topic,
      location,
      item: "",
      confidence: Math.min(1, (intentHit.confidence || 0) + (actorHit.confidence ? .02 : 0) + (knownTarget ? .03 : 0)),
      flags: [],
      tokens,
      unresolved: []
    };

    if(!action.actor) action.unresolved.push("actor");
    if(action.intent === "unknown") action.unresolved.push("intent");
    if(["investigate","talk","research","prepare","cast","attack","use","move"].includes(action.intent) && !action.target && !action.topic && !action.location){
      action.unresolved.push("target_or_topic");
    }

    if(action.privacy === "private") action.flags.push("private_branch");
    if(action.intent === "attack" && !/entity|ghost|demon|spirit|creature|monster|werewolf|wendigo|vampire|fae|djinn/.test(action.raw.toLowerCase())){
      action.flags.push("attack_target_unclear");
    }
    if(action.intent === "talk" && !action.topic) action.flags.push("topic_missing");
    if(action.intent === "research" && /old|archive|records|case|file|newspaper/.test(action.raw.toLowerCase())) action.flags.push("archive_research");
    if(action.intent === "prepare" && /trap|line|circle|ward|killbox/.test(action.raw.toLowerCase())) action.flags.push("prep_structure");
    if(action.intent === "cast") action.flags.push("occult_action");

    action.rollProfile = inferRollProfile(action, lexicon);
    return action;
  }

  function parseCommandInput(input, options = {}){
    const lexicon = options.lexicon || DEFAULT_LEXICON;
    const raw = normalizeText(input);
    const privacyHit = detectPrivacy(raw, lexicon);
    const commands = splitCommands(raw, lexicon);
    const actions = commands.map(cmd => {
      // Inherit leading privacy if only first command has it.
      let c = cmd;
      if(!detectPrivacy(c, lexicon).word && privacyHit.word && raw.toLowerCase().startsWith(privacyHit.word)){
        c = privacyHit.privacy + " " + c;
      }
      return parseSingleCommand(c, options);
    });

    return {
      raw,
      mode: privacyHit.privacy,
      actionCount: actions.length,
      actions,
      needsClarification: actions.some(a => a.unresolved.length > 0),
      unresolved: actions.flatMap((a, idx) => a.unresolved.map(u => ({ actionIndex: idx, field: u, raw: a.raw })))
    };
  }

  function commandToNarrationPrompt(action, caseState = {}){
    const actor = action.actor || "A Warden";
    const privacy = action.privacy === "private" ? "PRIVATE BRANCH" : "PUBLIC";
    const phase = action.rollProfile?.phase || "any";
    const known = caseState.knownFacts ? caseState.knownFacts.join("; ") : "no established facts";
    return `[${privacy}] ${actor} attempts ${action.intent}${action.target ? " on " + action.target : ""}${action.topic ? " about " + action.topic : ""}. Phase: ${phase}. Roll hint: ${action.rollProfile.attribute} + ${action.rollProfile.primarySkill}. Known facts: ${known}.`;
  }

  function loadCSVText(csvText){
    // Minimal CSV parser for simple comma CSV. Pass 3 can replace this if needed.
    const lines = String(csvText || "").split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
    if(!lines.length) return [];
    const headers = lines[0].split(",").map(h=>h.trim());
    return lines.slice(1).map(line => {
      const cells = line.split(",").map(c=>c.trim());
      const obj = {};
      headers.forEach((h,i)=>obj[h]=cells[i] || "");
      return obj;
    });
  }

  function mergeLexiconFromCSV(lexicon, csvRows){
    const next = clone(lexicon);
    for(const row of csvRows){
      const kind = row.kind || row.category || "";
      const key = row.key || row.intent || row.type || "";
      const phrase = row.phrase || row.synonym || row.term || "";
      if(!kind || !key || !phrase) continue;
      if(kind === "verb"){
        next.verbSynonyms[key] = next.verbSynonyms[key] || [];
        if(!next.verbSynonyms[key].includes(phrase)) next.verbSynonyms[key].push(phrase);
      }
      if(kind === "target"){
        next.targetTypes[key] = next.targetTypes[key] || [];
        if(!next.targetTypes[key].includes(phrase)) next.targetTypes[key].push(phrase);
      }
      if(kind === "privacy"){
        next.privacyWords[key] = next.privacyWords[key] || [];
        if(!next.privacyWords[key].includes(phrase)) next.privacyWords[key].push(phrase);
      }
    }
    return next;
  }

  const API = {
    DEFAULT_LEXICON,
    normalizeText,
    splitCommands,
    parseSingleCommand,
    parseCommandInput,
    commandToNarrationPrompt,
    loadCSVText,
    mergeLexiconFromCSV
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = API;
  } else {
    global.NightWardensCommandParser = API;
  }

})(typeof window !== "undefined" ? window : globalThis);
