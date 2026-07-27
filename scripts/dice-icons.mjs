const SUPPORTED_DICE = new Set([4, 6, 8, 10, 12, 20]);

export function sobrietyDieIcon(die) {
  const numericDie = Number(die);
  const dataDie = Number.isFinite(numericDie) ? numericDie : "custom";
  const assetDie = SUPPORTED_DICE.has(numericDie) ? numericDie : 20;
  return `
    <img class="ars-polyhedral-die" data-die="${dataDie}"
         src="modules/addiction-recovery-system/assets/dice/d${assetDie}.svg"
         alt="" aria-hidden="true" draggable="false">`;
}
