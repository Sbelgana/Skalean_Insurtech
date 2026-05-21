/**
 * Helper : matche une action requested contre un scope autorise.
 *
 * Pattern : verb.resource[.qualifier] -- e.g. read.sinistre, write.devis, read.sinistre.own.
 * Wildcards :
 *   *.*               super admin full
 *   read.*            read all resources
 *   read.sinistre.*   read all qualifiers de sinistre
 *
 * Reference : Sprint 6 / Tache 2.2.6.
 */

export function matchesScope(scope: readonly string[], action: string): boolean {
  for (const entry of scope) {
    if (matchesSingle(entry, action)) return true;
  }
  return false;
}

function matchesSingle(scopeEntry: string, action: string): boolean {
  if (scopeEntry === action) return true;
  if (scopeEntry === '*.*') return true;

  const scopeParts = scopeEntry.split('.');
  const actionParts = action.split('.');

  // scope must have <= action parts (e.g. "read.*" matches "read.sinistre.own")
  if (scopeParts.length > actionParts.length) return false;

  for (let i = 0; i < scopeParts.length; i++) {
    const sp = scopeParts[i];
    if (sp === '*') continue;
    if (sp !== actionParts[i]) return false;
  }

  // If scope is shorter than action AND last scope part is not wildcard,
  // it should NOT match longer actions (e.g. "read.sinistre" does NOT match "read.sinistre.own")
  if (scopeParts.length < actionParts.length && scopeParts[scopeParts.length - 1] !== '*') {
    return false;
  }

  return true;
}
