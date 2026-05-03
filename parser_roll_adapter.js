/*
Pass 3 Adapter: Use parser output from Pass 2 with the roll engine.

Expected parser action shape:
{
  privacy: "public" | "private",
  actor: "Riley",
  intent: "investigate",
  target: "altar",
  targetType: "evidence",
  topic: "",
  location: "church basement",
  rollProfile: {
    attribute: "Intellect",
    primarySkill: "Investigation",
    supportSkills: ["Awareness", "Occult Knowledge"],
    rollNeeded: true
  }
}
*/

(function(global){
  "use strict";

  function actionNeedsRoll(action){
    if(action.rollProfile && action.rollProfile.rollNeeded === false) return false;
    const noRoll = ["look","help","inventory","status","notes","save","load"];
    return !noRoll.includes(String(action.intent||"").toLowerCase());
  }

  function resolveParsedCommandBatch(parsedActions, vault, caseState, options={}){
    const engine = options.engine || global.NightWardensRollEngine;
    if(!engine) throw new Error("NightWardensRollEngine is required.");

    const charactersByName = {};
    for(const character of (vault.characters || [])){
      charactersByName[character.name] = character;
    }

    const rollActions = [];
    const nonRollOutputs = [];

    for(const action of parsedActions){
      if(actionNeedsRoll(action)){
        rollActions.push(action);
      } else {
        nonRollOutputs.push({
          action,
          narration: `${action.actor || "Warden"} looks over the scene. No roll required.`,
          result: { tier:"no_roll", label:"No Roll", success:true }
        });
      }
    }

    const resolved = engine.resolveBatch(charactersByName, rollActions, caseState, options);
    return {
      nonRollOutputs,
      rollOutputs: resolved.outputs,
      characters: Object.values(resolved.charactersByName),
      caseState: resolved.caseState
    };
  }

  const api = { actionNeedsRoll, resolveParsedCommandBatch };
  if(typeof module !== "undefined" && module.exports) module.exports = api;
  global.NightWardensParserRollAdapter = api;
})(typeof window !== "undefined" ? window : globalThis);
