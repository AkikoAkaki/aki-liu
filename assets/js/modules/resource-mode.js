export function isResourceConstrained() {
  return navigator.deviceMemory <= 4 || navigator.connection?.saveData === true;
}

// main.js sets the attribute through initResourceMode before route scripts run.
export function isLowResourceMode() {
  return document.documentElement.hasAttribute('data-low-resource');
}

export function isSlowNetwork() {
  const connection = navigator.connection;
  return connection?.saveData === true || /^(slow-2g|2g|3g)$/.test(connection?.effectiveType);
}

export function initResourceMode() {
  const transparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  function update() {
    document.documentElement.toggleAttribute('data-low-resource',
      isResourceConstrained() || transparency.matches);
  }
  update();
  transparency.addEventListener('change', update);
  navigator.connection?.addEventListener('change', update);
}
