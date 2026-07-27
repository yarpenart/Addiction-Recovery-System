import {
  MODULE_ID,
  getLongRestRecoveryConfig,
  localize
} from "./api.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class LongRestRecoverySettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "ars-long-rest-recovery-settings",
    classes: ["ars-app", "ars-rest-settings"],
    position: {
      width: 620,
      height: 500
    },
    window: {
      icon: "fa-solid fa-bed",
      resizable: true,
      title: "ARS.RestSettings.Title"
    },
    actions: {
      save: LongRestRecoverySettings.saveAction
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/rest-settings.hbs`
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = getLongRestRecoveryConfig();
    context.modeAll = config.mode === "all";
    context.modeSpecific = config.mode === "specific";
    context.otherUnchanged = config.otherAddictions === "unchanged";
    context.otherDecrease = config.otherAddictions === "decrease";
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const updateSpecificOptions = () => {
      const specific = this.element.querySelector("[name='mode']:checked")?.value === "specific";
      const section = this.element.querySelector("[data-ars-specific-options]");
      if ( section ) section.hidden = !specific;
      for ( const input of section?.querySelectorAll("input") ?? [] ) input.disabled = !specific;
    };
    for ( const input of this.element.querySelectorAll("[name='mode']") ) {
      input.addEventListener("change", updateSpecificOptions);
    }
    updateSpecificOptions();
  }

  static async saveAction() {
    if ( !game.user.isGM ) return;
    const mode = this.element.querySelector("[name='mode']:checked")?.value === "specific"
      ? "specific"
      : "all";
    const otherAddictions = this.element.querySelector("[name='otherAddictions']:checked")?.value === "decrease"
      ? "decrease"
      : "unchanged";
    await game.settings.set(MODULE_ID, "longRestRecoveryTargets", { mode, otherAddictions });
    ui.notifications.info(localize("RestSettings.Saved"));
    await this.close();
  }
}
