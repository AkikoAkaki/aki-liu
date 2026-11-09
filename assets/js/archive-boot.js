import { archiveEntries, readArchiveFilters, updateArchiveView } from "./modules/archive-state.js";

const list = document.querySelector("[data-archive-filter-root]");
updateArchiveView(archiveEntries(list), readArchiveFilters(list));
document.documentElement.removeAttribute("data-archive-restoring");
