import assert from "node:assert/strict";

const settings = new Map([
  ["dieLadder", "4, 6, 8, 10, 12, 20"],
  ["maintainThreshold", 2],
  ["triggerDropSteps", 1],
  ["recoveryGainSteps", 1],
  ["relapseOnMinimumFailure", true],
  ["completeAtMaximum", false],
  ["uncheckedBehavior", "none"],
  ["historyLimit", 50],
  ["defaultRollMode", "publicroll"],
  ["playersEditTriggers", true]
]);

let id = 0;
globalThis.foundry = {
  utils: {
    randomID: () => `id-${++id}`,
    setProperty: (object, path, value) => {
      const parts = path.split(".");
      const key = parts.pop();
      const target = parts.reduce((result, part) => result[part] ??= {}, object);
      target[key] = value;
    }
  }
};
globalThis.game = {
  i18n: {
    localize: key => key,
    format: key => key
  },
  settings: {
    get: (_module, key) => settings.get(key)
  },
  user: {
    id: "user-1",
    isGM: true
  },
  users: []
};
globalThis.ui = { notifications: { warn() {}, info() {} } };
globalThis.Hooks = { callAll() {} };
globalThis.ChatMessage = {
  getSpeaker: () => ({ alias: "Test" }),
  create: async data => ({ id: "prompt-message", ...data })
};

class TestRoll {
  constructor(formula) {
    this.formula = formula;
    this.total = 1;
  }
  async evaluate() {
    return this;
  }
  async toMessage(data, options) {
    return { id: "roll-message", data, options };
  }
}
globalThis.Roll = TestRoll;

const api = await import("../scripts/api.mjs");

const actor = {
  id: "actor-1",
  name: "Test Character",
  flags: {},
  isOwner: true,
  getFlag(scope, key) {
    return this.flags[scope]?.[key];
  },
  async setFlag(scope, key, value) {
    this.flags[scope] ??= {};
    this.flags[scope][key] = structuredClone(value);
  }
};

const addiction = await api.addAddiction(actor);
assert.equal(addiction.die, 4);
assert.equal(api.getActorData(actor).addictions.length, 1);

await api.updateAddiction(actor, addiction.id, {
  name: "Test Addiction",
  die: 6,
  triggers: "Isolation"
});
assert.equal(api.getAddiction(actor, addiction.id).die, 6);

const rolled = await api.rollSobrietyDie(actor, addiction.id, {
  mode: "disadvantage",
  rollMode: "blindroll",
  trigger: "Isolation"
});
assert.equal(rolled.roll.formula, "2d6kl");
assert.equal(rolled.resolution.outcome, "reduced");
assert.equal(api.getAddiction(actor, addiction.id).die, 4);
assert.equal(api.getAddiction(actor, addiction.id).history.length, 1);

const result = { type: "long", updateData: {} };
api.applyLongRestRecovery(actor, result, { addictionRecovery: true });
assert.equal(result["addiction-recovery-system"].selected, true);
assert.equal(
  result.updateData.flags["addiction-recovery-system"].data.addictions[0].die,
  6
);

const secondAddiction = await api.addAddiction(actor);
await api.updateAddiction(actor, secondAddiction.id, {
  name: "Second Addiction",
  die: 8
});
const targetedResult = { type: "long", updateData: {} };
const targetedSummaries = api.applyLongRestRecovery(actor, targetedResult, {
  addictionRecovery: true,
  addictionRecoveryTarget: addiction.id
});
const targetedAddictions = targetedResult.updateData.flags["addiction-recovery-system"].data.addictions;
assert.equal(targetedAddictions.find(entry => entry.id === addiction.id).die, 6);
assert.equal(targetedAddictions.find(entry => entry.id === secondAddiction.id).die, 8);
assert.equal(targetedSummaries.length, 1);
assert.equal(targetedResult["addiction-recovery-system"].targetId, addiction.id);

const prompt = await api.createTriggerPrompt(actor, addiction.id, "Isolation");
assert.match(prompt.content, /data-ars-open-roll/);
assert.doesNotMatch(prompt.content, /data-ars-roll="/);

console.log("api tests passed");
