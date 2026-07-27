import {
  MODULE_ID,
  addictionStatusLabel,
  applyLongRestRecovery,
  canEditTriggers,
  createTriggerPrompt,
  getActorData,
  getLongRestRecoveryConfig,
  getRules,
  localize,
  rollSobrietyDie,
  updateAddiction
} from "./api.mjs";
import { sobrietyDieIcon } from "./dice-icons.mjs";
import { openManager, refreshManager } from "./manager.mjs";
import { LongRestRecoverySettings } from "./rest-settings.mjs";

const SOCKET = `module.${MODULE_ID}`;
const openTriggerDialogs = new Set();

Hooks.on(`${MODULE_ID}.triggerPromptCreated`, payload => {
  game.socket.emit(SOCKET, payload);
  openTriggerRollDialog(payload);
});

Hooks.once("init", () => {
  registerSettings();

  const module = game.modules.get(MODULE_ID);
  module.api = {
    openManager,
    getActorData,
    rollSobrietyDie,
    createTriggerPrompt
  };
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, handleSocket);
  renderQuickPanel();

  if ( game.system.id !== "dnd5e" || game.system.version !== "5.3.3" ) {
    ui.notifications.warn(localize("Notifications.VersionWarning"));
  }
});

Hooks.on("renderCharacterActorSheet", injectCharacterSheet);
Hooks.on("renderLongRestDialog", injectLongRestSection);
Hooks.on("renderChatMessageHTML", enhanceChatMessage);
Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
  applyLongRestRecovery(actor, result, config);
});
Hooks.on("dnd5e.restCompleted", appendRestSummary);
Hooks.on("updateActor", actor => {
  if ( actor.type === "character" ) refreshManager();
});

function registerSettings() {
  const worldSettings = [
    {
      key: "dieLadder",
      type: String,
      default: "4, 6, 8, 10, 12, 20"
    },
    {
      key: "maintainThreshold",
      type: Number,
      default: 2,
      range: { min: 2, max: 20, step: 1 }
    },
    {
      key: "triggerDropSteps",
      type: Number,
      default: 1,
      range: { min: 1, max: 6, step: 1 }
    },
    {
      key: "recoveryGainSteps",
      type: Number,
      default: 1,
      range: { min: 1, max: 6, step: 1 }
    },
    {
      key: "relapseOnMinimumFailure",
      type: Boolean,
      default: true
    },
    {
      key: "uncheckedBehavior",
      type: String,
      default: "none",
      choices: {
        none: "ARS.Settings.UncheckedNone",
        decrease: "ARS.Settings.UncheckedDecrease"
      }
    },
    {
      key: "completeAtMaximum",
      type: Boolean,
      default: false
    },
    {
      key: "playersEditTriggers",
      type: Boolean,
      default: true
    },
    {
      key: "defaultRollMode",
      type: String,
      default: "publicroll",
      choices: {
        publicroll: "RollModePublic",
        gmroll: "RollModePrivate",
        blindroll: "RollModeBlind",
        selfroll: "RollModeSelf"
      }
    },
    {
      key: "historyLimit",
      type: Number,
      default: 50,
      range: { min: 0, max: 200, step: 10 }
    }
  ];

  for ( const setting of worldSettings ) {
    game.settings.register(MODULE_ID, setting.key, {
      name: `ARS.Settings.${setting.key}.Name`,
      hint: `ARS.Settings.${setting.key}.Hint`,
      scope: "world",
      config: true,
      ...setting
    });
  }

  game.settings.register(MODULE_ID, "longRestRecoveryTargets", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      mode: "all",
      otherAddictions: "unchanged"
    }
  });

  game.settings.registerMenu(MODULE_ID, "longRestRecoveryConfig", {
    name: "ARS.Settings.longRestRecoveryConfig.Name",
    label: "ARS.Settings.longRestRecoveryConfig.Label",
    hint: "ARS.Settings.longRestRecoveryConfig.Hint",
    icon: "fa-solid fa-bed",
    type: LongRestRecoverySettings,
    restricted: true
  });

  game.settings.register(MODULE_ID, "showQuickPanel", {
    name: "ARS.Settings.showQuickPanel.Name",
    hint: "ARS.Settings.showQuickPanel.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: renderQuickPanel
  });
}

function actorFromSheet(app) {
  return app.actor ?? app.document;
}

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function rollModeOptions(selected) {
  return [
    ["publicroll", "RollModePublic"],
    ["gmroll", "RollModePrivate"],
    ["blindroll", "RollModeBlind"],
    ["selfroll", "RollModeSelf"]
  ].map(([value, key]) => (
    `<option value="${value}" ${selected === value ? "selected" : ""}>${game.i18n.localize(key)}</option>`
  )).join("");
}

function findLootSection(element) {
  const candidates = [...element.querySelectorAll(".items-section")];
  const byDataset = candidates.find(section => Object.values(section.dataset).some(value => (
    String(value).toLocaleLowerCase() === "loot"
  )));
  if ( byDataset ) return byDataset;
  const lootLabel = game.i18n.localize("TYPES.Item.lootPl").trim().toLocaleLowerCase(game.i18n.lang);
  return candidates.find(section => (
    section.querySelector(".items-header h3")?.textContent.trim().toLocaleLowerCase(game.i18n.lang) === lootLabel
  ));
}

function sheetAddictionHTML(actor, addiction, editable) {
  const canRoll = addiction.status === "recovery";
  const mode = game.settings.get(MODULE_ID, "defaultRollMode");
  return `
    <details class="ars-sheet-addiction" data-addiction-id="${addiction.id}">
      <summary>
        <span class="ars-sheet-addiction-name">${escape(addiction.name)}</span>
        <span class="ars-die-badge">d${addiction.die}</span>
        <span class="ars-status-badge status-${addiction.status}">${escape(addictionStatusLabel(addiction.status))}</span>
        ${addiction.incurable ? `
          <span class="ars-incurable-badge" data-tooltip="${escape(localize("Addiction.IncurableHint"))}">
            <i class="fa-solid fa-lock" inert></i>
          </span>` : ""}
        <i class="fa-solid fa-chevron-down ars-chevron" inert></i>
      </summary>
      <div class="ars-sheet-addiction-body">
        <label>
          <span>${localize("Addiction.Triggers")}</span>
          <textarea rows="4" data-ars-sheet-triggers ${editable ? "" : "readonly"}>${escape(addiction.triggers)}</textarea>
        </label>
        ${editable ? `
          <button type="button" data-ars-save-triggers>
            <i class="fa-solid fa-floppy-disk" inert></i> ${localize("Manager.SaveTriggers")}
          </button>` : ""}
        ${game.user.isGM ? `<div class="ars-sheet-roll-controls">
          <label>
            <span>${localize("Roll.RollMode")}</span>
            <select data-ars-sheet-roll-mode ${canRoll ? "" : "disabled"}>${rollModeOptions(mode)}</select>
          </label>
          <div class="ars-sheet-roll-buttons">
            <button type="button" data-ars-sheet-roll="disadvantage" ${canRoll ? "" : "disabled"}>
              <i class="fa-solid fa-angles-down" inert></i> ${localize("Roll.disadvantage")}
            </button>
            <button type="button" data-ars-sheet-roll="normal" ${canRoll ? "" : "disabled"}>
              <i class="fa-solid fa-dice" inert></i> ${localize("Roll.normal")}
            </button>
            <button type="button" data-ars-sheet-roll="advantage" ${canRoll ? "" : "disabled"}>
              <i class="fa-solid fa-angles-up" inert></i> ${localize("Roll.advantage")}
            </button>
          </div>
        </div>` : ""}
      </div>
    </details>`;
}

function injectCharacterSheet(app, element) {
  const actor = actorFromSheet(app);
  if ( actor?.type !== "character" ) return;
  element.querySelector(".ars-sheet-panel")?.remove();

  const data = getActorData(actor);
  if ( !data.addictions.length ) return;
  const editable = canEditTriggers(actor);
  const panel = document.createElement("section");
  panel.className = "items-section card ars-sheet-panel";
  panel.innerHTML = `
    <div class="items-header header ars-sheet-header">
      <h3 class="item-name">${localize("Sheet.Title")}</h3>
      <span class="ars-count" data-tooltip="${localize("Manager.AddictionCount")}">${data.addictions.length}</span>
      ${game.user.isGM ? `
        <button type="button" class="unbutton" data-ars-open-manager
                aria-label="${escape(localize("Manager.Title"))}">
          <i class="fa-solid fa-gear" inert></i>
        </button>` : ""}
    </div>
    <div class="ars-sheet-list">
      ${data.addictions.map(addiction => sheetAddictionHTML(actor, addiction, editable)).join("")}
    </div>`;

  const loot = findLootSection(element);
  if ( loot ) loot.insertAdjacentElement("afterend", panel);
  else element.querySelector(".inventory-element .items-list")?.append(panel);

  panel.querySelector("[data-ars-open-manager]")?.addEventListener("click", () => openManager({ focusSearch: true }));
  for ( const entry of panel.querySelectorAll(".ars-sheet-addiction") ) {
    const addictionId = entry.dataset.addictionId;
    entry.querySelector("[data-ars-save-triggers]")?.addEventListener("click", async () => {
      const triggers = entry.querySelector("[data-ars-sheet-triggers]").value;
      await updateAddiction(actor, addictionId, { triggers });
      ui.notifications.info(localize("Notifications.Saved"));
    });
    for ( const button of entry.querySelectorAll("[data-ars-sheet-roll]") ) {
      button.addEventListener("click", async () => {
        const rollMode = entry.querySelector("[data-ars-sheet-roll-mode]").value;
        await rollSobrietyDie(actor, addictionId, {
          mode: button.dataset.arsSheetRoll,
          rollMode,
          trigger: localize("Trigger.Manual")
        });
      });
    }
  }
}

function injectLongRestSection(app, element) {
  if ( element.querySelector(".ars-long-rest-section") ) return;
  const actor = actorFromSheet(app);
  if ( actor?.type !== "character" ) return;
  const addictions = getActorData(actor).addictions.filter(addiction => addiction.status !== "recovered");
  if ( !addictions.length ) return;
  const recoveryConfig = getLongRestRecoveryConfig();
  const chooseSpecific = recoveryConfig.mode === "specific";
  const targetControl = chooseSpecific ? `
    <div class="ars-rest-target">
      <label>
        <span>${localize("Rest.SelectAddiction")}</span>
        <select name="addictionRecoveryTarget">
          ${addictions.map(addiction => `
            <option value="${escape(addiction.id)}">${escape(addiction.name)} (d${addiction.die})</option>
          `).join("")}
        </select>
      </label>
      <p class="hint">${localize("Rest.SelectAddictionHint")}</p>
    </div>` : `
    <p class="hint ars-rest-configured-target">
      <strong>${localize("Rest.ConfiguredTarget")}:</strong> ${localize("Rest.AllAddictions")}
    </p>`;

  const fieldset = document.createElement("fieldset");
  fieldset.className = "ars-long-rest-section";
  fieldset.innerHTML = `
    <legend>${localize("Rest.Title")}</legend>
    <div class="form-group">
      <label class="checkbox">
        <input type="checkbox" name="addictionRecovery" value="true">
        <span>${localize("Rest.Checkbox")}</span>
      </label>
      <p class="hint">${localize(chooseSpecific ? "Rest.HintSpecific" : "Rest.HintAll")}</p>
      ${targetControl}
    </div>
  `;
  const section = element.querySelector("[data-application-part='content'] > section, section.flexcol");
  const request = [...section?.querySelectorAll(":scope > fieldset") ?? []]
    .find(candidate => candidate.querySelector("[name='autoRest'], [name^='targets.']"));
  if ( request ) request.insertAdjacentElement("beforebegin", fieldset);
  else section?.append(fieldset);

  if ( chooseSpecific ) {
    const checkbox = fieldset.querySelector("[name='addictionRecovery']");
    const target = fieldset.querySelector(".ars-rest-target");
    const updateTargetState = () => {
      target?.classList.toggle("is-disabled", !checkbox?.checked);
    };
    checkbox?.addEventListener("change", updateTargetState);
    updateTargetState();
  }
}

async function appendRestSummary(actor, result) {
  const recovery = result[MODULE_ID];
  if ( result.type !== "long" || !recovery?.summaries?.length || !result.message ) return;
  const selection = recovery.selected ? localize("Rest.Selected") : localize("Rest.NotSelected");
  const target = recovery.targetId === "all"
    ? localize("Rest.AllAddictions")
    : recovery.targetName;
  const rows = recovery.summaries.map(summary => `
    <li>
      <strong>${escape(summary.name)}</strong>
      <span>d${summary.before} → d${summary.after}</span>
      <span>${localize(`Outcome.${summary.outcome}`)}</span>
      ${summary.incurable ? `<i class="fa-solid fa-lock" data-tooltip="${escape(localize("Addiction.Incurable"))}"></i>` : ""}
    </li>`).join("");
  const addition = `
    <section class="ars-rest-summary">
      <h3><i class="fa-solid fa-heart-pulse" inert></i> ${localize("Rest.Title")}</h3>
      <p><strong>${localize("Rest.Choice")}:</strong> ${selection}</p>
      ${recovery.selected && target
        ? `<p><strong>${localize("Rest.Target")}:</strong> ${escape(target)}</p>`
        : ""}
      <ul>${rows}</ul>
    </section>`;
  await result.message.update({ content: `${result.message.content}${addition}` });
}

function enhanceChatMessage(message, html) {
  const flags = message.flags?.[MODULE_ID];
  if ( !flags ) return;

  if ( flags.type === "sobriety-roll" && flags.naturalOne ) {
    html.querySelectorAll(".dice-total").forEach(total => total.classList.add("failure", "fumble"));
  }

  if ( flags.type !== "trigger-prompt" ) return;
  const card = html.querySelector(".ars-trigger-card");
  if ( !card ) return;
  const actor = game.actors.get(flags.actorId);
  const allowed = game.user.isGM || actor?.isOwner;
  const openButton = card.querySelector("[data-ars-open-roll]");
  const state = card.querySelector("[data-ars-trigger-state]");

  if ( flags.resolved ) {
    card.classList.add("is-resolved");
    openButton?.remove();
    if ( state ) {
      state.classList.add("ars-resolved");
      state.innerHTML = `<i class="fa-solid fa-circle-check" inert></i><span>${localize("Trigger.Resolved")}</span>`;
    }
    return;
  }

  if ( !allowed ) openButton?.remove();
  else openButton?.addEventListener("click", () => openTriggerRollDialog({
    type: "showTriggerDialog",
    messageId: message.id
  }));
}

async function openTriggerRollDialog(payload) {
  const messageId = payload?.messageId;
  if ( !messageId || openTriggerDialogs.has(messageId) ) return;

  const message = game.messages.get(messageId);
  const flags = message?.flags?.[MODULE_ID];
  if ( !message || flags?.type !== "trigger-prompt" || flags.resolved ) return;

  const actor = game.actors.get(flags.actorId);
  if ( !actor || (!game.user.isGM && !actor.isOwner) ) return;
  const addiction = getActorData(actor).addictions.find(entry => entry.id === flags.addictionId);
  if ( !addiction || addiction.status !== "recovery" ) return;

  const options = rollModeOptions(game.settings.get(MODULE_ID, "defaultRollMode"));
  const safeActor = escape(actor.name);
  const safeAddiction = escape(addiction.name);
  const safeTrigger = escape(flags.trigger || localize("Trigger.Unspecified"));
  const content = `
    <div class="ars-roll-dialog-content">
      <div class="ars-roll-dialog-identity">
        <span class="ars-roll-dialog-icon"><i class="fa-solid fa-heart-pulse" inert></i></span>
        <div>
          <span>${safeActor}</span>
          <strong>${safeAddiction}</strong>
        </div>
      </div>
      <div class="ars-roll-dialog-die" aria-label="${escape(localize("Addiction.Die"))}: d${addiction.die}">
        ${sobrietyDieIcon(addiction.die)}
        <strong>d${addiction.die}</strong>
      </div>
      <div class="ars-roll-dialog-formula">
        <strong>1d${addiction.die}</strong>
        <span>${localize("Roll.Formula")}</span>
      </div>
      <div class="ars-roll-dialog-trigger">
        <i class="fa-solid fa-bolt" inert></i>
        <span><small>${localize("Trigger.Label")}</small><strong>${safeTrigger}</strong></span>
      </div>
      <fieldset>
        <legend>${localize("Roll.Configuration")}</legend>
        <label>
          <span>${localize("Roll.RollMode")}</span>
          <select name="rollMode" data-ars-dialog-roll-mode>${options}</select>
        </label>
      </fieldset>
    </div>`;

  const selectedRoll = mode => (_event, button) => ({
    mode,
    rollMode: button.form.elements.rollMode.value
  });

  openTriggerDialogs.add(messageId);
  try {
    const selection = await foundry.applications.api.DialogV2.wait({
      classes: ["ars-roll-dialog-window"],
      position: { width: 460 },
      window: {
        icon: "fa-solid fa-heart-pulse",
        title: localize("Trigger.RollDialogTitle")
      },
      content,
      buttons: [
        {
          action: "advantage",
          icon: "fa-solid fa-angles-up",
          label: localize("Roll.advantage"),
          callback: selectedRoll("advantage")
        },
        {
          action: "normal",
          icon: "fa-solid fa-dice",
          label: localize("Roll.normal"),
          default: true,
          callback: selectedRoll("normal")
        },
        {
          action: "disadvantage",
          icon: "fa-solid fa-angles-down",
          label: localize("Roll.disadvantage"),
          callback: selectedRoll("disadvantage")
        }
      ],
      rejectClose: false
    });
    if ( !selection ) return;

    const currentMessage = game.messages.get(messageId);
    if ( currentMessage?.flags?.[MODULE_ID]?.resolved ) {
      ui.notifications.info(localize("Notifications.TriggerAlreadyResolved"));
      return;
    }

    const result = await rollSobrietyDie(actor, flags.addictionId, {
      mode: selection.mode,
      rollMode: selection.rollMode,
      trigger: flags.trigger,
      promptMessageId: messageId
    });
    if ( result ) await markPromptResolved(currentMessage, result);
  } finally {
    openTriggerDialogs.delete(messageId);
  }
}

async function markPromptResolved(message, result) {
  const payload = {
    type: "resolvePrompt",
    messageId: message.id,
    actorId: result.actor.id,
    addictionId: result.addiction.id,
    rollMessageId: result.message?.id,
    outcome: result.resolution.outcome,
    total: result.roll.total
  };
  if ( game.user.isActiveGM ) return resolvePrompt(payload);
  game.socket.emit(SOCKET, payload);
}

async function handleSocket(payload) {
  if ( payload?.type === "showTriggerDialog" ) {
    await openTriggerRollDialog(payload);
    return;
  }
  if ( !game.user.isActiveGM ) return;
  if ( payload?.type === "resolvePrompt" ) await resolvePrompt(payload);
}

async function resolvePrompt(payload) {
  const message = game.messages.get(payload.messageId);
  const flags = message?.flags?.[MODULE_ID];
  if ( !message || flags?.type !== "trigger-prompt" || flags.resolved ) return;
  if ( flags.actorId !== payload.actorId || flags.addictionId !== payload.addictionId ) return;
  await message.update({
    [`flags.${MODULE_ID}.resolved`]: true,
    [`flags.${MODULE_ID}.rollMessageId`]: payload.rollMessageId,
    [`flags.${MODULE_ID}.outcome`]: payload.outcome,
    [`flags.${MODULE_ID}.total`]: payload.total
  });
}

async function renderQuickPanel() {
  document.getElementById("ars-quick-panel")?.remove();
  if ( !game.user?.isGM || !game.settings.get(MODULE_ID, "showQuickPanel") ) return;

  const stored = game.user.getFlag(MODULE_ID, "quickPanel") ?? {};
  const panel = document.createElement("aside");
  panel.id = "ars-quick-panel";
  panel.className = stored.minimized ? "minimized" : "";
  panel.dataset.locked = String(Boolean(stored.locked));
  panel.style.left = `${Number(stored.left) || 120}px`;
  panel.style.top = `${Number(stored.top) || 90}px`;
  panel.innerHTML = `
    <header data-ars-drag-handle>
      <span><i class="fa-solid fa-heart-pulse" inert></i> ${localize("Panel.Title")}</span>
      <div>
        <button type="button" class="unbutton" data-ars-panel-lock
                data-tooltip="${localize(stored.locked ? "Panel.Unlock" : "Panel.Lock")}">
          <i class="fa-solid ${stored.locked ? "fa-lock" : "fa-lock-open"}" inert></i>
        </button>
        <button type="button" class="unbutton" data-ars-panel-minimize
                data-tooltip="${localize(stored.minimized ? "Panel.Expand" : "Panel.Minimize")}">
          <i class="fa-solid ${stored.minimized ? "fa-plus" : "fa-minus"}" inert></i>
        </button>
      </div>
    </header>
    <div class="ars-panel-body">
      <button type="button" data-ars-panel-manager>
        <i class="fa-solid fa-users-gear" inert></i>
        <span>${localize("Panel.Characters")}</span>
      </button>
      <button type="button" data-ars-panel-trigger>
        <i class="fa-solid fa-bell" inert></i>
        <span>${localize("Panel.Trigger")}</span>
      </button>
      <button type="button" data-ars-panel-settings>
        <i class="fa-solid fa-gears" inert></i>
        <span>${localize("Panel.Settings")}</span>
      </button>
    </div>`;
  document.body.append(panel);

  panel.querySelector("[data-ars-panel-manager]").addEventListener("click", () => openManager());
  panel.querySelector("[data-ars-panel-trigger]").addEventListener("click", () => openManager({ focusSearch: true }));
  panel.querySelector("[data-ars-panel-settings]")
    .addEventListener("click", () => game.settings.sheet.render({ force: true }));
  panel.querySelector("[data-ars-panel-lock]").addEventListener("click", async () => {
    const current = game.user.getFlag(MODULE_ID, "quickPanel") ?? {};
    await game.user.setFlag(MODULE_ID, "quickPanel", { ...current, locked: !current.locked });
    renderQuickPanel();
  });
  panel.querySelector("[data-ars-panel-minimize]").addEventListener("click", async () => {
    const current = game.user.getFlag(MODULE_ID, "quickPanel") ?? {};
    await game.user.setFlag(MODULE_ID, "quickPanel", { ...current, minimized: !current.minimized });
    renderQuickPanel();
  });
  activatePanelDrag(panel);
}

function activatePanelDrag(panel) {
  const handle = panel.querySelector("[data-ars-drag-handle]");
  handle.addEventListener("pointerdown", event => {
    if ( panel.dataset.locked === "true" || event.target.closest("button") ) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const move = moveEvent => {
      const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
      panel.style.left = `${Math.max(0, Math.min(maxLeft, moveEvent.clientX - offsetX))}px`;
      panel.style.top = `${Math.max(0, Math.min(maxTop, moveEvent.clientY - offsetY))}px`;
    };
    const stop = async () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      const current = game.user.getFlag(MODULE_ID, "quickPanel") ?? {};
      await game.user.setFlag(MODULE_ID, "quickPanel", {
        ...current,
        left: parseFloat(panel.style.left),
        top: parseFloat(panel.style.top)
      });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop, { once: true });
  });
}
