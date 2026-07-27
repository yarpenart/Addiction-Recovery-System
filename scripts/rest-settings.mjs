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
      height: 330
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
    return context;
  }

  static async saveAction() {
    if ( !game.user.isGM ) return;
    const mode = this.element.querySelector("[name='mode']:checked")?.value === "specific"
      ? "specific"
      : "all";
    await game.settings.set(MODULE_ID, "longRestRecoveryTargets", { mode });
    ui.notifications.info(localize("RestSettings.Saved"));
    await this.close();
  }
}
