export function initExpandableCards() {
    // --- Expandable card toggle ---
    const cardHeaders = document.querySelectorAll(".now-card-header");
    cardHeaders.forEach((button) => {
      button.addEventListener("click", () => {
        const card = button.parentElement;
        card.classList.toggle("is-expanded");
        card.classList.toggle("is-collapsed");
      });
    });
}

export function initTableWrapping() {
  document.querySelectorAll(".post-content table").forEach((table) => {
    if (table.parentNode?.nodeType === Node.ELEMENT_NODE && table.parentNode.classList.contains("table-wrapper")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

export function initFooterReveal() {
  const footer = document.querySelector(".site-footer");
  const wrapper = document.querySelector(".site-wrapper");
  if (!footer || !wrapper) return;

  let footerHeight = 0;

  function updateLayout() {
    footerHeight = footer.offsetHeight;
    wrapper.style.marginBottom = footerHeight + "px";
    onScroll();
  }

  const ro = new ResizeObserver(() => {
    requestAnimationFrame(updateLayout);
  });
  ro.observe(footer);

  let isAnimating = false;

  function onScroll() {
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    let scrollBottom = maxScroll - window.scrollY;
    if (scrollBottom < 0) scrollBottom = 0;

    const revealDistance = Math.max(1, footerHeight);

    // Only reveal when the user has actually scrolled toward the bottom.
    // Without the scrollY guard, short pages (and microblog before its feed
    // fetches) hit this branch on first paint and snap from scaleX(1) to
    // scaleX(0.956) the moment JS runs, which reads as a flicker.
    if (
      scrollBottom <= footerHeight &&
      footerHeight > 0 &&
      window.scrollY > 0
    ) {
      let progress = 1 - scrollBottom / revealDistance;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;

      // Quartic Ease Out for smoother non-linear curve
      const eased = 1 - Math.pow(1 - progress, 4);
      const radius = 40 * eased; // from square slowly to round
      const scaleX = 1 - 0.044 * eased;

      wrapper.style.setProperty("--footer-reveal-radius", radius + "px");
      wrapper.style.transform = "scaleX(" + scaleX + ")";
      wrapper.style.boxShadow = "none";
    } else {
      wrapper.style.transform = "none";
      wrapper.style.boxShadow = "none";
      wrapper.style.setProperty("--footer-reveal-radius", "0px");
    }
    isAnimating = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true },
  );

  updateLayout();
}
