import assert from "node:assert/strict";
import {
  parseDieLadder,
  resolveRecovery,
  resolveSobrietyRoll,
  shiftDie,
  sobrietyFormula
} from "../scripts/engine.mjs";

const ladder = [4, 6, 8, 10, 12, 20];

assert.deepEqual(parseDieLadder("d4, 6, d8, 10, 12, 20"), ladder);
assert.deepEqual(parseDieLadder("invalid"), ladder);
assert.equal(shiftDie(12, 1, ladder), 20);
assert.equal(shiftDie(4, -1, ladder), 4);

assert.equal(sobrietyFormula(8, "normal"), "1d8");
assert.equal(sobrietyFormula(8, "advantage"), "2d8kh");
assert.equal(sobrietyFormula(8, "disadvantage"), "2d8kl");

assert.deepEqual(resolveSobrietyRoll({ die: 12, status: "recovery" }, 1, {
  ladder,
  maintainThreshold: 2,
  triggerDropSteps: 1,
  relapseOnMinimumFailure: true
}), {
  before: 12,
  after: 10,
  status: "recovery",
  failed: true,
  naturalOne: true,
  outcome: "reduced"
});

assert.equal(resolveSobrietyRoll({ die: 4, status: "recovery" }, 1, {
  ladder,
  maintainThreshold: 2,
  triggerDropSteps: 1,
  relapseOnMinimumFailure: true
}).outcome, "relapse");

assert.deepEqual(resolveSobrietyRoll({
  die: 12,
  status: "recovery",
  incurable: true
}, 1, {
  ladder,
  maintainThreshold: 2,
  triggerDropSteps: 1,
  relapseOnMinimumFailure: true
}), {
  before: 12,
  after: 12,
  status: "recovery",
  failed: true,
  naturalOne: true,
  outcome: "locked"
});

assert.equal(resolveRecovery({ die: 10, status: "recovery" }, true, {
  ladder,
  recoveryGainSteps: 1,
  uncheckedBehavior: "none"
}).after, 12);

assert.equal(resolveRecovery({ die: 8, status: "recovery" }, false, {
  ladder,
  recoveryGainSteps: 1,
  uncheckedBehavior: "decrease"
}).after, 6);

assert.equal(resolveRecovery({ die: 4, status: "relapse" }, true, {
  ladder,
  recoveryGainSteps: 1,
  uncheckedBehavior: "none"
}).status, "recovery");

assert.equal(resolveRecovery({ die: 20, status: "recovery", incurable: true }, true, {
  ladder,
  recoveryGainSteps: 1,
  completeAtMaximum: true
}).status, "recovery");
assert.deepEqual(resolveRecovery({
  die: 10,
  status: "recovery",
  incurable: true
}, true, {
  ladder,
  recoveryGainSteps: 1,
  uncheckedBehavior: "none"
}), {
  before: 10,
  after: 10,
  status: "recovery",
  outcome: "locked",
  selected: true
});
assert.equal(resolveRecovery({
  die: 10,
  status: "recovery",
  incurable: true
}, false, {
  ladder,
  recoveryGainSteps: 1,
  uncheckedBehavior: "decrease"
}).after, 10);

assert.equal(resolveRecovery({ die: 20, status: "recovery", incurable: false }, true, {
  ladder,
  recoveryGainSteps: 1,
  completeAtMaximum: true
}).status, "recovered");

console.log("engine tests passed");
