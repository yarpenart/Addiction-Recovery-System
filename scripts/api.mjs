import {
  appendHistory,
  normalizeAddiction,
  parseDieLadder,
  resolveRecovery,
  resolveSobrietyRoll,
  sobrietyFormula
} from "./engine.mjs";

export const MODULE_ID = "addiction-recovery-system";
export const FLAG_KEY = "data";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

export function localize(key) {
  return game.i18n.localize(`ARS.${key}`);
}

export function format(key, data={}) {
  return game.i18n.format(`ARS.${key}`, data);
}

export function getRules() {
  return {
    ladder: parseDieLadder(game.settings.get(MODULE_ID, "dieLadder")),
    maintainThreshold: Number(game.settings.get(MODULE_ID, "maintainThreshold")),
    triggerDropSteps: Number(game.settings.get(MODULE_ID, "triggerDropSteps")),
    recoveryGainSteps: Number(game.settings.get(MODULE_ID, "recoveryGainSteps")),
    relapseOnMinimumFailure: game.settings.get(MODULE_ID, "relapseOnMinimumFailure"),
    completeAtMaximum: game.settings.get(MODULE_ID, "completeAtMaximum"),
    uncheckedBehavior: game.settings.get(MODULE_ID, "uncheckedBehavior")
  };
}

export function getActorData(actor) {
  const source = actor?.getFlag(MODULE_ID, FLAG_KEY);
  const rules = getRules();
  const addictions = Array.isArray(source?.addictions)
    ? source.addictions.map(addiction => normalizeAddiction(addiction, rules))
    : [];
  return {
    schema: 1,
    addictions
  };
}

export async function setActorData(actor, data) {
  if ( !actor ) return;
  const normalized = {
    schema: 1,
    addictions: (data.addictions ?? []).map(addiction => normalizeAddiction(addiction, getRules()))
  };
  return actor.setFlag(MODULE_ID, FLAG_KEY, normalized);
}

export function getAddiction(actor, addictionId) {
  return getActorData(actor).addictions.find(addiction => addiction.id === addictionId);
}

export async function addAddiction(actor) {
  const data = getActorData(actor);
  const ladder = getRules().ladder;
  data.addictions.push(normalizeAddiction({
    id: foundry.utils.randomID(),
    name: localize("Addiction.DefaultName"),
    die: ladder[0],
    status: "recovery",
    incurable: false,
    triggers: "",
    notes: "",
    createdAt: Date.now(),
    history: []
  }, getRules()));
  await setActorData(actor, data);
  return data.addictions.at(-1);
}

export async function updateAddiction(actor, addictionId, changes) {
  const data = getActorData(actor);
  const index = data.addictions.findIndex(addiction => addiction.id === addictionId);
  if ( index < 0 ) return;
  data.addictions[index] = normalizeAddiction({
    ...data.addictions[index],
    ...changes,
    id: addictionId
  }, getRules());
  await setActorData(actor, data);
  return data.addictions[index];
}

export async function deleteAddiction(actor, addictionId) {
  const data = getActorData(actor);
  data.addictions = data.addictions.filter(addiction => addiction.id !== addictionId);
  return setActorData(actor, data);
}

export function canManageActor(actor) {
  return Boolean(game.user?.isGM || actor?.isOwner);
}

export function canEditTriggers(actor) {
  return Boolean(game.user?.isGM || (
    actor?.isOwner && game.settings.get(MODULE_ID, "playersEditTriggers")
  ));
}

function historyEntry(type, details={}) {
  return {
    id: foundry.utils.randomID(),
    type,
    timestamp: Date.now(),
    userId: game.user.id,
    ...details
  };
}

export async function rollSobrietyDie(actor, addictionId, {
  mode="normal",
  rollMode,
  trigger="",
  promptMessageId=null
}={}) {
  if ( !actor || !canManageActor(actor) ) {
    ui.notifications.warn(localize("Notifications.NoPermission"));
    return null;
  }

  const data = getActorData(actor);
  const index = data.addictions.findIndex(addiction => addiction.id === addictionId);
  if ( index < 0 ) {
    ui.notifications.warn(localize("Notifications.MissingAddiction"));
    return null;
  }

  const addiction = data.addictions[index];
  if ( addiction.status !== "recovery" ) {
    ui.notifications.warn(localize("Notifications.NotInRecovery"));
    return null;
  }

  const formula = sobrietyFormula(addiction.die, mode);
  const roll = await new Roll(formula).evaluate();
  const resolution = resolveSobrietyRoll(addiction, roll.total, getRules());
  const updated = appendHistory({
    ...addiction,
    die: resolution.after,
    status: resolution.status
  }, historyEntry("trigger", {
    mode,
    roll: roll.total,
    dieBefore: resolution.before,
    dieAfter: resolution.after,
    outcome: resolution.outcome,
    trigger
  }), game.settings.get(MODULE_ID, "historyLimit"));
  data.addictions[index] = updated;
  await setActorData(actor, data);

  const resultLabel = localize(`Outcome.${resolution.outcome}`);
  const flavor = `
    <section class="ars-roll-flavor ars-outcome-${resolution.outcome}">
      <header class="ars-roll-flavor-header">
        <span class="ars-chat-icon"><i class="fa-solid fa-heart-pulse" inert></i></span>
        <div>
          <span class="ars-chat-eyebrow">${localize("Trigger.PromptTitle")}</span>
          <h3>${escapeHTML(actor.name)}</h3>
          <p>${escapeHTML(addiction.name)}</p>
        </div>
        <span class="ars-chat-die" data-tooltip="${localize("Addiction.Die")}">d${resolution.before}</span>
      </header>
      ${trigger ? `
        <div class="ars-roll-trigger">
          <i class="fa-solid fa-bolt" inert></i>
          <span><strong>${localize("Trigger.Label")}</strong>${escapeHTML(trigger)}</span>
        </div>` : ""}
      <div class="ars-roll-summary">
        <span>
          <small>${localize("Roll.Mode")}</small>
          <strong>${localize(`Roll.${mode}`)}</strong>
        </span>
        <span>
          <small>${localize("Addiction.Die")}</small>
          <strong>d${resolution.before} <i class="fa-solid fa-arrow-right" inert></i> d${resolution.after}</strong>
        </span>
      </div>
      <div class="ars-outcome-banner">
        <i class="fa-solid ${resolution.naturalOne ? "fa-triangle-exclamation" : "fa-shield-heart"}" inert></i>
        <span>
          <small>${localize("Roll.Result")}</small>
          <strong>${resultLabel}</strong>
        </span>
      </div>
    </section>`;

  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags: {
      [MODULE_ID]: {
        type: "sobriety-roll",
        actorId: actor.id,
        addictionId,
        promptMessageId,
        naturalOne: resolution.naturalOne,
        outcome: resolution.outcome
      }
    }
  };
  const resolvedRollMode = rollMode || game.settings.get(MODULE_ID, "defaultRollMode");
  const message = await roll.toMessage(messageData, { rollMode: resolvedRollMode });
  Hooks.callAll(`${MODULE_ID}.sobrietyRoll`, actor, updated, roll, resolution, message);
  return { actor, addiction: updated, roll, resolution, message };
}

export function ownerAndGMWhispers(actor) {
  return game.users
    .filter(user => user.isGM || actor.testUserPermission(user, "OWNER"))
    .map(user => user.id);
}

export async function createTriggerPrompt(actor, addictionId, trigger="") {
  if ( !game.user.isGM ) {
    ui.notifications.warn(localize("Notifications.GMOnly"));
    return null;
  }
  const addiction = getAddiction(actor, addictionId);
  if ( !addiction ) return null;

  const safeActor = escapeHTML(actor.name);
  const safeAddiction = escapeHTML(addiction.name);
  const safeTrigger = escapeHTML(trigger || localize("Trigger.Unspecified"));
  const safeImage = escapeHTML(actor.img || "icons/svg/mystery-man.svg");
  const content = `
    <article class="ars-trigger-card" data-actor-id="${actor.id}" data-addiction-id="${addiction.id}">
      <header class="ars-trigger-hero">
        <img src="${safeImage}" alt="${safeActor}">
        <div>
          <span class="ars-chat-eyebrow">${localize("Trigger.PromptTitle")}</span>
          <h3>${safeActor}</h3>
          <p>${safeAddiction}</p>
        </div>
        <span class="ars-chat-die" data-tooltip="${localize("Addiction.Die")}">d${addiction.die}</span>
      </header>
      <div class="ars-trigger-callout">
        <i class="fa-solid fa-bolt" inert></i>
        <span>
          <strong>${localize("Trigger.Label")}</strong>
          ${safeTrigger}
        </span>
      </div>
      <p class="ars-trigger-hint">${localize("Trigger.PromptHint")}</p>
      <div class="ars-trigger-footer">
        <span class="ars-trigger-state" data-ars-trigger-state>
          <i class="fa-solid fa-hourglass-half" inert></i>
          <span>${localize("Trigger.AwaitingRoll")}</span>
        </span>
        <button type="button" data-ars-open-roll>
          <i class="fa-solid fa-dice-d20" inert></i>
          ${localize("Trigger.OpenRollDialog")}
        </button>
      </div>
    </article>`;

  const message = await ChatMessage.create({
    content,
    whisper: ownerAndGMWhispers(actor),
    speaker: ChatMessage.getSpeaker({ actor, alias: actor.name }),
    flags: {
      [MODULE_ID]: {
        type: "trigger-prompt",
        actorId: actor.id,
        addictionId: addiction.id,
        trigger,
        resolved: false
      }
    }
  });
  Hooks.callAll(`${MODULE_ID}.triggerPromptCreated`, {
    type: "showTriggerDialog",
    messageId: message.id
  });
  return message;
}

export function applyLongRestRecovery(actor, result, config) {
  if ( result.type !== "long" ) return [];
  const data = getActorData(actor);
  if ( !data.addictions.length ) return [];
  const selected = config.addictionRecovery === true || config.addictionRecovery === "true";
  const requestedTarget = String(config.addictionRecoveryTarget ?? "all");
  const targetId = selected && data.addictions.some(addiction => addiction.id === requestedTarget)
    ? requestedTarget
    : "all";
  const targetName = targetId === "all"
    ? null
    : data.addictions.find(addiction => addiction.id === targetId)?.name ?? null;
  const rules = getRules();
  const summaries = [];

  data.addictions = data.addictions.map(addiction => {
    if ( addiction.status === "recovered" ) return addiction;
    if ( selected && targetId !== "all" && addiction.id !== targetId ) return addiction;
    const resolution = resolveRecovery(addiction, selected, rules);
    summaries.push({
      id: addiction.id,
      name: addiction.name,
      incurable: addiction.incurable,
      ...resolution
    });
    return appendHistory({
      ...addiction,
      die: resolution.after,
      status: resolution.status
    }, historyEntry("recovery", {
      selected,
      dieBefore: resolution.before,
      dieAfter: resolution.after,
      outcome: resolution.outcome
    }), game.settings.get(MODULE_ID, "historyLimit"));
  });

  foundry.utils.setProperty(result.updateData, `flags.${MODULE_ID}.${FLAG_KEY}`, data);
  result[MODULE_ID] = { selected, targetId, targetName, summaries };
  return summaries;
}

export function addictionStatusLabel(status) {
  return localize(`Status.${status}`);
}
