import type { PlatformModuleDescriptor } from '../module/PlatformModule';
import applications from '../../modules/applications';
import assignments from '../../modules/assignments';
import certificates from '../../modules/certificates';
import documents from '../../modules/documents';
import dummyAuthConnector from '../../modules/dummy-auth-connector';
import dummyStudentDataConnector from '../../modules/dummy-student-data-connector';
import hours from '../../modules/hours';
import imports from '../../modules/imports';
import jobSearch from '../../modules/job-search';
import notifications from '../../modules/notifications';
import projects from '../../modules/projects';
import reports from '../../modules/reports';
import rules from '../../modules/rules';
import studentProfile from '../../modules/student-profile';

/**
 * Built-in modules registered at compile time so serverless bundles (Netlify/esbuild)
 * include every descriptor and its dependency graph.
 */
export const BUILTIN_MODULE_DESCRIPTORS: PlatformModuleDescriptor[] = [
  applications,
  assignments,
  certificates,
  documents,
  dummyAuthConnector,
  dummyStudentDataConnector,
  hours,
  imports,
  jobSearch,
  notifications,
  projects,
  reports,
  rules,
  studentProfile,
].sort((a, b) => a.moduleKey.localeCompare(b.moduleKey));

export const BUILTIN_MODULE_KEYS = BUILTIN_MODULE_DESCRIPTORS.map((d) => d.moduleKey);
