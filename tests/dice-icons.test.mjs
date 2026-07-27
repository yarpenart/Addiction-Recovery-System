import assert from "node:assert/strict";
import { sobrietyDieIcon } from "../scripts/dice-icons.mjs";

for ( const die of [4, 6, 8, 10, 12, 20] ) {
  const icon = sobrietyDieIcon(die);
  assert.match(icon, new RegExp(`data-die="${die}"`));
  assert.match(icon, /ars-polyhedral-die/);
  assert.match(icon, new RegExp(`assets/dice/d${die}\\.svg`));
  assert.match(icon, /<img/);
  assert.doesNotMatch(icon, /fa-dice-d20/);
}

assert.notEqual(sobrietyDieIcon(12), sobrietyDieIcon(20));
assert.match(sobrietyDieIcon(100), /data-die="100"/);

console.log("dice icon tests passed");
