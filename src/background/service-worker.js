import { buildAllDnrRules, toDnrRules, validateRule } from "../lib/rules.js";
import {
  getGlobalEnabled,
  getRules,
  onStorageChanged,
  setLastSync
} from "../lib/storage.js";

async function findOffendingRule(userRules) {
  let nextId = 10000;
  for (const userRule of userRules) {
    if (!userRule || userRule.enabled === false) continue;
    if (validateRule(userRule).length > 0) {
      return { rule: userRule, reason: validateRule(userRule).join(" ") };
    }
    const { rules, consumed } = toDnrRules(userRule, nextId);
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map(r => r.id),
        addRules: rules
      });
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map(r => r.id),
        addRules: []
      });
    } catch (err) {
      return { rule: userRule, reason: err && err.message ? err.message : String(err) };
    }
    nextId += consumed;
  }
  return null;
}

async function syncDnrRules() {
  const [enabled, userRules] = await Promise.all([
    getGlobalEnabled(),
    getRules()
  ]);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);

  const addRules = enabled ? buildAllDnrRules(userRules) : [];

  let ok = true;
  let error = null;
  let offending = null;
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    });
  } catch (err) {
    ok = false;
    error = err && err.message ? err.message : String(err);
    console.error("[Redirector] Failed to update dynamic rules:", err);
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: (await chrome.declarativeNetRequest.getDynamicRules()).map(r => r.id),
        addRules: []
      });
      offending = await findOffendingRule(userRules);
    } catch (cleanupErr) {
      console.error("[Redirector] Cleanup after failure also errored:", cleanupErr);
    }
  }

  await setLastSync({
    at: Date.now(),
    ok,
    error,
    activeDnrRules: ok ? addRules.length : 0,
    offendingRuleId: offending ? offending.rule.id : null,
    offendingReason: offending ? offending.reason : null
  });

  await updateBadge(enabled, userRules, ok);
}

async function updateBadge(enabled, userRules, ok) {
  const activeCount = enabled
    ? userRules.filter(r => r && r.enabled !== false).length
    : 0;

  if (!ok) {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#c0392b" });
    return;
  }

  if (!enabled) {
    await chrome.action.setBadgeText({ text: "off" });
    await chrome.action.setBadgeBackgroundColor({ color: "#888888" });
    return;
  }

  if (activeCount === 0) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  await chrome.action.setBadgeText({ text: String(activeCount) });
  await chrome.action.setBadgeBackgroundColor({ color: "#2b7de9" });
}

chrome.runtime.onInstalled.addListener(() => {
  syncDnrRules();
});

chrome.runtime.onStartup.addListener(() => {
  syncDnrRules();
});

onStorageChanged(() => {
  syncDnrRules();
});

// Initial sync on service worker boot.
syncDnrRules();
