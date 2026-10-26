export function initTableWrapping() {
  document.querySelectorAll(".post-content table").forEach((table) => {
    if (table.parentNode?.nodeType === Node.ELEMENT_NODE && table.parentNode.classList.contains("table-wrapper")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}
