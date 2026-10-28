import { createFieldRenderer } from "./modules/home-field-renderer.js";

let surface, renderer;
self.onmessage = ({ data }) => {
  try {
    if (data.type === "init") {
      surface = data.canvas || surface;
      renderer?.destroy();
      renderer = createFieldRenderer(surface, data.settings, (message) => self.postMessage(message));
    } else if (data.type === "update") renderer?.update(data.settings);
    else if (data.type === "pointer") renderer?.pointer(data.point);
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
