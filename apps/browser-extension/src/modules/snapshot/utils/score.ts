import { FIND_ROLE_SYNONYMS, FIND_STOP_WORDS } from "../data.js";

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !FIND_STOP_WORDS.has(token));
}

function rolesMatching(tokens: string[]): Set<string> {
  const roles = new Set<string>();
  for (const [role, synonyms] of Object.entries(FIND_ROLE_SYNONYMS)) {
    if (synonyms.some((synonym) => tokens.includes(synonym))) roles.add(role);
  }
  return roles;
}

export interface QueryIntent {
  tokens: string[];
  phrase: string;
  roles: Set<string>;
}

export function parseQuery(query: string): QueryIntent {
  const tokens = tokenize(query);
  return { tokens, phrase: tokens.join(" "), roles: rolesMatching(tokens) };
}

function containsRun(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  return haystack.some((_, start) => needle.every((token, offset) => haystack[start + offset] === token));
}

function nameScoreFor(intent: QueryIntent, nameTokens: string[]): number {
  if (nameTokens.length === 0) return 0;

  const sameLength = nameTokens.length === intent.tokens.length;
  if (sameLength && containsRun(nameTokens, intent.tokens)) return 12;
  if (containsRun(intent.tokens, nameTokens) || containsRun(nameTokens, intent.tokens)) return 6;

  let score = 0;
  for (const token of intent.tokens) {
    if (nameTokens.includes(token)) score += 3;
    else if (nameTokens.some((nameToken) => nameToken.startsWith(token) || token.startsWith(nameToken))) score += 1;
  }
  return score;
}

export function scoreCandidate(intent: QueryIntent, name: string, role: string, interactive: boolean): number {
  const nameTokens = tokenize(name);
  const nameScore = nameScoreFor(intent, nameTokens);
  const roleMatch = intent.roles.has(role);
  if (nameScore === 0 && !roleMatch) return 0;

  let score = nameScore;
  if (roleMatch) score += 4;
  else if (intent.roles.size > 0) score -= 2;

  if (interactive) score += 1;
  if (nameScore >= 3) score += Math.max(0, 2 - Math.floor(nameTokens.length / 6));

  return score;
}
