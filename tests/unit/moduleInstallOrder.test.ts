import { describe, expect, it } from 'vitest';
import { sortModuleKeysByDependencies } from '../../platform/registry/sortModuleKeysByDependencies';

describe('sortModuleKeysByDependencies', () => {
  const deps: Record<string, string[]> = {
    projects: [],
    assignments: ['projects'],
    applications: ['projects', 'assignments'],
    hours: ['assignments'],
    rules: [],
  };

  it('installs dependencies before dependents', () => {
    const input = ['applications', 'assignments', 'projects', 'hours', 'rules'];
    const sorted = sortModuleKeysByDependencies(input, (key) => deps[key] ?? []);

    expect(sorted.indexOf('projects')).toBeLessThan(sorted.indexOf('assignments'));
    expect(sorted.indexOf('assignments')).toBeLessThan(sorted.indexOf('applications'));
    expect(sorted.indexOf('assignments')).toBeLessThan(sorted.indexOf('hours'));
  });

  it('orders modules by required service providers', () => {
    const deps: Record<string, string[]> = {
      notifications: [],
      documents: ['notifications'],
      rules: [],
      hours: ['assignments', 'notifications'],
      assignments: ['projects'],
      projects: [],
    };

    const sorted = sortModuleKeysByDependencies(
      ['documents', 'notifications', 'hours', 'assignments', 'projects', 'rules'],
      (key) => deps[key] ?? [],
    );

    expect(sorted.indexOf('notifications')).toBeLessThan(sorted.indexOf('documents'));
    expect(sorted.indexOf('notifications')).toBeLessThan(sorted.indexOf('hours'));
    expect(sorted.indexOf('projects')).toBeLessThan(sorted.indexOf('assignments'));
  });

  it('detects circular dependencies', () => {
    expect(() =>
      sortModuleKeysByDependencies(['a', 'b'], (key) => (key === 'a' ? ['b'] : ['a'])),
    ).toThrow('Circular module dependency detected');
  });
});
