export interface CaptureRule {
  id: string;
  /** e.g. "localhost:5173", "localhost:*", "*.example.com" */
  pattern: string;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesRule(url: string, rule: CaptureRule): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const [hostPattern, portPattern] = rule.pattern.split(":");
  if (!globToRegExp(hostPattern).test(parsed.hostname)) return false;

  if (portPattern && portPattern !== "*") {
    const actualPort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    if (actualPort !== portPattern) return false;
  }

  return true;
}

export function findMatchingRule(url: string, rules: CaptureRule[]): CaptureRule | undefined {
  return rules.find((rule) => matchesRule(url, rule));
}

/** Host permissions can't filter by port, so a rule's port is dropped when deriving the
 * match pattern to request/check — matchesRule() still enforces the port at runtime. */
export function ruleToOrigin(pattern: string): string {
  const [hostPattern] = pattern.split(":");
  return `*://${hostPattern}/*`;
}

const RULES_KEY = "captureRules";

export async function getRules(): Promise<CaptureRule[]> {
  const result = await chrome.storage.sync.get(RULES_KEY);
  return result[RULES_KEY] ?? [];
}

export async function setRules(rules: CaptureRule[]): Promise<void> {
  await chrome.storage.sync.set({ [RULES_KEY]: rules });
}
