APEX — Project Context & Technical Vision

APEX — Autonomous Platform for Engineering eXcellence
An AI-powered IT operations and incident response companion.

Project status: Early development / Prototype
Primary platforms: Windows and Linux
AI provider: Google Gemini
Development approach: Cross-platform, modular, security-first

1. What is APEX?

APEX is an AI-powered IT operations companion designed to help developers and IT operations teams monitor systems, detect incidents, investigate failures, understand root causes, and respond to problems through a unified interface.

Modern software systems generate enormous amounts of logs, metrics, traces, and alerts. When something breaks, engineers often have to switch between terminals, monitoring dashboards, cloud provider consoles, log management platforms, and documentation just to understand what happened.

APEX aims to simplify this process.

It brings system monitoring, application monitoring, incident detection, AI-assisted investigation, and incident response into one intelligent platform.

At the center of the experience is NOVA, APEX's AI desktop companion.

NOVA acts as the interface between the user and the APEX intelligence layer. It can communicate incidents, explain system behavior, answer operational questions, and help users investigate problems without requiring them to navigate multiple tools.

APEX is not intended to be just another chatbot with access to terminal commands. It is designed to be a structured, evidence-driven IT operations platform where deterministic monitoring and incident detection work alongside AI-powered reasoning.

2. The Problem We Are Solving

Software failures rarely happen in isolation.

For example:

A database becomes unavailable.

The backend starts experiencing connection failures.

API requests begin timing out.

Payment requests fail.

Users experience service disruption.

A conventional monitoring setup might generate separate alerts for each failure.

An engineer then has to investigate multiple logs, correlate timestamps, identify dependencies, determine the actual root cause, assess the severity, and decide what to do next.

This process can be time-consuming, especially when multiple services are involved.

APEX aims to automate much of this investigation.

Instead of simply reporting that an API has failed, APEX should be able to explain:

What happened?

When did it happen?

Which services were affected?

What evidence supports the diagnosis?

What is the most likely root cause?

What other explanations are possible?

How severe is the incident?

What should the engineer do next?

The goal is to move from monitoring individual failures to understanding the overall incident.

3. Core Vision

APEX has four major capabilities.

3.1 Intelligent Incident Detection

APEX collects and analyzes operational data from local systems, applications, and connected cloud services.

It should be able to:

Ingest TXT, JSON, and CSV log files.

Monitor selected application log files.

Capture output from explicitly launched processes.

Monitor system resources such as CPU, RAM, disk, and network.

Read supported operating-system logs.

Collect container logs from Docker.

Receive telemetry from external applications and services.

Identify errors, anomalies, and recurring failure patterns.

Correlate events across multiple services.

3.2 AI-Powered Investigation

APEX uses Google Gemini to assist with incident investigation.

The AI layer should:

Interpret detected incidents.

Explain technical errors in understandable language.

Identify possible root causes.

Connect related failures.

Retrieve relevant troubleshooting knowledge.

Suggest remediation steps.

Generate structured incident summaries and reports.

Explain why a particular diagnosis was reached.

AI must not replace the deterministic incident engine.

The incident engine is responsible for structured detection, classification, correlation, and severity assessment. Gemini assists with reasoning, explanations, and recommendations.

3.3 Intelligent Incident Response

APEX should eventually move beyond identifying problems and help resolve them.

It should:

Recommend appropriate remediation steps.

Present an explanation of the proposed action.

Show potential risks and expected outcomes.

Request human approval before performing sensitive actions.

Execute approved, predefined remediation playbooks.

Verify whether the issue has been resolved.

Record the actions taken.

The system must never execute arbitrary AI-generated shell commands by default.

3.4 Unified Desktop and Mobile Experience

APEX is designed as a cross-platform companion rather than a conventional web dashboard.

The desktop application provides the primary monitoring and investigation experience.

The mobile application provides remote visibility and control.

Users should be able to:

Receive incident notifications.

View current system and application health.

Inspect active incidents.

Read AI-generated explanations.

Approve or reject supported remediation actions.

Communicate with NOVA.

Monitor connected devices and services remotely.

4. NOVA — The AI Desktop Companion

NOVA is the conversational and interactive assistant built into APEX.

It is not a separate product. It is the primary user-facing AI companion of the APEX ecosystem.

NOVA should eventually support:

A floating desktop interface.

Natural-language interaction.

Context-aware conversations about monitored systems.

Incident notifications.

AI-generated explanations.

Quick access to monitoring information.

Incident investigation workflows.

User-approved remediation.

Communication with the mobile application.

NOVA should feel like an intelligent operational assistant rather than a traditional chatbot.

Its responses must be grounded in actual system data and incident evidence whenever discussing monitored environments.

5. Target Users

APEX initially targets two primary groups.

IT Operations Teams

System administrators.

DevOps engineers.

Site reliability engineers.

Infrastructure engineers.

IT support teams.

Software Developers

Backend developers.

Full-stack developers.

Independent developers.

Small development teams.

Developers managing multiple applications and services.

APEX should eventually support two operating modes:

Operations Mode: Infrastructure health, service availability, incident management, cloud monitoring, and operational response.

Developer Mode: Local development environments, application logs, process monitoring, API failures, database connectivity, and debugging assistance.

6. Supported Platforms and Architecture

APEX is designed to support Windows and Linux from the beginning.

The initial development and testing environment is Linux. Windows compatibility must be maintained in the architecture even when a particular feature is initially implemented or tested on Linux.

Technology Stack

Component

Technology

Desktop application

Electron

Desktop UI

React, TypeScript, Vite

Backend

Node.js, TypeScript, Express

Mobile application

React, TypeScript, Vite, PWA

Real-time communication

WebSocket

Validation and shared schemas

Zod

AI integration

Google Gemini via @google/genai

Database

PostgreSQL

Local persistence/cache

SQLite where appropriate

Package management

pnpm

Future telemetry standard

OpenTelemetry

Technology choices can evolve, but changes should be deliberate and documented.

Proposed Monorepo Structure

APEX/
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   └── src/
│   ├── server/
│   │   └── src/
│   └── mobile/
│       └── src/
│
├── packages/
│   ├── shared/
│   └── incident-core/
│
├── knowledge-base/
│
├── demo/
│
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── PROJECT_CONTEXT.md

The exact structure may evolve as the project grows.

New packages should be introduced when they provide meaningful separation of responsibilities, not simply to make the repository look more complex.

7. System Architecture

APEX follows a modular architecture.

Its major layers are:

A. Data Collection Layer

Responsible for collecting information from monitored environments.

Potential sources include:

Application log files.

Process output.

Linux journald.

Windows Event Logs.

CPU, memory, disk, and network metrics.

Docker containers.

Cloud provider APIs.

External telemetry endpoints.

OpenTelemetry collectors and instrumentation.

Collectors should be modular and platform-aware.

A collector must only access resources that the user has explicitly authorized.

B. Normalization Layer

Different sources produce different types of operational data.

APEX should normalize incoming data into a common internal event format.

A normalized event may contain:

Timestamp.

Source.

Service name.

Severity.

Event type.

Message.

Metadata.

Correlation identifiers.

Relevant resource information.

This allows the incident engine to work independently of the original data source.

C. Incident Core

The incident core is one of the most important components of APEX.

It must remain independent of Electron, Express, and Gemini.

Its responsibilities include:

Parsing operational events.

Classifying errors.

Identifying recurring patterns.

Correlating related events.

Grouping events into incidents.

Determining affected services.

Assigning severity.

Producing structured incident evidence.

Severity should use a consistent model:

Low: Minor issue with limited impact.

Medium: Degraded functionality or limited service impact.

High: Significant service disruption.

Critical: Major outage or severe availability impact.

Severity should be based on actual impact and available evidence, not simply the wording of an error message.

D. AI Orchestration Layer

The AI orchestration layer connects the incident engine with Gemini.

It should:

Receive structured incident data.

Retrieve relevant knowledge-base information.

Construct evidence-based investigation prompts.

Request AI analysis.

Validate the returned structure.

Produce investigation summaries and recommendations.

Gemini must never be called directly from the desktop renderer or mobile application.

All Gemini requests must pass through the backend.

E. Knowledge Base

APEX should maintain a collection of troubleshooting information and remediation procedures.

The knowledge base may include:

Common error patterns.

Database connectivity issues.

Network failures.

Application startup failures.

Docker troubleshooting.

Infrastructure troubleshooting.

Known incident patterns.

Safe remediation procedures.

Recommendations should be grounded in relevant knowledge-base entries whenever possible.

F. Incident Response Layer

This layer handles proposed and approved remediation actions.

It should support predefined playbooks with:

Action descriptions.

Preconditions.

Required permissions.

Risk levels.

Approval requirements.

Execution status.

Verification procedures.

The AI may recommend an action, but execution must follow explicit authorization and predefined safety rules.

G. Presentation and Communication Layer

This layer connects the desktop application, NOVA, and mobile application with the backend.

WebSocket provides real-time communication for:

Incident updates.

System health information.

Notifications.

Investigation status.

Approval requests.

Remote control operations.

8. Local Monitoring and Cloud Monitoring

APEX must support both local and remote environments.

Local Monitoring

The desktop application can monitor:

The local operating system.

Selected project directories.

Running processes.

Application output.

Local containers.

System resources.

Supported system logs.

Local monitoring should operate only while the desktop agent is running.

Users must explicitly select projects and grant the permissions required for monitoring.

For example, selecting a project directory does not automatically authorize unrestricted access to every file or secret inside it.

Cloud Monitoring

APEX should also connect to externally hosted services.

Potential integrations include:

Render.

Vercel.

Supabase.

Neon.

AWS.

MongoDB Atlas.

Sentry.

PostgreSQL services.

Other infrastructure and application providers.

These integrations should use authorized APIs and appropriate read-only permissions wherever possible.

Cloud monitoring must continue independently of the desktop application.

For example, if a user's laptop is switched off, the APEX backend should still be able to receive and process telemetry from connected cloud services.

Custom Telemetry

APEX should not depend entirely on predefined integrations.

External applications should eventually be able to send telemetry through:

APEX SDKs.

Authenticated HTTP endpoints.

OpenTelemetry.

Custom telemetry integrations.

The long-term objective is to make APEX source-agnostic.

9. Mobile Application and Device Pairing

The mobile application provides remote access to the APEX environment.

The intended pairing workflow is:

The desktop application generates a short-lived QR pairing token.

The user scans the QR code using the mobile application.

The user confirms the pairing.

The devices establish an authenticated connection.

The mobile application receives authorized updates and actions.

The user can revoke the paired device at any time.

Pairing must not expose the desktop machine through an unrestricted inbound network port.

Use authenticated communication or a secure relay architecture.

Mobile push notifications will require a proper push-notification service when the application is closed. Initial prototypes may use in-app notifications while connected.

10. Security Principles

Security is a core architectural requirement, not a feature to add later.

Every contributor must follow these principles.

API Key Protection

Gemini API keys must remain on the backend.

Never expose API keys to React renderers or mobile clients.

Never commit .env files containing secrets.

Provide .env.example with placeholder values.

Permission Management

Use least-privilege access.

Make monitoring permissions configurable.

Avoid requiring root or administrator access for ordinary monitoring.

Request elevated permissions only when genuinely necessary.

Command Execution

Never allow unrestricted shell execution by default.

Do not execute arbitrary AI-generated commands.

Use predefined, allowlisted diagnostic operations.

Require explicit human approval for sensitive actions.

Record executed actions.

Data Privacy

Redact credentials, tokens, and secrets from logs.

Send only relevant information to external AI services.

Do not upload entire project directories by default.

Make telemetry collection transparent and configurable.

Untrusted Input

Logs, application output, and external telemetry must be treated as untrusted data.

Instructions appearing inside logs must never be treated as system instructions for the AI agent.

Mobile Security

Use short-lived, one-time pairing tokens.

Authenticate connected devices.

Support device revocation.

Protect WebSocket connections.

Validate every remote action.

11. Incident Investigation Workflow

The intended incident lifecycle is:

Data Sources
     |
     v
Collectors
     |
     v
Normalization
     |
     v
Incident Core
     |
     v
Detection and Correlation
     |
     v
Severity Assessment
     |
     v
AI Investigation
     |
     v
Knowledge Base Retrieval
     |
     v
Remediation Recommendation
     |
     v
Human Approval
     |
     v
Approved Playbook Execution
     |
     v
Verification
     |
     v
Incident Report

The AI investigation should distinguish between:

Confirmed observations.

Probable root causes.

Alternative explanations.

Missing information.

Recommended next diagnostic steps.

APEX must never present an unverified hypothesis as a confirmed root cause.

12. Hackathon MVP — What We Must Build First

The original hackathon problem statement focuses on an autonomous IT incident response agent.

Therefore, the first priority is to deliver a working incident investigation pipeline.

The broader desktop and mobile vision should support this core functionality, not distract from it.

MVP Requirements

1. Log Ingestion

Upload TXT, JSON, and CSV logs.

Parse timestamps, services, errors, and relevant metadata.

Accept incident descriptions.

2. Incident Detection

Classify errors.

Detect repeated failures.

Correlate events across services.

Identify affected components.

Assign severity.

3. AI Investigation

Use Gemini to investigate structured incident evidence.

Identify probable root causes.

Explain the reasoning.

Suggest relevant troubleshooting procedures.

4. Knowledge Base

Retrieve relevant troubleshooting information.

Provide actionable remediation recommendations.

5. Incident Reports

Generate structured reports containing:

Incident title.

Description.

Severity.

Timeline.

Affected services.

Observed errors.

Probable root cause.

Supporting evidence.

Recommended remediation.

Investigation status.

6. Desktop Companion

Basic NOVA interface.

Incident visibility.

Monitoring status.

AI investigation display.

Basic interaction with the backend.

7. Local Monitoring

Monitor selected local log files.

Demonstrate basic system monitoring.

Feed collected events into the incident engine.

8. Mobile Connectivity

Basic mobile interface.

QR-based device pairing.

Real-time incident updates.

Basic approval workflow.

13. Demonstration Scenario

The primary demonstration should simulate a real application outage.

Build a small example environment consisting of:

An API gateway.

A backend service.

A simulated PostgreSQL database.

A payment service.

Introduce a database connectivity failure.

The simulated sequence should look like this:

Database Connection Failure
          |
          v
Backend Connection Errors
          |
          v
API Request Timeouts
          |
          v
Payment Service Failures
          |
          v
User-Facing Service Disruption

APEX should:

Collect logs from the simulated services.

Detect the database connection errors.

Correlate subsequent API and payment failures.

Identify the database as the probable root cause.

Assign an appropriate incident severity.

Retrieve relevant troubleshooting guidance.

Generate a structured investigation report.

Notify NOVA and the connected mobile application.

Present a remediation recommendation.

Allow the user to approve a simulated recovery action.

Verify the simulated service recovery.

The demonstration must show that APEX understands the relationship between multiple failures rather than simply summarizing individual log messages.

14. Development Principles

All contributors and AI coding agents should follow these principles.

Build the core first. Incident detection and investigation are the foundation of APEX.

Keep modules independent. The incident engine must not depend on Electron, Express, or Gemini.

Prefer deterministic logic. Use normal code for parsing, classification, correlation, and severity.

Use AI where it adds value. Gemini should focus on investigation, reasoning, explanations, and recommendations.

Keep Windows and Linux compatibility in mind. Avoid platform-specific assumptions in shared modules.

Use shared schemas. Keep API contracts and shared types consistent using Zod.

Validate external data. Never trust logs, API responses, or AI-generated output without validation.

Avoid unnecessary complexity. Do not introduce services, abstractions, or dependencies without a clear purpose.

Prioritize security. Never bypass permission checks or expose secrets for development convenience.

Write maintainable code. Prefer readable, typed, testable modules.

Test critical behavior. Incident detection, severity, correlation, and security checks must have automated tests.

Document architectural changes. Update this document when major design decisions change.

15. Development Roadmap

Phase 1 — Foundation

Monorepo setup.

Shared schemas and types.

Desktop application.

Backend server.

WebSocket communication.

Basic incident-core implementation.

Development scripts and tests.

Phase 2 — Incident Intelligence

Log ingestion.

Normalization.

Error classification.

Event correlation.

Severity assessment.

Incident lifecycle management.

Knowledge-base retrieval.

Gemini investigation.

Phase 3 — NOVA Desktop Companion

Floating interface.

Incident notifications.

System health information.

AI conversation.

Investigation interface.

Phase 4 — Local Monitoring

Linux system monitoring.

Windows system monitoring.

Application log collection.

Process output collection.

Docker integration.

Permission management.

Phase 5 — Mobile Companion

Mobile PWA.

QR pairing.

Authenticated real-time communication.

Incident notifications.

Remote approval workflow.

Phase 6 — Cloud Integrations

Provider integrations.

Custom telemetry ingestion.

OpenTelemetry support.

Persistent incident history.

Cloud-based monitoring independent of desktop availability.

Phase 7 — Intelligent Response

Remediation playbooks.

Human approval.

Safe execution.

Verification.

Audit history.

The roadmap is directional. Features should be prioritized according to the actual project milestone and hackathon requirements.

16. Instructions for AI Coding Agents

Any AI agent working on this repository must read this document before making significant architectural or implementation changes.

The agent must:

Understand the current architecture before modifying it.

Inspect existing code rather than assuming files or functionality exist.

Preserve the separation between the incident engine and AI orchestration.

Avoid implementing unrelated features before the MVP is functional.

Avoid replacing working code without a clear reason.

Keep API contracts synchronized.

Run relevant tests and type checks after changes.

Explain important architectural decisions.

Never expose secrets or weaken security controls.

Clearly identify incomplete, mocked, or simulated functionality.

If a requested implementation conflicts with the security principles or architectural direction in this document, explain the conflict before proceeding.

Do not claim that an integration, monitoring capability, or remediation action works unless it has actually been implemented and tested.

17. Long-Term Vision

APEX aims to become a unified operational intelligence platform.

The long-term vision is a system that can understand the health of an entire development and infrastructure environment, identify problems before they become major incidents, explain what is happening, and assist engineers in resolving issues safely.

NOVA should become the natural interface for interacting with that intelligence.

The ultimate goal is simple:

Less time investigating failures. More time building and maintaining reliable systems.

APEX is not intended to replace engineers.

It is intended to make engineers faster, better informed, and more effective.

Project: APEX
AI Companion: NOVA
Primary Focus: AI-assisted IT operations and incident response
Core Philosophy: Evidence first. Intelligence second. Human-controlled action always.
