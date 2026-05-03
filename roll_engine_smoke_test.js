const engine = require("../src/auto_gm_roll_engine.js");

const character = {
  name:"Riley Maddox",
  move:4,
  attributes:{ force:9, prowess:10, intellect:9, instinct:11, will:9, charisma:9, endurance:10 },
  skills:{ Awareness:1, Survival:1, Investigation:1, Firearms:1 },
  conditions:[]
};

const caseState = { pressureClock:1, sceneSetbacks:["unstable_rooftop"], globalSetbacks:[] };

const action = {
  actor:"Riley Maddox",
  intent:"jump",
  target:"rooftop gap",
  location:"abandoned church rooftop",
  rollProfile:{ attribute:"Prowess", primarySkill:"Athletics", supportSkills:["Awareness","Survival"], rollNeeded:true },
  contextSetbacks:[{id:"rain_slick_roof",label:"Rain-slick roof",amount:1}],
  fixedRoll:[6,6,5]
};

const result = engine.resolveAction(character, action, caseState);
console.log(JSON.stringify({
  target: result.target.target,
  dice: result.dice.total,
  tier: result.result.tier,
  failureOutcome: result.failureOutcome && result.failureOutcome.id,
  updatedConditions: result.updatedCharacter.conditions,
  movement: result.updatedCharacter.movementState,
  pressureClock: result.updatedCaseState.pressureClock
}, null, 2));

if(!result.updatedCharacter.conditions.includes("broken_leg")){
  throw new Error("Expected broken_leg to be applied.");
}
if(result.updatedCharacter.movementState.current !== 2){
  throw new Error("Expected movement to be halved from 4 to 2.");
}
