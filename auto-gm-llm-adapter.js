/* Night Wardens WebLLM Adapter — v14.0
   Android/iPhone friendly model defaults.
   Runs a small quantized model in the browser through WebLLM/WebGPU when available.
   The structured Auto-GM remains the source of truth; the LLM only summarizes,
   narrates, suggests next steps, and explains known case state.
*/
(function () {
  const DEFAULT_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
  const BALANCED_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
  const HEAVIER_MODEL = "Llama-3.2-3B-Instruct-q4f16_0-MLC";
  const MODEL_PRESETS = [
    { id: DEFAULT_MODEL, label: "Fastest / Android + iPhone Friendly", size: "0.5B", note: "Best default for mobile. Short summaries, suggestions, and NPC flavor." },
    { id: BALANCED_MODEL, label: "Balanced / Better Tone", size: "1B", note: "Better narration, heavier than Qwen 0.5B." },
    { id: HEAVIER_MODEL, label: "Heavier / Best Local Narration", size: "3B", note: "Use on strong devices only." }
  ];

  let webllm = null;
  let engine = null;
  let currentModel = null;
  let ready = false;
  let loading = false;
  let lastProgress = "LLM not loaded. Structured assistant is available.";

  function getDeviceInfo() {
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);
    const hasWebGPU = !!navigator.gpu;
    const memoryGB = navigator.deviceMemory || null;
    let recommendation = DEFAULT_MODEL;
    let message = "Use Fastest / Mobile model first.";
    if (!hasWebGPU) {
      message = "WebGPU is not available. Structured assistant will still work, but local LLM may not load on this browser.";
    } else if (isMobile || (memoryGB && memoryGB <= 4)) {
      recommendation = DEFAULT_MODEL;
      message = "Mobile or limited-memory device detected. Qwen 0.5B is recommended.";
    } else if (memoryGB && memoryGB >= 8) {
      recommendation = BALANCED_MODEL;
      message = "Stronger device detected. Balanced 1B model should work; Qwen 0.5B remains fastest.";
    }
    return { ua, isIOS, isAndroid, isMobile, hasWebGPU, memoryGB, recommendation, message, modelPresets: MODEL_PRESETS };
  }

  function recommendedModel() {
    return getDeviceInfo().recommendation || DEFAULT_MODEL;
  }

  function dispatchProgress(message, extra = {}) {
    lastProgress = message || lastProgress;
    window.dispatchEvent(new CustomEvent("nw-llm-progress", {
      detail: { message: lastProgress, ready, loading, model: currentModel || DEFAULT_MODEL, ...extra }
    }));
  }

  function trimText(text, maxChars = 12000) {
    text = String(text || "");
    return text.length > maxChars ? text.slice(0, maxChars) + "\n...[trimmed for browser model]" : text;
  }

  function safeJson(obj, maxChars = 12000) {
    try { return trimText(JSON.stringify(obj, null, 2), maxChars); }
    catch { return trimText(String(obj || ""), maxChars); }
  }

  function normalizeCaseContext(caseContext) {
    const c = caseContext || {};
    return {
      title: c.title || c.caseTitle || "Untitled Case",
      phase: c.phase || "unknown",
      pressure: c.pressure ?? c.pressureClock ?? 0,
      pressureLevel: c.pressureLevel || "unknown",
      location: c.location || c.currentLocation || "unknown",
      clues: c.clues || c.publicClues || [],
      leads: c.leads || [],
      witnesses: c.witnesses || [],
      suspects: c.suspects || [],
      allies: c.allies || [],
      inventory: c.inventory || [],
      entityKnown: !!c.entityKnown,
      entity: c.entity || c.knownEntity || null,
      pressureDraws: c.pressureDraws || [],
      combat: c.combat || {},
      prep: c.prep || [],
      traps: c.traps || []
    };
  }

  function buildMessages(prompt, caseContext, assistantPrompts = {}) {
    const compactContext = normalizeCaseContext(caseContext);
    const system = assistantPrompts.system || `
You are the Night Wardens Field Assistant.

Hard rules:
- Use ONLY the structured case context supplied by the Auto-GM.
- Do NOT invent new clues, suspects, witnesses, locations, entities, weaknesses, anchors, kill conditions, inventory, or solved facts.
- If the player asks for undiscovered information, tell them what kind of action could reveal it.
- You may summarize, organize, narrate known events, suggest next steps, suggest questions, and build prep checklists from known facts.
- Keep answers concise, table-usable, and in a classified supernatural field-guide tone.
- Prefer concrete commands players can type, such as: ask [witness] about [topic], investigate [evidence], research [symbol], buy [item], set trap [trap], hide and wait, attack with [weapon].
`;
    const user = `CURRENT STRUCTURED CASE CONTEXT:\n${safeJson(compactContext)}\n\nPLAYER REQUEST:\n${prompt}`;
    return [{ role: "system", content: system }, { role: "user", content: user }];
  }

  async function init(options = {}) {
    const requestedModel = options.model || currentModel || recommendedModel() || DEFAULT_MODEL;
    if (ready && engine && requestedModel === currentModel) return { ready, model: currentModel };
    if (loading) return { ready, loading, model: currentModel || requestedModel, progress: lastProgress };

    loading = true; ready = false; currentModel = requestedModel;
    try {
      if (!navigator.gpu) {
        dispatchProgress("WebGPU is not available in this browser. Structured assistant will be used. On iPhone/iPad, update iOS/Safari and check Safari WebGPU support if you want local AI.", { error: true, device: getDeviceInfo() });
        throw new Error("WebGPU unavailable");
      }
      dispatchProgress("Loading WebLLM runtime...");
      webllm = webllm || await import("https://esm.run/@mlc-ai/web-llm");
      dispatchProgress(`Loading ${currentModel}. First load can take several minutes and uses device storage...`);
      engine = await webllm.CreateMLCEngine(currentModel, {
        initProgressCallback: (p) => {
          const percent = Number.isFinite(p?.progress) ? ` ${Math.round(p.progress * 100)}%` : "";
          dispatchProgress((p?.text || p?.message || "Loading model") + percent);
        }
      });
      ready = true; loading = false;
      dispatchProgress(`Warden Field Assistant ready: ${currentModel}`);
      return { ready, model: currentModel };
    } catch (err) {
      console.error("Night Wardens WebLLM init failed:", err);
      loading = false; ready = false; engine = null;
      dispatchProgress("LLM failed to load. Using structured assistant fallback.", { error: true });
      throw err;
    }
  }

  async function ask(prompt, caseContext, assistantPrompts = {}, options = {}) {
    if (!prompt || !String(prompt).trim()) return "";
    if (!engine || !ready || (options.model && options.model !== currentModel)) {
      await init({ model: options.model || currentModel || DEFAULT_MODEL });
    }
    const response = await engine.chat.completions.create({
      messages: buildMessages(prompt, caseContext, assistantPrompts),
      temperature: options.temperature ?? 0.45,
      max_tokens: options.max_tokens ?? 450
    });
    return response?.choices?.[0]?.message?.content || "";
  }


  function buildNPCMessages(payload, caseContext, assistantPrompts = {}) {
    const c = normalizeCaseContext(caseContext);
    const p = payload || {};
    const system = assistantPrompts.npcSystem || `
You are voicing one Night Wardens NPC.
Hard rules:
- You are NOT the GM and NOT the source of truth.
- You may only rephrase the actual listed clue/response supplied under ACTUAL CLUE.
- Do not add new facts, new locations, new entities, new weaknesses, new suspects, or new solutions.
- Keep the NPC's intelligence, role, fear, trust, and demeanor in mind.
- Speak in 1 to 3 short sentences as the NPC.
- If the actual clue is uncertain or partial, sound uncertain instead of inventing.
`;
    const user = `CASE SNAPSHOT:
${safeJson({title:c.title, phase:c.phase, pressure:c.pressure, location:c.location, knownClues:c.clues, leads:c.leads}, 5000)}

NPC PROFILE:
${safeJson(p.npc || {}, 2500)}

NPC NAME: ${p.npcName || 'NPC'}
TOPIC: ${p.topic || 'general'}
ROLL TIER: ${p.rollTier || 'narrative'}
CANONICAL RESPONSE: ${p.canonicalResponse || ''}
ACTUAL CLUE TEXT / ALLOWED FACTS: ${p.actualClueText || p.canonicalResponse || ''}
PLAYER: ${p.player || 'Warden'}
RECENT NPC DIALOGUE:
${safeJson(p.recentDialogue || [], 2500)}

Write what this NPC says now. Rephrase only the allowed facts.`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  async function npcLine(payload, caseContext, assistantPrompts = {}, options = {}) {
    if (!engine || !ready || (options.model && options.model !== currentModel)) {
      await init({ model: options.model || currentModel || DEFAULT_MODEL });
    }
    const response = await engine.chat.completions.create({
      messages: buildNPCMessages(payload, caseContext, assistantPrompts),
      temperature: options.temperature ?? 0.6,
      max_tokens: options.max_tokens ?? 140
    });
    let text = response?.choices?.[0]?.message?.content || '';
    return trimText(text.replace(/^"|"$/g, ''), 700);
  }

  async function summarize(caseContext) {
    return ask("Summarize the current case, known clues, current danger, and best next 3 commands.", caseContext);
  }
  async function prepChecklist(caseContext) {
    return ask("Create a practical prep checklist based only on known clues, inventory, pressure, and entity possibilities.", caseContext);
  }
  async function witnessQuestions(caseContext, witnessName) {
    return ask(witnessName ? `Suggest useful questions to ask ${witnessName} based only on known topics and clues.` : "Suggest useful witness questions based only on known clues.", caseContext);
  }


  function buildGameWardenOpenerMessages(openingBrief, caseContext, assistantPrompts = {}) {
    const c = normalizeCaseContext(caseContext);
    const system = assistantPrompts.gameWardenSystem || `
You are the Auto Game Warden for Night Wardens.
You craft the opening transmission for a supernatural investigation using only supplied modular assets.
Hard rules:
- Do NOT reveal the true entity unless the opening brief explicitly says it is visible.
- Do NOT reveal the actual weakness, anchor, kill condition, hidden clue layers, or witness secrets.
- You may turn visible assets into atmosphere, briefing language, and starting objectives.
- Use a classified field transmission tone: ominous, practical, modern supernatural investigation.
- End with 3 to 5 concrete typed commands the players can try.
- Keep it punchy: 2 to 4 short paragraphs plus commands.
`;
    const user = `VISIBLE OPENING BRIEF — ONLY THESE FACTS MAY BE USED:
${safeJson(openingBrief || {}, 7000)}

CURRENT NON-SPOILER CASE CONTEXT:
${safeJson({title:c.title, phase:c.phase, pressure:c.pressure, location:c.location, witnesses:c.witnesses, leads:c.leads}, 3000)}

Write the opening field transmission now. Remember: no hidden entity/weakness/anchor/kill-condition spoilers.`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  async function gameWardenOpener(openingBrief, caseContext, assistantPrompts = {}, options = {}) {
    if (!engine || !ready || (options.model && options.model !== currentModel)) {
      await init({ model: options.model || currentModel || DEFAULT_MODEL });
    }
    const response = await engine.chat.completions.create({
      messages: buildGameWardenOpenerMessages(openingBrief, caseContext, assistantPrompts),
      temperature: options.temperature ?? 0.72,
      max_tokens: options.max_tokens ?? 520
    });
    return trimText(response?.choices?.[0]?.message?.content || '', 1800);
  }

  window.NWLLMAdapter = {
    enabled: true,
    defaultModel: DEFAULT_MODEL,
    balancedModel: BALANCED_MODEL,
    heavierModel: HEAVIER_MODEL,
    modelPresets: MODEL_PRESETS,
    getDeviceInfo,
    recommendedModel,
    init,
    ask,
    summarize,
    prepChecklist,
    witnessQuestions,
    npcLine,
    gameWardenOpener,
    isReady: () => ready,
    isLoading: () => loading,
    getModel: () => currentModel || DEFAULT_MODEL,
    getProgress: () => lastProgress
  };
})();
