# Social Hours Platform - Technical Plan

## 1. Product Scope

This document defines the technical basis for an open-source platform to manage college social hours in El Salvador.

The MVP is a self-hosted platform. Each college installs and operates its own instance. The system is not multi-tenant and does not include tenant isolation, shared tenant databases, or per-tenant row-level security.

The platform stores only social-hours workflow data:

- Projects.
- Applications.
- Assignments.
- Hour logs.
- Evidence.
- Required documents.
- Approvals.
- Rule evaluations.
- Certificates.
- Audit events.

The platform does not own or permanently store institutional authentication data or complete academic/student records. Those are external systems connected through provider adapters.

## 2. Core Architectural Principle

The platform should be designed as:

```text
Self-hosted Core Platform
  + Configurable Modules
  + Odoo-like Integration Module Layer
  + Rules Engine
  + Demo Providers for MVP
```

The core must be stack-neutral. The design can be implemented with different backend, frontend, database, or deployment tools.

## 3. MVP Integration Strategy

Because real colleges may have different authentication systems and different student-data structures, the MVP must prove two things:

1. The platform can connect to external systems.
2. Each college can create or install its own connector modules, similar to the Odoo module model.

The core platform must not contain college-specific auth or student-data logic. Instead, it calls installed integration modules through stable contracts.

The MVP should include:

1. A dummy authentication API.
2. A dummy student-data API.
3. A `dummy-auth-connector` module that connects the core platform to the dummy authentication API.
4. A `dummy-student-data-connector` module that connects the core platform to the dummy student-data API.
5. A module registry inside the core platform.
6. A mapping layer that normalizes external data into the internal platform contract.
7. A module capability endpoint so the UI can show which integrations are installed, enabled, healthy, and connected.

The dummy providers are not production replacements. They exist to demonstrate integration boundaries and allow demos without connecting to real college systems.

## 4. Odoo-Like Module Model

The platform should work like Odoo in the sense that the owner of the instance can add modules that extend the system.

For this MVP, the most important module type is the integration connector module.

The core platform provides:

- Module discovery.
- Module installation metadata.
- Module enable/disable.
- Module configuration.
- Module health checks.
- Stable contracts for auth and student-data operations.
- Event hooks.
- Permission scopes.
- Audit logging.

The college or implementation partner provides:

- A connector module for its auth provider.
- A connector module for its academic/student-data system.
- Optional connector modules for notifications, scraping, workflow automation, or reporting.

The core should not call each college system directly. The core calls the module contract, and the module handles provider-specific API calls, credentials, field names, transformations, and error handling.

## 5. Module Types

Initial module types:

- `auth_connector`
- `student_data_connector`
- `notification_connector`
- `workflow_connector`
- `scraper_connector`
- `document_template`
- `reporting_extension`
- `rules_extension`

For the MVP, only these connector modules are required:

- `dummy-auth-connector`
- `dummy-student-data-connector`

Future production modules may include:

- `oidc-auth-connector`
- `saml-auth-connector`
- `ldap-auth-connector`
- `datamcp-student-data-connector`
- `zavu-notification-connector`
- `n8n-workflow-connector`
- `firecrawl-scraper-connector`

## 6. Module Manifest

Every module should expose a manifest.

Minimum manifest fields:

- `moduleKey`
- `displayName`
- `version`
- `moduleType`
- `description`
- `author`
- `license`
- `platformVersion`
- `capabilities`
- `requiredSecrets`
- `configurationSchema`
- `providedContracts`
- `requiredContracts`
- `permissions`
- `webhookSubscriptions`
- `eventSubscriptions`

Example conceptual manifest:

```yaml
moduleKey: dummy-student-data-connector
displayName: Dummy Student Data Connector
version: 0.1.0
moduleType: student_data_connector
capabilities:
  - student.search
  - student.profile.read
  - student.progress.read
  - student.programs.read
providedContracts:
  - student_data.v1
requiredSecrets:
  - apiBaseUrl
configurationSchema:
  providerProfile:
    type: string
    enum:
      - progress_percentage
      - credits_based
      - subjects_based
```

## 7. Module Runtime Contract

Each enabled module must support:

- `configure`
- `testConnection`
- `getCapabilities`
- `getHealth`

Connector-specific contracts:

### Auth Connector Contract

Required operations:

- `getLoginUrl` or `login`, depending on auth mode.
- `exchangeCredentials`, only for dummy/password-based demo providers.
- `introspectToken`
- `getUserInfo`
- `mapExternalRoles`
- `logout`, when supported by provider.

Normalized auth output:

- `externalUserId`
- `providerKey`
- `displayName`
- `email`
- `roles`
- `externalStudentId`, when user is a student.

### Student Data Connector Contract

Required operations:

- `searchStudents`
- `getStudentProfile`
- `getProgramProgress`
- `getCompletedCourses`
- `getPrograms`
- `getSchema`
- `normalizeStudentData`

Normalized student-data output:

- `studentRef`
- `externalStudentId`
- `displayName`
- `email`
- `facultyCode`
- `facultyName`
- `programCode`
- `programName`
- `degreeLevel`
- `modality`
- `cohort`
- `academicStatus`
- `approvedCredits`
- `totalCredits`
- `approvedSubjects`
- `totalSubjects`
- `progressPercentage`
- `gpa`
- `completedCourseCodes`
- `skills`
- `lastSyncedAt`

## 8. Provider Connection Model

Provider connections still exist, but they are owned by modules.

Example:

```text
Core Platform
  -> dummy-student-data-connector module
    -> provider connection config
      -> dummy student-data API
```

Every external service is represented as a provider connection created through a module.

Provider types:

- `auth`
- `student_data`
- `email`
- `workflow`
- `scraper`

Each connection contains:

- Module key.
- Provider key.
- Provider type.
- Base URL.
- Auth method.
- Enabled status.
- Capabilities.
- Field mappings.
- Last health check.
- Last test result.

Secrets must be stored encrypted and must never be returned by API responses.

Example provider flow:

```text
Core Platform -> Module Registry -> Student Data Connector Module
Connector Module -> External Student Data API
Connector Module -> Normalize response -> Core Platform
Core Platform -> Rules Engine -> Student Profile
```

## 9. MVP Module: Dummy Auth Connector

The `dummy-auth-connector` module is an MVP module installed in the platform.

Its purpose is to prove that the core platform can authenticate through a module instead of owning auth directly.

The module connects to the dummy auth API, which simulates the auth system owned by a college.

Minimum features:

- Login with demo credentials.
- Token issuing.
- Token introspection.
- User info endpoint.
- Role claims.
- Demo users by role.
- Multiple provider profiles to simulate different colleges.

Required roles:

- `student`
- `coordinator`
- `faculty_supervisor`
- `external_supervisor`
- `admin`
- `auditor`

The platform should treat the dummy auth API the same way it would treat a real provider. For production, colleges can replace it with OIDC, OAuth2, SAML, LDAP, or another institutional identity provider.

The core platform should only store a stable external user reference returned by the module, such as:

```text
externalUserId
providerKey
moduleKey
role claims snapshot
lastSeenAt
```

It should not store passwords.

## 10. MVP Module: Dummy Student Data Connector

The `dummy-student-data-connector` module is an MVP module installed in the platform.

Its purpose is to prove that a college can provide a module that adapts its own academic system to the platform's normalized student-data contract.

The module connects to the dummy student-data API, which simulates the college academic system.

Minimum features:

- Search students.
- Fetch student academic profile.
- Fetch program progress.
- Fetch completed courses.
- Fetch program catalog.
- Expose schema metadata.
- Simulate changed student data through webhook events.

The dummy API should support multiple response shapes. This allows the MVP to show that different colleges can have different student-data structures.

Example college profile variants:

- A provider that exposes progress as percentage.
- A provider that exposes progress as approved credits / total credits.
- A provider that exposes progress as approved subjects / total subjects.
- A provider that exposes status as `active`, `egresado`, or `graduate_candidate`.
- A provider that uses faculty/career codes instead of names.

The platform normalizes these differences into an internal academic profile contract.

The dummy connector must support configurable provider profiles, for example:

- `progress_percentage`
- `credits_based`
- `subjects_based`
- `status_code_based`

These profiles allow the MVP demo to show multiple college data shapes without building multiple real integrations.

## 11. Normalized Academic Profile Contract

The platform should not depend directly on each college's raw structure. It should convert provider responses into a normalized profile.

Normalized fields:

- `studentRef`
- `externalStudentId`
- `displayName`
- `email`
- `facultyCode`
- `facultyName`
- `programCode`
- `programName`
- `degreeLevel`
- `modality`
- `cohort`
- `academicStatus`
- `approvedCredits`
- `totalCredits`
- `approvedSubjects`
- `totalSubjects`
- `progressPercentage`
- `gpa`
- `completedCourseCodes`
- `skills`
- `lastSyncedAt`

Storage rule:

The platform may cache this profile for a short period for user experience, but the academic provider remains the source of truth.

## 12. Mapping Layer

Each student-data provider connection should define mappings from external fields to normalized fields.

Mapping examples:

```yaml
progressPercentage: "$.academic.progress"
programCode: "$.career.code"
programName: "$.career.name"
academicStatus: "$.status"
completedCourseCodes: "$.courses.completed[*].code"
```

The mapping layer should support:

- Field mapping.
- Value transformation.
- Enum normalization.
- Default values.
- Required fields.
- Validation errors.

If the provider cannot supply a required field, the profile should be marked as incomplete and the rules engine should return a blocked or manual-review result.

## 13. Rules Engine

The Salvadoran social-hours context requires a configurable rules engine because requirements vary by university, faculty, career, degree level, and modality.

The rules engine should support:

- Required total hours.
- Required category hours, such as environmental hours.
- Minimum academic progress.
- Required academic status.
- Required courses.
- Calendar duration requirements.
- Career-specific exceptions.
- Faculty-specific exceptions.
- Manual override with audit trail.

Rule evaluation output:

- `eligible`
- `not_eligible`
- `manual_review`
- `missing_data`

The output should include:

- Matched rules.
- Failed rules.
- Missing data.
- Required total hours.
- Required category hours.
- Human-readable explanation.

## 14. Student Profiling

The student profile is generated by combining:

- External auth identity.
- External academic data.
- Local social-hours history.
- Project eligibility rules.

The profiling module should produce:

- Eligibility status.
- Required social hours.
- Completed social hours.
- Remaining social hours.
- Required document checklist.
- Recommended project categories.
- Matching projects.
- Missing academic prerequisites.
- Manual-review flags.

The platform should avoid storing complete academic records. It may store the result of rule evaluations and local project progress.

## 15. Project Sources

The platform has two project sources:

1. College-created projects.
2. Scraped/imported projects.

College-created projects are created by authorized staff.

Scraped projects are imported through Firecrawl or another scraper provider. Scraped projects must pass through review before publication.

Imported project metadata:

- Source URL.
- Source provider.
- Extraction confidence.
- Organization name.
- Title.
- Description.
- Location.
- Modality.
- Deadline.
- Contact information.
- Detected categories.
- Duplicate candidates.

No scraped project should become publicly available until a coordinator approves it.

## 16. Project Lifecycle

Recommended lifecycle:

```text
draft -> pending_review -> published -> accepting_applications -> in_execution -> closed -> archived
```

Alternative states:

- `rejected`
- `cancelled`
- `suspended`

## 17. Required Documents

Document requirements must be configurable per instance, project type, program, and rule set.

Default document types:

- Student request form.
- Work plan.
- Project acceptance letter.
- External organization agreement.
- Supervisor assignment confirmation.
- Periodic progress report.
- Attendance sheet.
- Evidence files.
- Supervisor evaluation.
- Final report.
- Completion letter.
- Generated certificate.

Document fields:

- Type.
- Required/optional.
- Applies to project type.
- Applies to program or faculty.
- Allowed file types.
- Maximum file size.
- Requires approval.
- Requires expiration date.
- Template ID, when generated by the system.

## 18. Hour Tracking

Hour logs should support:

- Date.
- Start time.
- End time.
- Duration.
- Category.
- Description.
- Evidence attachments.
- Supervisor approval.
- Rejection reason.

Categories should be configurable:

- `disciplinary`
- `environmental`
- `community`
- `research`
- `administrative`
- `other`

## 19. External APIs

### 19.1 ZAVU Email Notifications

Used for email delivery.

Notification events:

- Application submitted.
- Application approved.
- Application rejected.
- Missing document.
- Document approved.
- Document rejected.
- Hours approved.
- Hours rejected.
- Project deadline approaching.
- Final report required.
- Certificate generated.

### 19.2 DataMCP Student Data

Used as one possible student-data provider.

The platform should treat DataMCP as a connector module implementation, not as a hard dependency. A college can replace it with another student-data connector module if needed.

### 19.3 n8n Workflow

Used for workflow automation.

Initial workflow:

- When a public project is approved, send a webhook to n8n.
- n8n can post to LinkedIn or other external channels.

The webhook payload should only include public-safe project fields.

### 19.4 Firecrawl Scraper

Used to discover external project opportunities.

The platform should store imported results as drafts or pending-review projects.

## 20. Main Platform Modules

MVP modules:

- Instance settings.
- Module registry.
- Provider connections owned by modules.
- Dummy auth connector module.
- Dummy student-data connector module.
- External auth integration.
- External student-data integration.
- Rules engine.
- Student profile.
- Project catalog.
- Firecrawl imports.
- Applications.
- Assignments.
- Hour logs.
- Evidence.
- Documents.
- Notifications.
- Reports.
- Audit log.

Future modules:

- Production auth connectors.
- Production student-data connectors.
- Advanced document templates.
- Digital signatures.
- Organization portal.
- Supervisor mobile interface.
- Advanced analytics.
- Public project marketplace.
- Certificate verification portal.

## 21. Main API Groups

Platform API groups:

- Health and capabilities.
- Modules.
- Provider connections.
- Current user.
- Student profile.
- Rules.
- Projects.
- Firecrawl imports.
- Applications.
- Assignments.
- Hour logs.
- Documents.
- Certificates.
- Reports.
- Audit log.
- Webhooks.

Dummy provider API groups:

- Demo auth.
- Demo student data.

## 22. Key Domain Entities

### InstanceSettings

Represents configuration for one college deployment.

### ModuleManifest

Represents metadata, contracts, permissions, configuration schema, and capabilities for an installable module.

### InstalledModule

Represents a module installed in the local platform instance.

### ModuleConfig

Represents non-secret and secret configuration values for an enabled module.

### ProviderConnection

Represents an external service connection owned by an installed module.

### ExternalUserRef

Represents a user from an external auth provider.

### StudentRef

Represents a stable reference to a student known through an external student-data provider.

### RequirementRule

Represents one eligibility or completion rule.

### RequirementEvaluation

Stores the result of a rule evaluation for auditability.

### Project

Represents a social-hours project.

### ProjectApplication

Represents a student's request to join a project.

### Assignment

Represents an approved student-project-supervisor relationship.

### HourLog

Represents reported hours.

### Evidence

Represents proof attached to hour logs or project milestones.

### DocumentRequirement

Defines which files are required.

### DocumentUpload

Represents an uploaded file and its approval state.

### Certificate

Represents a generated completion document.

### AuditLog

Immutable record of sensitive actions.

## 23. Security and Privacy

Requirements:

- No local password storage for institutional users.
- No permanent storage of full academic records.
- Modules must request explicit permissions.
- Modules must not access data outside their declared contract and scopes.
- Encrypt provider secrets.
- Use signed webhooks.
- Use role-based access control.
- Use audit logs for approvals and overrides.
- Limit scraped project publication through manual approval.
- Support data export and deletion policies.
- Separate public project fields from internal project fields.

## 24. MVP Success Criteria

The MVP is successful if it can demonstrate:

1. A college instance can configure provider connections.
2. A college instance can install or enable integration modules.
3. The platform can authenticate users through the `dummy-auth-connector` module.
4. The platform can fetch student data through the `dummy-student-data-connector` module.
5. Different student-data structures can be normalized through mappings inside the connector module.
6. The dummy modules can be replaced by college-created modules without changing the core domain workflow.
7. The rules engine can evaluate eligibility.
8. Students can view available projects.
9. Students can apply to projects.
10. Coordinators can approve applications.
11. Students can upload evidence and log hours.
12. Supervisors can approve hours.
13. Required documents can be configured and approved.
14. Firecrawl imports can create reviewable project drafts.
15. ZAVU and n8n can be represented as connector modules or provider connections owned by modules.
16. Reports and audit logs expose the state of the process.
