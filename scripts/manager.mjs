import {
  MODULE_ID,
  addictionStatusLabel,
  addAddiction,
  createTriggerPrompt,
  deleteAddiction,
  getActorData,
  getRules,
  localize,
  updateAddiction
} from "./api.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

let managerInstance;

function sceneActorIds() {
  return new Set((canvas?.scene?.tokens ?? []).map(token => token.actorId).filter(Boolean));
}

function managedActors() {
  const onScene = sceneActorIds();
  return game.actors
    .filter(actor => actor.type === "character")
    .map(actor => {
      const data = getActorData(actor);
      return {
        actor,
        addicted: data.addictions.length > 0,
        onScene: onScene.has(actor.id),
        source: localize(onScene.has(actor.id) ? "Manager.Token" : "Manager.Actor"),
        addictions: data.addictions
      };
    })
    .sort((a, b) => (
      Number(b.addicted) - Number(a.addicted)
      || Number(b.onScene) - Number(a.onScene)
      || a.actor.name.localeCompare(b.actor.name, game.i18n.lang)
    ));
}

export class AddictionManager extends HandlebarsApplicationMixin(ApplicationV2) {
  expandedActors = new Set();
  searchQuery = "";

  static DEFAULT_OPTIONS = {
    id: "ars-addiction-manager",
    classes: ["ars-app", "ars-manager"],
    position: {
      width: 760,
      height: 820
    },
    window: {
      icon: "fa-solid fa-heart-pulse",
      resizable: true,
      title: "ARS.Manager.Title"
    },
    actions: {
      addAddiction: AddictionManager.addAddictionAction,
      saveAddiction: AddictionManager.saveAddictionAction,
      deleteAddiction: AddictionManager.deleteAddictionAction,
      sendTrigger: AddictionManager.sendTriggerAction,
      openSheet: AddictionManager.openSheetAction
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/manager.hbs`,
      scrollable: [".ars-actor-list"]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const ladder = getRules().ladder;
    const statuses = ["recovery", "relapse", "recovered", "inactive"];
    context.actors = managedActors().map(entry => ({
      id: entry.actor.id,
      name: entry.actor.name,
      search: entry.actor.name.toLocaleLowerCase(game.i18n.lang),
      open: this.expandedActors.has(entry.actor.id),
      img: entry.actor.img,
      source: entry.source,
      addicted: entry.addicted,
      addictionCount: entry.addictions.length,
      addictions: entry.addictions.map(addiction => ({
        ...addiction,
        dieOptions: ladder.map(value => ({ value, selected: value === addiction.die })),
        statusOptions: statuses.map(value => ({
          value,
          label: addictionStatusLabel(value),
          selected: value === addiction.status
        })),
        historyCount: addiction.history.length
      }))
    }));
    context.rules = getRules();
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const search = this.element.querySelector("[data-ars-search]");
    if ( search ) search.value = this.searchQuery;
    search?.addEventListener("input", event => {
      const query = event.currentTarget.value.trim().toLocaleLowerCase(game.i18n.lang);
      this.searchQuery = query;
      for ( const card of this.element.querySelectorAll(".ars-actor-card") ) {
        const haystack = card.dataset.search ?? "";
        card.hidden = Boolean(query && !haystack.includes(query));
      }
    });
    search?.dispatchEvent(new Event("input"));
    for ( const card of this.element.querySelectorAll(".ars-actor-card") ) {
      card.addEventListener("toggle", () => {
        if ( card.open ) this.expandedActors.add(card.dataset.actorId);
        else this.expandedActors.delete(card.dataset.actorId);
      });
    }
  }

  static async addAddictionAction(event, target) {
    const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
    if ( !actor || !game.user.isGM ) return;
    this.expandedActors.add(actor.id);
    await addAddiction(actor);
    this.render();
  }

  static async saveAddictionAction(event, target) {
    const form = target.closest(".ars-addiction-form");
    const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
    const addictionId = form?.dataset.addictionId;
    if ( !actor || !addictionId || !game.user.isGM ) return;
    this.expandedActors.add(actor.id);
    await updateAddiction(actor, addictionId, {
      name: form.elements.name.value,
      die: Number(form.elements.die.value),
      status: form.elements.status.value,
      incurable: form.elements.incurable.checked,
      triggers: form.elements.triggers.value,
      notes: form.elements.notes.value
    });
    ui.notifications.info(localize("Notifications.Saved"));
    this.render();
  }

  static async deleteAddictionAction(event, target) {
    const form = target.closest(".ars-addiction-form");
    const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
    const addictionId = form?.dataset.addictionId;
    if ( !actor || !addictionId || !game.user.isGM ) return;
    const confirmed = await DialogV2.confirm({
      content: `<p><strong>${game.i18n.localize("AreYouSure")}</strong> ${localize("Manager.DeleteWarning")}</p>`,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-trash",
        title: localize("Manager.Delete")
      }
    });
    if ( !confirmed ) return;
    this.expandedActors.add(actor.id);
    await deleteAddiction(actor, addictionId);
    this.render();
  }

  static async sendTriggerAction(event, target) {
    const form = target.closest(".ars-addiction-form");
    const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
    const addictionId = form?.dataset.addictionId;
    if ( !actor || !addictionId || !game.user.isGM ) return;
    const trigger = form.querySelector("[data-ars-trigger-text]")?.value.trim() ?? "";
    await createTriggerPrompt(actor, addictionId, trigger);
    ui.notifications.info(localize("Notifications.TriggerSent"));
  }

  static openSheetAction(event, target) {
    const actor = game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);
    actor?.sheet.render({ force: true });
  }
}

export function openManager({ focusSearch=false }={}) {
  if ( !game.user.isGM ) return;
  if ( !managerInstance ) managerInstance = new AddictionManager();
  managerInstance.render({ force: true });
  if ( focusSearch ) {
    setTimeout(() => managerInstance.element?.querySelector("[data-ars-search]")?.focus(), 100);
  }
  return managerInstance;
}

export function refreshManager() {
  if ( managerInstance?.rendered ) managerInstance.render();
}
