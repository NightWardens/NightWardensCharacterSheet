const NW = require('../src/auto_gm_shared_private_layer.js');
let state = NW.createCampaignCase({ campaignId: 'test_campaign', createdBy: 'riley', title: 'Smoke Test' });
state = NW.logPublic(state, { actor: 'Riley', text: 'Riley investigates the altar.' }).caseState;
state = NW.addPrivateClue(state, { playerId: 'alex', displayName: 'Alex', clue: { title: 'Private Sigil', text: 'Alex finds a hidden sigil.' } }).caseState;
const clueId = state.privateBranches.alex.privateClues[0].id;
let queued = NW.queueReveal(state, { playerId: 'alex', clueId });
state = queued.caseState;
let published = NW.publishReveal(state, queued.reveal.id, { actor: 'Alex' });
state = published.caseState;
console.log(JSON.stringify({
  publicCount: state.transcripts.public.length,
  privateCount: state.privateBranches.alex.privateClues.length,
  pressure: state.publicState.pressureClock,
  partyVisible: NW.getPartyVisibleState(state).publicTranscript.length
}, null, 2));
