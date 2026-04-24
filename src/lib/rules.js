import {
  CORS_RESPONSE_HEADERS,
  DEFAULT_RESOURCE_TYPES,
  RESOURCE_TYPES
} from "./constants.js";

// Escape regex specials for a wildcard pattern, while preserving the `*` token.
// `*` becomes `(.*)` so wildcard segments act as regex capture groups.
function wildcardPatternToRegex(pattern) {
  let out = "";
  for (const ch of pattern) {
    if (ch === "*") {
      out += "(.*)";
    } else if ("\\^$.|?+()[]{}".includes(ch)) {
      out += "\\" + ch;
    } else {
      out += ch;
    }
  }
  return "^" + out + "$";
}

// declarativeNetRequest's regexSubstitution uses `\1..\9` for capture groups,
// but users type `$1..$9` (as in the reference extension). Convert and escape
// any literal backslashes the user may have typed.
function substitutionToDnr(substitution) {
  return substitution
    .replace(/\\/g, "\\\\")
    .replace(/\$(\d)/g, "\\$1");
}

function sanitizeResourceTypes(types) {
  if (!Array.isArray(types) || types.length === 0) return [...DEFAULT_RESOURCE_TYPES];
  const set = new Set(types.filter(t => RESOURCE_TYPES.includes(t)));
  if (set.size === 0) return [...DEFAULT_RESOURCE_TYPES];
  return [...set];
}

export function validateRule(rule) {
  const errors = [];
  if (!rule || typeof rule !== "object") {
    errors.push("Rule is not an object.");
    return errors;
  }
  if (!rule.pattern || typeof rule.pattern !== "string") {
    errors.push("Pattern is required.");
  }
  if (!rule.redirectTo || typeof rule.redirectTo !== "string") {
    errors.push("Redirect target is required.");
  }
  if (rule.patternType && rule.patternType !== "wildcard" && rule.patternType !== "regex") {
    errors.push("Pattern type must be 'wildcard' or 'regex'.");
  }
  if (rule.patternType === "regex" && rule.pattern) {
    try {
      new RegExp(rule.pattern);
    } catch (e) {
      errors.push("Invalid regex: " + e.message);
    }
  }
  return errors;
}

// Normalize a user-facing rule into one or two declarativeNetRequest rules.
// Returns { rules: DnrRule[], consumed: number } so the caller can advance ids.
export function toDnrRules(userRule, startId) {
  const patternType = userRule.patternType === "regex" ? "regex" : "wildcard";
  const regexFilter = patternType === "regex"
    ? userRule.pattern
    : wildcardPatternToRegex(userRule.pattern);
  const regexSubstitution = substitutionToDnr(userRule.redirectTo);
  const resourceTypes = sanitizeResourceTypes(userRule.resourceTypes);

  const redirectRule = {
    id: startId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { regexSubstitution }
    },
    condition: {
      regexFilter,
      resourceTypes
    }
  };

  const rules = [redirectRule];

  if (userRule.allowCors) {
    rules.push({
      id: startId + 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: CORS_RESPONSE_HEADERS
      },
      condition: {
        regexFilter,
        resourceTypes
      }
    });
  }

  return { rules, consumed: rules.length };
}

// Build the full set of DNR rules from the user's stored rules, honoring
// the per-rule `enabled` flag. IDs are reassigned sequentially each build.
export function buildAllDnrRules(userRules) {
  const dnrRules = [];
  let nextId = 1;
  for (const userRule of userRules) {
    if (!userRule || userRule.enabled === false) continue;
    if (validateRule(userRule).length > 0) continue;
    const { rules, consumed } = toDnrRules(userRule, nextId);
    dnrRules.push(...rules);
    nextId += consumed;
  }
  return dnrRules;
}

export { wildcardPatternToRegex, substitutionToDnr };
