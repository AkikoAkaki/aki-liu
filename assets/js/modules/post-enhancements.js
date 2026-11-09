export function initTableWrapping() {
  document.querySelectorAll(".post-content table").forEach((table) => {
    if (table.parentNode?.nodeType === Node.ELEMENT_NODE && table.parentNode.classList.contains("table-wrapper")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

const zh = () => document.documentElement.lang.startsWith("zh");
const ICON_COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>';
const ICON_DONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const DONE_MS = 1400;

// The Clipboard API needs a secure context; the LAN preview is plain http, so fall back there.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function flashDone(el, label, doneLabel) {
  el.classList.add("is-done");
  el.setAttribute("aria-label", doneLabel);
  clearTimeout(el._doneTimer);
  el._doneTimer = setTimeout(() => {
    el.classList.remove("is-done");
    el.setAttribute("aria-label", label);
  }, DONE_MS);
}

export function initCodeCopy() {
  const label = zh() ? "复制代码" : "Copy code";
  const doneLabel = zh() ? "已复制" : "Copied";
  document.querySelectorAll(".post-content pre").forEach((pre) => {
    if (pre.parentElement?.classList.contains("code-block")) return;
    const block = document.createElement("div");
    block.className = "code-block";
    pre.parentNode.insertBefore(block, pre);
    block.appendChild(pre);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.setAttribute("aria-label", label);
    button.innerHTML = `<span class="code-copy-icon">${ICON_COPY}</span><span class="code-copy-icon is-check">${ICON_DONE}</span>`;
    button.addEventListener("click", async () => {
      if (await copyText((pre.querySelector("code") ?? pre).textContent.replace(/\n$/, ""))) flashDone(button, label, doneLabel);
    });
    block.appendChild(button);
  });
}

