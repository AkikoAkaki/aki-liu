import { createFieldController } from "./modules/home-field-renderer.js";

const controller = createFieldController((message) => self.postMessage(message));
self.onmessage = ({ data }) => controller.handle(data);
