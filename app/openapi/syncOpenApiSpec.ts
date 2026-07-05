import listEndpoints from 'express-list-endpoints';
import { Express } from 'express';
import { parseDocument, YAMLMap } from 'yaml';
import { STUDENT_ALLOWED_ROUTES } from '../rbac/studentAllowedRoutes';
import { createAppForSpec } from './createAppForSpec';

const IGNORED_PATHS = new Set(['/', '/docs', '/docs/', '/api/v1']);

const PATH_TAG_RULES: Array<{ prefix: string; tag: string }> = [
  { prefix: '/health', tag: 'Health' },
  { prefix: '/api/v1/capabilities', tag: 'Health' },
  { prefix: '/api/v1/modules', tag: 'Modules' },
  { prefix: '/api/v1/provider-connections', tag: 'Provider Connections' },
  { prefix: '/api/v1/auth', tag: 'Auth' },
  { prefix: '/api/v1/me', tag: 'Current User' },
  { prefix: '/api/v1/student-data', tag: 'Student Data' },
  { prefix: '/api/v1/student-profile', tag: 'Student Profile' },
  { prefix: '/api/v1/rules', tag: 'Rules' },
  { prefix: '/api/v1/projects', tag: 'Projects' },
  { prefix: '/api/v1/imports', tag: 'Imports' },
  { prefix: '/api/v1/applications', tag: 'Applications' },
  { prefix: '/api/v1/assignments', tag: 'Assignments' },
  { prefix: '/api/v1/hour-logs', tag: 'Hour Logs' },
  { prefix: '/api/v1/documents', tag: 'Documents' },
  { prefix: '/api/v1/certificates', tag: 'Certificates' },
  { prefix: '/api/v1/reports', tag: 'Reports' },
  { prefix: '/api/v1/audit-log', tag: 'Audit' },
  { prefix: '/api/v1/webhooks', tag: 'Webhooks' },
  { prefix: '/api/v1/config', tag: 'Modules' },
  { prefix: '/api/v1/admin-users', tag: 'Modules' },
  { prefix: '/dummy-auth', tag: 'Demo Auth Provider' },
  { prefix: '/dummy-student-data', tag: 'Demo Student Data Provider' },
];

export interface DiscoveredRoute {
  method: string;
  path: string;
}

function expressPathToOpenApi(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function inferTag(path: string): string {
  const normalized = path.replace(/\/$/, '') || '/';
  const match = PATH_TAG_RULES.find((rule) => normalized.startsWith(rule.prefix));
  return match?.tag ?? 'Health';
}

function toOperationId(method: string, path: string): string {
  const parts = path
    .replace(/^\//, '')
    .replace(/[{}]/g, '')
    .split('/')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  return `${method.toLowerCase()}${parts.join('')}`;
}

function patternToOpenApiPaths(pattern: RegExp): string[] {
  let source = pattern.source.replace(/^\^/, '').replace(/\$$/, '').replace(/\\\//g, '/');

  const altMatch = source.match(/\(([^)]+)\)/);
  if (altMatch?.[1].includes('|')) {
    const alternatives = altMatch[1].split('|');
    const base = source.replace(/\([^)]+\)/, '__ALT__');
    return alternatives.map((alt) => finalizeOpenApiPath(base.replace('__ALT__', alt)));
  }

  return [finalizeOpenApiPath(source)];
}

function finalizeOpenApiPath(path: string): string {
  return path
    .replace(/\[\^\/\]\+/g, '{id}')
    .replace(/\/?$/, '')
    .replace(/\/$/, '') || '/';
}

function buildStudentRbacDescription(): string {
  const intro = [
    'Stack-neutral MVP API contract for a self-hosted social-hours platform.',
    'The contract includes core platform endpoints, Odoo-like module',
    'management endpoints, and dummy auth/student-data provider endpoints',
    'used to demonstrate integration with multiple college-owned systems.',
    '',
    '## Student RBAC (whitelist)',
    '',
    'Users with only the `student` role may access a fixed allowlist of endpoints.',
    'All other `/api/v1/*` routes return 403. Staff roles (`admin`, `coordinator`,',
    '`faculty_supervisor`, `external_supervisor`, `auditor`) bypass the whitelist.',
    '',
    '| Method | Path | Student |',
    '|--------|------|---------|',
  ];

  const rowsByMethod = new Map<string, Set<string>>();
  for (const route of STUDENT_ALLOWED_ROUTES) {
    const paths = patternToOpenApiPaths(route.pattern);
    if (!rowsByMethod.has(route.method)) {
      rowsByMethod.set(route.method, new Set());
    }
    const bucket = rowsByMethod.get(route.method)!;
    for (const path of paths) {
      bucket.add(path);
    }
  }

  const methodOrder = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
  for (const method of methodOrder) {
    const paths = rowsByMethod.get(method);
    if (!paths || paths.size === 0) continue;
    const joined = Array.from(paths).sort().join(', ');
    const note = method === 'GET' && joined.includes('/api/v1/projects')
      ? 'yes (published only)'
      : 'yes';
    intro.push(`| ${method} | ${joined} | ${note} |`);
  }

  return `${intro.join('\n')}\n`;
}

function createStubOperation(method: string, path: string): Record<string, unknown> {
  const operation: Record<string, unknown> = {
    tags: [inferTag(path)],
    summary: `Auto-generated from Express route (${method} ${path})`,
    operationId: toOperationId(method, path),
    responses: {
      '200': { description: 'Success' },
    },
  };

  if (path.startsWith('/api/v1/auth/login') || path.startsWith('/api/v1/auth/introspect')) {
    operation.security = [];
  }

  return operation;
}

export function collectRoutes(app: Express = createAppForSpec()): DiscoveredRoute[] {
  const endpoints = listEndpoints(app);
  const routes: DiscoveredRoute[] = [];

  for (const endpoint of endpoints) {
    const openApiPath = expressPathToOpenApi(endpoint.path);
    if (IGNORED_PATHS.has(endpoint.path) || IGNORED_PATHS.has(openApiPath)) continue;

    for (const method of endpoint.methods) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      routes.push({ method: method.toUpperCase(), path: openApiPath });
    }
  }

  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function syncOpenApiSpec(existingYaml: string, routes: DiscoveredRoute[]): string {
  const doc = parseDocument(existingYaml);
  doc.setIn(['info', 'description'], buildStudentRbacDescription());

  let pathsNode = doc.get('paths');
  if (!(pathsNode instanceof YAMLMap)) {
    pathsNode = new YAMLMap();
    doc.set('paths', pathsNode);
  }

  const paths = pathsNode as YAMLMap;

  for (const route of routes) {
    const method = route.method.toLowerCase();
    let pathNode = paths.get(route.path);
    if (!(pathNode instanceof YAMLMap)) {
      pathNode = new YAMLMap();
      paths.set(route.path, pathNode);
    }
    const pathItem = pathNode as YAMLMap;
    if (!pathItem.has(method)) {
      pathItem.set(method, createStubOperation(route.method, route.path));
    }
  }

  return String(doc);
}
