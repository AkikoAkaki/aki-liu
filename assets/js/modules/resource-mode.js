export function isResourceConstrained() {
  return navigator.deviceMemory <= 4 || navigator.connection?.saveData === true;
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
