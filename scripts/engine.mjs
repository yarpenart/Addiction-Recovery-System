export const DEFAULT_LADDER = Object.freeze([4, 6, 8, 10, 12, 20]);

export function parseDieLadder(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[,;\s]+/);
  const values = [...new Set(source
    .map(entry => Number(String(entry).toLowerCase().replace(/^d/, "")))
    .filter(entry => Number.isInteger(entry) && entry >= 2 && entry <= 100))]
    .sort((a, b) => a - b);
  return values.length ? values : [...DEFAULT_LADDER];
}

export function clampDie(die, ladder) {
  const values = parseDieLadder(ladder);
  const numeric = Number(die);
  if ( values.includes(numeric) ) return numeric;
  return values.reduce((closest, candidate) => (
    Math.abs(candidate - numeric) < Math.abs(closest - numeric) ? candidate : closest
  ), values[0]);
}

export function shiftDie(die, steps, ladder) {
  const values = parseDieLadder(ladder);
  const current = clampDie(die, values);
  const index = values.indexOf(current);
  const target = Math.max(0, Math.min(values.length - 1, index + Number(steps || 0)));
  return values[target];
}

export function sobrietyFormula(die, mode="normal") {
  const faces = Math.max(2, Number(die) || 4);
  if ( mode === "advantage" ) return `2d${faces}kh`;
  if ( mode === "disadvantage" ) return `2d${faces}kl`;
  return `1d${faces}`;
}

export function resolveSobrietyRoll(addiction, total, rules={}) {
  const ladder = parseDieLadder(rules.ladder);
  const before = clampDie(addiction.die, ladder);
  const maintainThreshold = Math.max(2, Number(rules.maintainThreshold) || 2);
  const dropSteps = Math.max(1, Number(rules.triggerDropSteps) || 1);
  const failed = Number(total) < maintainThreshold;
  const atMinimum = before === ladder[0];
  let after = before;
  let status = addiction.status ?? "recovery";
  let outcome = "maintained";

  if ( failed && atMinimum && rules.relapseOnMinimumFailure !== false ) {
    status = "relapse";
    outcome = "relapse";
  } else if ( failed ) {
    after = shiftDie(before, -dropSteps, ladder);
    outcome = "reduced";
  }

  return {
    before,
    after,
    status,
    failed,
    naturalOne: Number(total) === 1,
    outcome
  };
}

export function resolveRecovery(addiction, selected, rules={}) {
  const ladder = parseDieLadder(rules.ladder);
  const gainSteps = Math.max(1, Number(rules.recoveryGainSteps) || 1);
  const before = clampDie(addiction.die, ladder);
  const initialStatus = addiction.status ?? "recovery";
  let after = before;
  let status = initialStatus;
  let outcome = "unchanged";

  if ( selected ) {
    if ( initialStatus === "relapse" || initialStatus === "inactive" ) {
      after = ladder[0];
      status = "recovery";
      outcome = "reentered";
    } else if ( initialStatus === "recovery" ) {
      const atMaximum = before === ladder.at(-1);
      if ( atMaximum && rules.completeAtMaximum && !addiction.incurable ) {
        status = "recovered";
        outcome = "recovered";
      } else {
        after = shiftDie(before, gainSteps, ladder);
        outcome = after === before ? "maximum" : "improved";
      }
    }
  } else if ( rules.uncheckedBehavior === "decrease" && initialStatus === "recovery" ) {
    after = shiftDie(before, -gainSteps, ladder);
    outcome = after === before ? "minimum" : "reduced";
  }

  return { before, after, status, outcome, selected: Boolean(selected) };
}

export function normalizeAddiction(addiction={}, rules={}) {
  const ladder = parseDieLadder(rules.ladder);
  return {
    id: String(addiction.id ?? ""),
    name: String(addiction.name ?? "").trim(),
    die: clampDie(addiction.die ?? ladder[0], ladder),
    status: ["recovery", "relapse", "recovered", "inactive"].includes(addiction.status)
      ? addiction.status
      : "recovery",
    incurable: Boolean(addiction.incurable),
    triggers: String(addiction.triggers ?? ""),
    notes: String(addiction.notes ?? ""),
    createdAt: Number(addiction.createdAt) || Date.now(),
    history: Array.isArray(addiction.history) ? addiction.history : []
  };
}

export function appendHistory(addiction, entry, maximum=50) {
  const limit = Math.max(0, Number(maximum) || 0);
  if ( !limit ) return { ...addiction, history: [] };
  const history = [entry, ...(addiction.history ?? [])].slice(0, limit);
  return { ...addiction, history };
}
