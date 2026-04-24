export const STORAGE_KEYS = {
  RULES: "rules",
  GLOBAL_ENABLED: "globalEnabled",
  LAST_SYNC: "lastSync"
};

export const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "script",
  "stylesheet",
  "image",
  "font",
  "media",
  "websocket",
  "other"
];

export const DEFAULT_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest"
];

export const CORS_RESPONSE_HEADERS = [
  { header: "access-control-allow-origin", operation: "set", value: "*" },
  { header: "access-control-allow-methods", operation: "set", value: "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD" },
  { header: "access-control-allow-headers", operation: "set", value: "*" },
  { header: "access-control-expose-headers", operation: "set", value: "*" },
  { header: "access-control-allow-credentials", operation: "remove" }
];

export const PATTERN_TYPES = ["wildcard", "regex"];
