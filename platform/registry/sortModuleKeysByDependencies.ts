/**
 * Topological sort so dependencies are installed before dependents.
 */
export function sortModuleKeysByDependencies(
  moduleKeys: string[],
  resolveDependencies: (moduleKey: string) => string[],
): string[] {
  const keySet = new Set(moduleKeys);
  const sorted: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (moduleKey: string) => {
    if (visited.has(moduleKey)) return;
    if (visiting.has(moduleKey)) {
      throw new Error(`Circular module dependency detected at ${moduleKey}`);
    }

    visiting.add(moduleKey);
    for (const dep of resolveDependencies(moduleKey)) {
      if (keySet.has(dep)) visit(dep);
    }
    visiting.delete(moduleKey);
    visited.add(moduleKey);
    sorted.push(moduleKey);
  };

  for (const moduleKey of moduleKeys) {
    visit(moduleKey);
  }

  return sorted;
}
