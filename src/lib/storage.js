import { STORAGE_KEYS } from "./constants.js";

export async function getRules() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.RULES);
  return Array.isArray(data[STORAGE_KEYS.RULES]) ? data[STORAGE_KEYS.RULES] : [];
}

export async function setRules(rules) {
  await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules });
}

export async function getGlobalEnabled() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.GLOBAL_ENABLED);
  const value = data[STORAGE_KEYS.GLOBAL_ENABLED];
  return value === undefined ? true : Boolean(value);
}

export async function setGlobalEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_KEYS.GLOBAL_ENABLED]: Boolean(enabled) });
}

export async function upsertRule(rule) {
  const rules = await getRules();
  const idx = rules.findIndex(r => r.id === rule.id);
  if (idx >= 0) rules[idx] = rule;
  else rules.push(rule);
  await setRules(rules);
}

export async function deleteRule(id) {
  const rules = await getRules();
  await setRules(rules.filter(r => r.id !== id));
}

export function onStorageChanged(callback) {
  const handler = (changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[STORAGE_KEYS.RULES] || changes[STORAGE_KEYS.GLOBAL_ENABLED]) {
      callback(changes);
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export async function getLastSync() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.LAST_SYNC);
  return data[STORAGE_KEYS.LAST_SYNC] || null;
}

export async function setLastSync(info) {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_SYNC]: info });
}

export function onLastSyncChanged(callback) {
  const handler = (changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[STORAGE_KEYS.LAST_SYNC]) callback(changes[STORAGE_KEYS.LAST_SYNC].newValue || null);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export function newRuleId() {
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "r_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
