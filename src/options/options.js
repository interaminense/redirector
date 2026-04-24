import { DEFAULT_RESOURCE_TYPES, RESOURCE_TYPES } from "../lib/constants.js";
import { validateRule } from "../lib/rules.js";
import {
  deleteRule,
  getLastSync,
  getRules,
  newRuleId,
  setRules,
  upsertRule
} from "../lib/storage.js";

const tbody = document.getElementById("rules-tbody");
const emptyMsg = document.getElementById("empty-msg");
const newBtn = document.getElementById("new-rule-btn");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const syncErrorEl = document.getElementById("sync-error");

const dialog = document.getElementById("rule-dialog");
const form = document.getElementById("rule-form");
const dialogTitle = document.getElementById("dialog-title");
const cancelBtn = document.getElementById("cancel-btn");
const formErrors = document.getElementById("form-errors");
const resourceTypesContainer = document.getElementById("resource-types-container");

let editingId = null;

function buildResourceTypeCheckboxes(selected) {
  resourceTypesContainer.innerHTML = "";
  const selectedSet = new Set(selected && selected.length ? selected : DEFAULT_RESOURCE_TYPES);
  for (const rt of RESOURCE_TYPES) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "resourceTypes";
    input.value = rt;
    input.checked = selectedSet.has(rt);
    const span = document.createElement("span");
    span.textContent = rt;
    label.appendChild(input);
    label.appendChild(span);
    resourceTypesContainer.appendChild(label);
  }
}

async function renderSyncError(rules) {
  const lastSync = await getLastSync();
  if (!lastSync || lastSync.ok !== false) {
    syncErrorEl.classList.add("hidden");
    syncErrorEl.textContent = "";
    return;
  }
  const offender = lastSync.offendingRuleId
    ? rules.find(r => r.id === lastSync.offendingRuleId)
    : null;
  const offenderLabel = offender
    ? (offender.description || offender.pattern || offender.id)
    : null;
  syncErrorEl.innerHTML = "";
  const b = document.createElement("b");
  b.textContent = "Rules failed to install — no redirects are active.";
  syncErrorEl.appendChild(b);
  const text = offenderLabel
    ? `Offending rule: ${offenderLabel}\nReason: ${lastSync.offendingReason || lastSync.error}`
    : (lastSync.error || "Unknown error");
  syncErrorEl.appendChild(document.createTextNode(text));
  syncErrorEl.classList.remove("hidden");
}

async function render() {
  const rules = await getRules();
  await renderSyncError(rules);
  tbody.innerHTML = "";

  if (rules.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

  for (const rule of rules) {
    const tr = document.createElement("tr");

    const onCell = document.createElement("td");
    const toggle = document.createElement("label");
    toggle.className = "switch";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = rule.enabled !== false;
    toggleInput.addEventListener("change", async () => {
      await upsertRule({ ...rule, enabled: toggleInput.checked });
    });
    const slider = document.createElement("span");
    slider.className = "slider";
    toggle.appendChild(toggleInput);
    toggle.appendChild(slider);
    onCell.appendChild(toggle);

    const descCell = document.createElement("td");
    descCell.textContent = rule.description || "—";

    const patternCell = document.createElement("td");
    patternCell.className = "pattern";
    patternCell.textContent = rule.pattern;

    const redirectCell = document.createElement("td");
    redirectCell.className = "redirect";
    redirectCell.textContent = rule.redirectTo;

    const typeCell = document.createElement("td");
    const typeBadge = document.createElement("span");
    typeBadge.className = "badge";
    typeBadge.textContent = rule.patternType === "regex" ? "regex" : "wildcard";
    typeCell.appendChild(typeBadge);

    const corsCell = document.createElement("td");
    const corsBadge = document.createElement("span");
    corsBadge.className = "badge" + (rule.allowCors ? "" : " off");
    corsBadge.textContent = rule.allowCors ? "on" : "off";
    corsCell.appendChild(corsBadge);

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openDialog(rule));

    const dupBtn = document.createElement("button");
    dupBtn.textContent = "Duplicate";
    dupBtn.addEventListener("click", async () => {
      const copy = { ...rule, id: newRuleId(), description: (rule.description || "") + " (copy)" };
      await upsertRule(copy);
    });

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "danger";
    delBtn.addEventListener("click", async () => {
      if (confirm("Delete this rule?")) await deleteRule(rule.id);
    });

    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(dupBtn);
    actionsCell.appendChild(delBtn);

    tr.appendChild(onCell);
    tr.appendChild(descCell);
    tr.appendChild(patternCell);
    tr.appendChild(redirectCell);
    tr.appendChild(typeCell);
    tr.appendChild(corsCell);
    tr.appendChild(actionsCell);
    tbody.appendChild(tr);
  }
}

function openDialog(rule) {
  formErrors.textContent = "";
  if (rule) {
    editingId = rule.id;
    dialogTitle.textContent = "Edit rule";
    form.description.value = rule.description || "";
    form.patternType.value = rule.patternType === "regex" ? "regex" : "wildcard";
    form.pattern.value = rule.pattern || "";
    form.redirectTo.value = rule.redirectTo || "";
    form.allowCors.checked = Boolean(rule.allowCors);
    form.enabled.checked = rule.enabled !== false;
    buildResourceTypeCheckboxes(rule.resourceTypes);
  } else {
    editingId = null;
    dialogTitle.textContent = "New rule";
    form.reset();
    form.enabled.checked = true;
    form.patternType.value = "wildcard";
    buildResourceTypeCheckboxes(DEFAULT_RESOURCE_TYPES);
  }
  dialog.showModal();
}

function collectFormRule() {
  const fd = new FormData(form);
  const resourceTypes = fd.getAll("resourceTypes");
  return {
    id: editingId || newRuleId(),
    description: (fd.get("description") || "").toString().trim(),
    patternType: fd.get("patternType") === "regex" ? "regex" : "wildcard",
    pattern: (fd.get("pattern") || "").toString(),
    redirectTo: (fd.get("redirectTo") || "").toString(),
    allowCors: Boolean(fd.get("allowCors")),
    enabled: Boolean(fd.get("enabled")),
    resourceTypes
  };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rule = collectFormRule();
  const errors = validateRule(rule);
  if (errors.length > 0) {
    formErrors.textContent = errors.join(" ");
    return;
  }
  await upsertRule(rule);
  dialog.close();
});

cancelBtn.addEventListener("click", () => dialog.close());

newBtn.addEventListener("click", () => openDialog(null));

exportBtn.addEventListener("click", async () => {
  const rules = await getRules();
  const blob = new Blob([JSON.stringify({ rules }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "redirector-rules.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files && importFile.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = Array.isArray(parsed) ? parsed : parsed.rules;
    if (!Array.isArray(incoming)) {
      alert("Invalid JSON: expected an array or { rules: [...] }.");
      return;
    }
    const mode = confirm(
      "OK = Replace all existing rules with the imported ones.\n" +
      "Cancel = Merge (append, giving imports new IDs)."
    );
    if (mode) {
      await setRules(incoming.map(r => ({ ...r, id: r.id || newRuleId() })));
    } else {
      const existing = await getRules();
      const merged = [...existing, ...incoming.map(r => ({ ...r, id: newRuleId() }))];
      await setRules(merged);
    }
  } catch (err) {
    alert("Failed to import: " + err.message);
  } finally {
    importFile.value = "";
  }
});

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") render();
});

render();
