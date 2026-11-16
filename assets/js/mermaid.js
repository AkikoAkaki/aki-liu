// Renders ```mermaid blocks with Pele. Only the diagram types a page uses are downloaded.
const src = document.currentScript.dataset.peleSrc;
const blocks = document.querySelectorAll(".post-content .mermaid");

if (blocks.length) {
  import(src).then(({ mountAsync }) => {
    for (const el of blocks) {
      const text = el.querySelector("pre").textContent;
      const fallback = [...el.childNodes];
      const restore = () => el.replaceChildren(...fallback);
      mountAsync(el, text).then((mounted) => {
        if (mounted.error) {
          mounted.destroy();
          restore();
        }
      }, restore);
    }
  }).catch(() => {});
}
