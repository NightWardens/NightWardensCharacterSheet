const parser = require("../src/auto_gm_command_parser.js");

const samples = [
  "look",
  "Riley: investigate altar",
  "private Alex: research sigil",
  "public Riley: investigate altar; Sam: talk to witness about the bell; Alex: prep salt line",
  "Sam: ask Mrs Harlan about the bell",
  "Riley: shoot the demon with silver",
  "split Riley to church basement"
];

for (const s of samples) {
  const result = parser.parseCommandInput(s, { knownActors: ["Riley", "Sam", "Alex"] });
  console.log("\\nINPUT:", s);
  console.log(JSON.stringify(result, null, 2));
}
