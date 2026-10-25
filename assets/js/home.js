document.addEventListener("DOMContentLoaded", () => {
  const navContent = document.querySelector(".nav-panel-content");
  const leftCol = document.querySelector(".work-column:not(.nav-panel-column)");
  if (!navContent || !leftCol) return;

  function updateNavGap() {
    if (!window.matchMedia("(min-width: 901px)").matches) return;
    const groups = navContent.querySelectorAll(".nav-panel-group");
    const list = navContent.querySelector(".nav-panel-list");
    if (!list) return;

    let groupsH = 0;
    groups.forEach((group) => { groupsH += group.getBoundingClientRect().height; });

    const listH = list.getBoundingClientRect().height;
    const free = Math.max(0, listH - groupsH);

    let slots = Math.max(0, groups.length - 1);
    groups.forEach((group) => {
      const sub = group.querySelectorAll(".nav-panel-subitem").length;
      if (sub > 1) slots += sub - 1;
    });

    const gap = slots > 0 ? Math.max(6, Math.round(free / slots)) : 12;
    navContent.style.setProperty("--nav-flow-gap", gap + "px");
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      updateNavGap();
    });
  }

  window.addEventListener("resize", schedule);
  schedule();
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(schedule);
    observer.observe(leftCol);
    observer.observe(navContent);
  }
});
