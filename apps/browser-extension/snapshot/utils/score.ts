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

export function scoreCandidate(intent: QueryIntent, name: string, role: string, interactive: boolean): number {
  const nameTokens = tokenize(name);
  if (nameTokens.length === 0 && intent.roles.size === 0) return 0;

  const namePhrase = nameTokens.join(" ");
  let score = 0;

  if (namePhrase && namePhrase === intent.phrase) score += 12;
  else if (namePhrase && intent.phrase.includes(namePhrase)) score += 6;
  else if (namePhrase && namePhrase.includes(intent.phrase)) score += 5;

  for (const token of intent.tokens) {
    if (nameTokens.includes(token)) score += 3;
    else if (nameTokens.some((nameToken) => nameToken.startsWith(token) || token.startsWith(nameToken))) score += 1;
  }

  if (intent.roles.has(role)) score += 4;
  else if (intent.roles.size > 0) score -= 2;

  if (interactive) score += 1;
  if (nameTokens.length > 0) score += Math.max(0, 2 - Math.floor(nameTokens.length / 6));

  return score;
}
