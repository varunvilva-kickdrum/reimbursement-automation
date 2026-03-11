# Reimbursement Pipeline – Stories and Tickets

Execution-focused stories for Research & Design and Repository Setup. Story points use 1 SP = 1 hour.

---

## Story 1: Research & Design

**Story points:** 10

**Description:** Define the pipeline architecture, integration points, and tooling so the team can implement the event-driven reimbursement flow with clear technical decisions and a shared understanding of scale, APIs, and AI components.

**As a** developer, **I want** architecture and integration options researched and designed **so that** we can build a scalable, maintainable pipeline with well-chosen Keka integration, Step Functions orchestration, and AI/OCR tooling.

| Task | Acceptance criteria |
|------|---------------------|
| Design and discuss scalable architecture diagram | Produce an architecture diagram (e.g. Eraser) covering event flow, SQS, EventBridge, Step Functions, Lambdas, S3, DynamoDB, and external services. Review with the team; capture scaling and failure assumptions. |
| Research available and useful Keka APIs | Identify and document Keka APIs relevant to the pipeline (e.g. employees, expense claims, attachments, webhooks). Document auth, rate limits, payloads, and recommend usage for event emission and processing. |
| Step Functions design and execution flow | Define the state machine: trigger (EOD), read SQS, invoke Processing Lambda per message, retry policy, and persistence of outcomes (valid, invalid, failed_verification). Document idempotency and error handling. |
| Research tools and AI models to experiment with in the pipeline | Compile a shortlist of OCR (e.g. Mistral, Docling), extraction (e.g. Google LangExtract), and optional geocoding/classification options. Include evaluation criteria (accuracy, cost, latency) and how they fit into the pipeline. |

---

## Story 2: Repository Setup

**Story points:** 12

**Description:** Establish the project repository with a clear code layout, CI/CD for deployments and commit checks, Linear–GitHub–Slack integration for visibility, automated tests for functions and pipeline behaviour, and Cursor rules so that both humans and AI tooling can contribute consistently.

**As a** developer, **I want** the repository and tooling set up **so that** we can develop, test, and deploy the pipeline with automated quality checks and aligned team notifications.

| Task | Acceptance criteria |
|------|---------------------|
| Create repository with basic code structure | Initialize repo (e.g. GitHub) with a clear structure: source directories (e.g. lambdas, shared, infra), config placeholders, README with run instructions, and dependency files (e.g. package.json, requirements.txt) as appropriate. |
| CI/CD for automated deployments and commit checks | Configure CI/CD (e.g. GitHub Actions) to run on commits: lint, test, and (where applicable) deploy to a dev environment. Branch and deployment strategy documented. |
| Connect Linear to GitHub and Slack for notifications | Integrate Linear with GitHub (e.g. branch/PR linking, status updates) and Slack (e.g. issue updates, release notifications) so the team sees progress and context in one place. |
| Automated testing for functions and pipeline | Add tests for Lambda handlers and pipeline steps (unit and, where feasible, integration). CI runs tests on every commit; coverage or critical-path coverage is visible. |
| Cursor rules required for the project | Add `.cursor/rules` or project-level Cursor rules: stack (e.g. Node/Python, AWS), conventions, and where requirements/docs live so AI-assisted edits stay consistent with the project. |

---

## Story 3: IaC Development (Factory-Based Resource Creation)

**Story points:** 18

**Description:** Develop Infrastructure as Code with basic creation logic for all pipeline resources (Lambda, Step Functions, EventBridge, DynamoDB, S3, SQS, API Gateway, EventBridge Pipes) using creation patterns such as factory so that resources are defined consistently and can be composed for different environments.

**As a** developer, **I want** IaC that uses factory patterns to create pipeline resources **so that** we can provision and maintain the reimbursement audit pipeline infrastructure in a consistent, repeatable way.

| Task | Acceptance criteria |
|------|---------------------|
| IaC factory/base module for Lambda | Implement a factory (or equivalent pattern) that creates Lambda function resources with configurable handler, runtime, memory, timeout, env vars, and IAM. Reusable for Ingestion, OCR/Extraction, Validation, Reporting, Config Extraction, and Notification Lambdas. |
| IaC creation for Step Functions | Define Step Functions state machine resource with basic workflow structure (placeholder states). Factory or module supports defining states, transitions, and Lambda task integrations. |
| IaC creation for EventBridge (Scheduler + Rules) | Create EventBridge Scheduler and/or EventBridge rules for EOD trigger and any event-driven triggers. Document schedule and rule patterns. |
| IaC creation for SQS | Create SQS queue(s) with configurable retention, visibility timeout, and optional DLQ. Integrate with API Gateway/EventBridge and Step Functions trigger. |
| IaC creation for S3 | Create S3 bucket(s) for raw attachments, processed documents, and config (versioned JSON). Apply lifecycle/encryption and minimal IAM for Lambdas. |
| IaC creation for DynamoDB | Create DynamoDB table(s) for processed outcomes (e.g. valid, invalid, failed_verification). Define key schema and indexes; document access patterns. |
| IaC creation for API Gateway | Create API Gateway (REST or HTTP) with webhook endpoint(s) for reimbursement claim uploads. Connect to SQS or downstream Lambda. |
| IaC creation for EventBridge Pipes | Define EventBridge Pipes resource(s) where applicable (e.g. source → enrichment → target). Wire to DynamoDB/SQS/Lambda as per architecture. |
| Wire resources and document topology | Connect resources (EventBridge → API/Step Functions, SQS → Step Functions, Lambdas ↔ S3/DynamoDB). Document resource names, env separation, and deployment order. |

---

## Story 4: Ingestion Lambda – Development

**Story points:** 13

**Description:** Build the Ingestion Lambda that pulls reimbursement claims from Slack and splits multi-invoice PDFs into individual invoice files so that each invoice can be processed independently by the OCR and validation pipeline.

**As a** developer, **I want** an Ingestion Lambda that fetches from Slack and splits PDFs **so that** reimbursement submissions are normalized into one-invoice-per-file for downstream OCR and validation.

| Task | Acceptance criteria |
|------|---------------------|
| Slack integration for claim/attachment retrieval | Lambda can authenticate with Slack (Bot/App token), list and fetch files from designated channel(s) or workflow. Support file types used for reimbursement (PDF, images). Store metadata (user, channel, ts) for audit. |
| PDF splitting into multiple invoices | For PDFs that contain multiple invoices/receipts, implement splitting logic (page-based or detection-based) so each resulting file represents one invoice. Output format suitable for S3 upload and downstream OCR. |
| Upload split/raw files to S3 | Write ingested/split files to the pipeline S3 bucket with a consistent key structure (e.g. `raw/{request_id}/{file_id}.pdf`). Emit events or payloads for Step Functions / SQS to trigger OCR step. |
| Idempotency and error handling | Handle duplicate submissions and partial failures; log errors and optionally DLQ or dead-letter for manual review. |
| Configuration and secrets | Slack credentials and bucket names from config/secrets (e.g. SSM, Secrets Manager); no hardcoded secrets. |

---

## Story 5: Ingestion Lambda – Testing

**Story points:** 5

**Description:** Test the Ingestion Lambda with real and synthetic Slack payloads and multi-invoice PDFs so that we can confidently deploy it and hand off to the OCR stage.

**As a** developer, **I want** the Ingestion Lambda tested end-to-end **so that** we know it correctly pulls from Slack, splits PDFs, and writes to S3.

| Task | Acceptance criteria |
|------|---------------------|
| Unit tests for Slack client and PDF splitting | Unit tests for Slack API calls (mocked) and for PDF splitting logic with sample multi-page PDFs. Coverage for edge cases (single page, empty PDF, malformed). |
| Integration test with Slack (or fixture) | Integration test that uses a test Slack channel or fixture payload; verify files are written to S3 with expected keys and metadata. |
| E2E test for full ingestion flow | Run Lambda with a representative Slack event; confirm split files in S3 and that downstream trigger (SQS/Step Functions) receives expected message format. Document how to run and what env vars are needed. |

---

## Story 6: OCR Lambda – Development (Strategy Pattern, Mistral + Docling)

**Story points:** 13

**Description:** Implement the OCR Lambda using the strategy pattern with Mistral and Docling as pluggable OCR strategies so that we can run either provider and compare or switch without changing orchestration.

**As a** developer, **I want** an OCR Lambda with strategy-based OCR (Mistral and Docling) **so that** we can evaluate both and choose or fallback at runtime.

| Task | Acceptance criteria |
|------|---------------------|
| Strategy interface and factory | Define an OCR strategy interface (e.g. `extract_text(document) → structured result`) and a factory/registry that returns the correct strategy by name or config. Both Mistral and Docling strategies are implemented and selectable. |
| Mistral OCR integration | Implement Mistral-based OCR strategy: call Mistral API (or configured endpoint) with document bytes/URL, parse response into a common structured format (text, optional blocks/regions). Handle auth, timeouts, and errors. |
| Docling OCR integration | Implement Docling-based OCR strategy (container or Lambda layer): run Docling on the document and return output in the same common format. Both strategies produce outputs that the Extraction/Validation layer can consume. |
| Lambda handler and wiring | Lambda reads input (e.g. S3 key from Step Functions), loads document, selects strategy (config or input), runs OCR, and returns/writes result (S3 + DynamoDB or payload for next step). |
| Configuration and feature flags | Strategy selection via env or config (e.g. `OCR_STRATEGY=mistral|docling`). No hardcoded API keys; use secrets manager or IAM where applicable. |

---

## Story 7: OCR Lambda – Testing and Evaluation

**Story points:** 8

**Description:** Test and evaluate the OCR Lambda with both Mistral and Docling on a representative set of invoices so that we can measure accuracy, latency, and cost and decide on a default or fallback strategy.

**As a** developer, **I want** the OCR Lambda tested and evaluated for both strategies **so that** we have data to tune prompts, choose a default, and document operational behavior.

| Task | Acceptance criteria |
|------|---------------------|
| Unit tests for strategies and handler | Unit tests for each OCR strategy (mocked external calls) and for the handler (strategy selection, error handling, output shape). |
| Test dataset and evaluation metrics | Curate or create a small test dataset of invoice PDFs/images. Define metrics (e.g. field-level accuracy for invoice number, amount, date; WER if applicable; latency p50/p99). |
| Run evaluation for Mistral and Docling | Run both strategies on the test set; record accuracy and latency per document. Document results in a short report (table or markdown). |
| Integration/E2E test | End-to-end test: trigger OCR Lambda with real S3 input; verify output written to S3/DynamoDB and that Extraction/Validation can consume it. Test strategy switching via config. |

---

## Story 8: Inference and Validation Lambda – Development

**Story points:** 15

**Description:** Build the Inference and Validation Lambda that uses LangExtract and other models to extract structured data from OCR output, applies validation rules from a JSON config (skipping config extraction for now), and uses Google Maps API and additional models for location and classification so that claims are classified and validated consistently before persistence.

**As a** developer, **I want** an Inference and Validation Lambda that runs extraction and applies config-driven rules **so that** we can route claims to valid / invalid / failed_verification and store outcomes in DynamoDB.

| Task | Acceptance criteria |
|------|---------------------|
| LangExtract integration for structured extraction | Integrate Google LangExtract (or equivalent) to extract structured fields from OCR text (e.g. invoice number, amount, date, merchant, category). Define a common schema and prompt/schema design for food, cab, gym and other reimbursement types. Output in a format the validation layer can consume. |
| Additional models for classification and enrichment | Use one or more additional models (e.g. for category classification, food vs blocked items). Support pluggable or configurable model selection. Document model choices and how they feed into validation. |
| Load and apply validation rules from JSON config | Read validation rules from a JSON config (e.g. S3 or env path); no Config Extraction Lambda for now. Rules include amount caps, time windows, working days, holidays, food/cab/gym rules, and eligibility. Apply rules to extracted data and produce outcome: valid, invalid, or failed_verification with reason codes. |
| Google Maps API integration | Use Google Maps API (e.g. Geocoding, Places, or Distance Matrix) where needed for location validation or enrichment. Handle API keys via secrets; respect rate limits and errors. |
| Persist outcomes to DynamoDB | Write validation result (outcome, reason codes, extracted fields, confidence) to DynamoDB with a defined key schema and indexes for reporting and audit. |
| Configuration and error handling | Config path and API keys from env/secrets. Graceful handling of missing config, API failures, and low-confidence extractions; document behavior and optional fallbacks. |

---

## Story 9: Inference and Validation Lambda – Testing

**Story points:** 6

**Description:** Test the Inference and Validation Lambda with sample OCR output, JSON configs, and mocked external APIs so that extraction, rule application, and DynamoDB writes behave as expected.

**As a** developer, **I want** the Inference and Validation Lambda tested **so that** we trust extraction, validation rules, and outcome persistence before connecting to the full pipeline.

| Task | Acceptance criteria |
|------|---------------------|
| Unit tests for extraction and validation | Unit tests for LangExtract (mocked) and for rule engine: given extracted data + JSON config, assert correct outcome (valid/invalid/failed_verification) and reason codes. Cover food, cab, gym caps and edge cases. |
| Unit tests for Google Maps and other integrations | Mock Google Maps API (and other model calls); verify location validation and classification paths. Test error and rate-limit handling. |
| Integration test with real config and DynamoDB | Integration test: invoke Lambda with sample OCR payload and a test JSON config; verify DynamoDB item written with expected attributes. Use local DynamoDB or test table. |
| Test config schema and rule coverage | Document JSON config schema; add tests that load a representative config and run validation for at least one claim per outcome type. |

---

## Story 10: End-to-End Flow – Keka to EventBridge and Step Functions

**Story points:** 10

**Description:** Implement the high-level flow from Keka (or equivalent claim source) through EventBridge and Step Functions so that claim uploads or EOD triggers start the pipeline and each claim is processed by the state machine.

**As a** developer, **I want** the flow from Keka to EventBridge and Step Functions working **so that** a single trigger drives the full processing pipeline for reimbursement claims.

| Task | Acceptance criteria |
|------|---------------------|
| Keka webhook or API → API Gateway | Expose an API Gateway endpoint (webhook) that accepts Keka claim/upload events (or equivalent payload). Validate payload and forward to downstream (SQS or direct invoke). Document payload shape and auth. |
| EventBridge as event router | Configure EventBridge (rules/scheduler) to receive events (e.g. from API Gateway, SQS, or EOD schedule) and trigger the pipeline. Support at least: (1) webhook-driven and (2) schedule-driven (EOD) flows. |
| SQS between ingestion and Step Functions | When using async flow: messages from API Gateway or EventBridge are sent to SQS. Document queue name, message format, and retention/DLQ. |
| Step Functions trigger and input | Step Functions state machine is triggered by EventBridge (or by a Lambda that reads from SQS). Input includes claim/request identifier and any needed context (e.g. S3 keys). Document how to start an execution and what input is passed. |
| End-to-end trigger test | One manual or automated test: simulate a Keka-style event → API Gateway/EventBridge → SQS (if used) → Step Functions execution started. Confirm execution ID and that the state machine receives the expected input. |

---

## Story 11: Report Generation Flow

**Story points:** 10

**Description:** Implement the report generation flow per architecture: Reporting Lambda triggered on schedule (e.g. 6th of every month at 10 AM), reads processed data from DynamoDB by period, generates CSV/Excel report, and delivers to HR (e.g. via SES or Slack).

**As a** developer, **I want** the report generation flow implemented **so that** HR receives periodic reimbursement audit reports from the pipeline.

| Task | Acceptance criteria |
|------|---------------------|
| Schedule trigger for Reporting Lambda | EventBridge Scheduler (or rule) triggers the Reporting Lambda on the defined schedule (e.g. 6th of every month at 10 AM). Lambda receives trigger event; document schedule and timezone. |
| Fetch processed data from DynamoDB by period | Reporting Lambda queries DynamoDB for processed outcomes in the report period (e.g. previous month). Use partition/sort key and filters; support pagination if needed. Data includes outcome (valid/invalid/failed_verification), reason codes, and relevant claim fields. |
| Generate CSV/Excel report | Build a report (CSV and/or Excel) from the fetched records: columns aligned with audit needs (e.g. claim id, employee, amount, category, outcome, reason, date). Optionally support filters (e.g. by outcome type). |
| Deliver report to HR (SES or Slack) | Send the generated report to HR via SES (email with attachment) and/or post/link in Slack (HR Ops channel). Document recipient config (email list or channel) and use secrets for credentials. |
| Align with architecture (Report Processing) | Flow matches architecture: EventBridge (schedule) → Reporting Lambda → DynamoDB read → report file → HR Ops (SES/Slack). Document the flow and any dependencies (e.g. S3 for large reports). |

---

