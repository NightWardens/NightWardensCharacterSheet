const Engine = require("../src/auto_gm_witness_investigation_engine.js");
const fs = require("fs");
const caseState = JSON.parse(fs.readFileSync(__dirname + "/../examples/sample_case_state_witnesses.json","utf8"));

let action = { privacy:"public", actor:"Riley", intent:"talk", target:"Mrs. Harlan", topic:"bell" };
let roll = { outcome:"success", total:9, target:12, margin:3 };
let res = Engine.resolveAction(caseState, action, roll);
console.log(res.publicText);
if(!res.revealed.length) throw new Error("Expected a witness clue.");

action = { privacy:"public", actor:"Sam", intent:"investigate", target:"black ash", topic:"demon" };
roll = { outcome:"criticalSuccess", total:3, target:13, margin:10 };
res = Engine.resolveAction(res.caseState, action, roll);
console.log(res.publicText);
if(!res.caseState.investigation.anchorKnown) throw new Error("Expected anchor known.");

console.log("Pass 4 witness/investigation smoke test passed.");
