const DIE_FACES = {
  4: `
    <polygon class="ars-die-shell" points="50,5 96,90 4,90"/>
    <path class="ars-die-line" d="M50 5v58M4 90l46-27 46 27"/>`,
  6: `
    <polygon class="ars-die-shell" points="50,5 92,28 92,72 50,95 8,72 8,28"/>
    <path class="ars-die-line" d="M50 5v46M8 28l42 23 42-23M50 51v44"/>`,
  8: `
    <polygon class="ars-die-shell" points="50,4 94,50 50,96 6,50"/>
    <path class="ars-die-line" d="M50 4v92M6 50l44-22 44 22M6 50l44 22 44-22"/>`,
  10: `
    <polygon class="ars-die-shell" points="50,3 92,36 79,80 50,97 21,80 8,36"/>
    <path class="ars-die-line" d="M50 3v94M8 36l42 21 42-21M21 80l29-23 29 23"/>`,
  12: `
    <polygon class="ars-die-shell" points="50,3 78,12 96,36 94,66 73,90 50,97 23,88 5,63 7,33 28,10"/>
    <polygon class="ars-die-line" points="50,24 72,40 64,67 36,67 28,40"/>
    <path class="ars-die-line" d="M50 3v21M78 12L72 40M96 36l-24 4M94 66l-30 1M73 90l-9-23M50 97L36 67M23 88l13-21M5 63l31 4M7 33l21 7M28 10l22 14"/>`,
  20: `
    <polygon class="ars-die-shell" points="50,3 84,18 97,52 82,84 50,97 18,84 3,52 16,18"/>
    <path class="ars-die-line" d="M50 3L29 34h42L50 3zM16 18l13 16L3 52l26-18-11 50 32-30-21-20M84 18L71 34l26 18-26-18 11 50-32-30 21-20M18 84h64M50 54v43"/>`
};

const GENERIC_FACE = `
  <circle class="ars-die-shell" cx="50" cy="50" r="46"/>
  <path class="ars-die-line" d="M50 4v92M4 50h92M18 18l64 64M82 18L18 82"/>`;

export function sobrietyDieIcon(die) {
  const numericDie = Number(die);
  const face = DIE_FACES[numericDie] ?? GENERIC_FACE;
  const dataDie = Number.isFinite(numericDie) ? numericDie : "custom";
  return `
    <svg class="ars-polyhedral-die" data-die="${dataDie}" viewBox="0 0 100 100"
         aria-hidden="true" focusable="false">
      ${face}
    </svg>`;
}
