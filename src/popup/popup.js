import {
  getGlobalEnabled,
  getLastSync,
  getRules,
  setGlobalEnabled,
  upsertRule
} from "../lib/storage.js";

const globalToggle = document.getElementById("global-toggle");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("rule-list");
const emptyEl = document.getElementById("empty");
const manageBtn = document.getElementById("manage-btn");
const syncErrorEl = document.getElementById("sync-error");

async function render() {
  const [enabled, rules, lastSync] = await Promise.all([
    getGlobalEnabled(),
    getRules(),
    getLastSync()
  ]);
  globalToggle.checked = enabled;

  if (lastSync && lastSync.ok === false) {
    const offenderLabel = lastSync.offendingRuleId
      ? (rules.find(r => r.id === lastSync.offendingRuleId)?.description
          || rules.find(r => r.id === lastSync.offendingRuleId)?.pattern
          || lastSync.offendingRuleId)
      : null;
    const offenderLine = offenderLabel
      ? `\nOffending rule: ${offenderLabel}\nReason: ${lastSync.offendingReason || lastSync.error}`
      : `\n${lastSync.error || "Unknown error"}`;
    syncErrorEl.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = "Rules failed to install";
    syncErrorEl.appendChild(b);
    syncErrorEl.appendChild(document.createTextNode(offenderLine));
    syncErrorEl.classList.remove("hidden");
  } else {
    syncErrorEl.classList.add("hidden");
    syncErrorEl.textContent = "";
  }

  const activeCount = rules.filter(r => r.enabled !== false).length;
  if (!enabled) {
    statusEl.textContent = "All redirects are disabled.";
  } else if (rules.length === 0) {
    statusEl.textContent = "No rules configured.";
  } else {
    statusEl.textContent = `${activeCount} of ${rules.length} rule(s) active.`;
  }

  listEl.innerHTML = "";
  if (rules.length === 0) {
    emptyEl.classList.remove("hidden");
  } else {
    emptyEl.classList.add("hidden");
    for (const rule of rules) {
      listEl.appendChild(renderRule(rule));
    }
  }
}

function renderRule(rule) {
  const li = document.createElement("li");
  li.className = "rule-item";

  const info = document.createElement("div");
  info.className = "rule-info";

  const title = document.createElement("div");
  title.className = "rule-title";
  title.textContent = rule.description || rule.pattern || "(untitled rule)";

  const meta = document.createElement("div");
  meta.className = "rule-meta";
  const typeBadge = document.createElement("span");
  typeBadge.className = "rule-badge";
  typeBadge.textContent = rule.patternType === "regex" ? "regex" : "wildcard";
  meta.textContent = rule.pattern + " → " + rule.redirectTo + " ";
  meta.appendChild(typeBadge);
  if (rule.allowCors) {
    const corsBadge = document.createElement("span");
    corsBadge.className = "rule-badge cors";
    corsBadge.textContent = "CORS";
    meta.appendChild(corsBadge);
  }

  info.appendChild(title);
  info.appendChild(meta);

  const toggleLabel = document.createElement("label");
  toggleLabel.className = "switch small";
  const toggleInput = document.createElement("input");
  toggleInput.type = "checkbox";
  toggleInput.checked = rule.enabled !== false;
  toggleInput.addEventListener("change", async () => {
    await upsertRule({ ...rule, enabled: toggleInput.checked });
  });
  const toggleSlider = document.createElement("span");
  toggleSlider.className = "slider";
  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleSlider);

  li.appendChild(info);
  li.appendChild(toggleLabel);
  return li;
}

globalToggle.addEventListener("change", async () => {
  await setGlobalEnabled(globalToggle.checked);
});

manageBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") render();
});

render();
