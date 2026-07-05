export interface AllowedRoute {
  method: string;
  pattern: RegExp;
}

/** Source of truth for student-only whitelist (tests + OpenAPI). */
export const STUDENT_ALLOWED_ROUTES: AllowedRoute[] = [
  { method: 'POST', pattern: /^\/api\/v1\/auth\/(login|introspect)$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/?$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/profile$/ },
  { method: 'POST', pattern: /^\/api\/v1\/me\/profile\/refresh$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/applications$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/assignments$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/hour-logs$/ },
  { method: 'POST', pattern: /^\/api\/v1\/me\/hour-logs$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/document-requirements$/ },
  { method: 'POST', pattern: /^\/api\/v1\/me\/document-requirements\/[^/]+\/upload$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/document-uploads$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/notifications$/ },
  { method: 'PATCH', pattern: /^\/api\/v1\/me\/notifications\/[^/]+\/read$/ },
  { method: 'POST', pattern: /^\/api\/v1\/me\/evidence$/ },
  { method: 'GET', pattern: /^\/api\/v1\/me\/social-services\/history$/ },
  { method: 'GET', pattern: /^\/api\/v1\/projects\/?$/ },
  { method: 'GET', pattern: /^\/api\/v1\/projects\/[^/]+$/ },
  { method: 'POST', pattern: /^\/api\/v1\/projects\/[^/]+\/applications\/?$/ },
];

export function isStudentRouteAllowed(method: string, path: string): boolean {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';
  return STUDENT_ALLOWED_ROUTES.some(
    (route) => route.method === method.toUpperCase() && route.pattern.test(normalized),
  );
}
