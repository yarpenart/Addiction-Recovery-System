import assert from "node:assert/strict";
import test from "node:test";

import { clampPanelCoordinates } from "../scripts/panel-position.mjs";

test("quick panel remains visible after viewport changes", () => {
  assert.deepEqual(
    clampPanelCoordinates(
      { left: 1700, top: 900 },
      { width: 1280, height: 720 },
      { width: 220, height: 150 }
    ),
    { left: 1060, top: 570 }
  );
});

test("quick panel preserves a valid position", () => {
  assert.deepEqual(
    clampPanelCoordinates(
      { left: 120, top: 90 },
      { width: 1920, height: 1080 },
      { width: 220, height: 150 }
    ),
    { left: 120, top: 90 }
  );
});
