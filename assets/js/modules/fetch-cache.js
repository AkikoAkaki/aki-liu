import { isResourceConstrained } from "./resource-mode.js";

export async function fetchJson(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export function createJsonCache(limit, constrainedLimit) {
  const entries = new Map();
  return function load(url) {
    let request = entries.get(url);
    if (request) {
      entries.delete(url);
    } else {
      request = fetchJson(url).catch((error) => {
        if (entries.get(url) === request) entries.delete(url);
        throw error;
      });
    }
    entries.set(url, request);
    const max = isResourceConstrained() ? constrainedLimit : limit;
    while (entries.size > max) entries.delete(entries.keys().next().value);
    return request;
  };
}
