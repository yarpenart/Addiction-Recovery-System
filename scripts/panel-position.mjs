export function clampPanelCoordinates(position = {}, viewport = {}, panelSize = {}) {
  const maximumLeft = Math.max(0, Number(viewport.width || 0) - Number(panelSize.width || 0));
  const maximumTop = Math.max(0, Number(viewport.height || 0) - Number(panelSize.height || 0));
  return {
    left: Math.max(0, Math.min(maximumLeft, Number(position.left) || 0)),
    top: Math.max(0, Math.min(maximumTop, Number(position.top) || 0))
  };
}
