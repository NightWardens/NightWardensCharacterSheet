const AI = require("../src/auto_gm_creature_ai_clue_trail.js");

let state = {
  pressureClock: 3,
  domain: "sigils",
  caseSeed: { suit: "sigils", card: "Seven of Sigils" },
  party: [{ name: "Riley" }, { name: "Alex" }],
  trueEntity: { name: "Hollow Rider", type: "demon" },
  clues: [],
  hiddenClues: [],
  publicLog: [],
  privateLogs: {}
};

let turn = AI.creatureTakeTurn(state, { privacy: "public", actor: "Riley", intent: "investigate", target: "circle" }, { success: true, outcome: "success" }, { rng: () => 0.1 });
console.log("Behavior:", turn.behavior.key);
console.log("Pressure:", turn.caseState.pressureClock);
console.log("Hidden signs:", turn.caseState.hiddenClues.length);

let found = AI.discoverSigns(turn.caseState, { privacy: "public", actor: "Riley", intent: "investigate" }, { success: true, outcome: "strongSuccess" });
console.log("Discovered:", found.discovered.map(s => s.label).join(", "));
console.log("Known profile:", AI.getKnownCreatureProfile(found.caseState));
