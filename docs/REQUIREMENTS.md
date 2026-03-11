# Reimbursement Pipeline Requirements

## 1. Introduction and Objectives

### 1.1 Purpose

This document describes the requirements for an automated reimbursement processing pipeline. The company uses Keka as its Human Resource Management (HRM) system. Employees upload bills for reimbursement in three categories: food orders, cab (to and from office), and gym membership or related expenses.

The main objective is to process these bills using a combination of OCR (Optical Character Recognition), Google LangExtract for structured data extraction, and an AI-driven validation layer that applies configurable business rules to decide whether each claim is valid for reimbursement.

### 1.2 High-Level Flow (Event-Driven)

1. **Event capture**: When an employee uploads a bill (PDF/image) in Keka, an event is generated. The event is sent to **Amazon SQS** and retained for the day. SQS is used to decouple upload from processing, retain events for a configurable period (e.g. one day), and allow end-of-day processing of all queued bills one by one.
2. **End-of-day processing**: At the end of the day, **EventBridge** triggers an **AWS Step Functions** state machine on a schedule. Step Functions orchestrates the run: it reads messages from SQS and, for each message, invokes the processing **Lambda** (fetch attachment, S3, OCR, extract, geocode, validate, write to DynamoDB). Step Functions provides **retries** when the Lambda fails (e.g. transient error) or when the AI returns low confidence (e.g. possible hallucination); after retries are exhausted, the claim is still written to DynamoDB with a status indicating failure or low confidence so that no event is dropped.
3. **Processing**: For each bill, the processing Lambda uses OCR (Mistral AI or Docling), then Google LangExtract extracts structured fields. Addresses may be geocoded via Google Maps API. Config-driven validation rules are applied.
4. **Storage (all outcomes)**: **Valid** (passed validation), **invalid** (failed validation rules), and **failed verification** (Lambda error after retries or AI low confidence) are all stored in **Amazon DynamoDB**. The report is generated from this data; the processing sequence does not need to trigger report generation.
5. **Report (independent)**: A **Report Lambda** runs on its own **schedule** (e.g. monthly for that month’s data). It is **not** part of the Step Functions or EOD processing sequence. It reads DynamoDB for the chosen period, generates the CSV/Excel report (who is correct, who is flagged and why, who could not be verified), and sends it by email to HR via SES.

### 1.3 Pipeline Schedule

The pipeline is **event-driven with end-of-day processing**. Upload events are queued in SQS during the day. A scheduled **EventBridge** rule (e.g. once daily at end of day) triggers the **Step Functions** state machine, which consumes messages from SQS and invokes the processing Lambda for each bill (with retries). SQS message retention is set to retain events for at least one day. **Report generation** is separate: EventBridge triggers the Report Lambda on a schedule (e.g. 1st of each month for the previous month); it does not run in sequence after the validate step.

### 1.4 Architecture Diagram

The pipeline architecture is documented in Eraser: [Reimbursement Pipeline Architecture](https://app.eraser.io/workspace/AApPLLpiar7d687F9cX4?origin=share).

---

## 2. Event-Driven Ingestion and Queueing

### 2.1 Event Flow

When an employee uploads a bill (PDF or image) in Keka, an **event is generated**. That event must be delivered into the pipeline. The event payload should identify the employee, claim, and attachment so that the processor can fetch and process the bill. Delivery options (to be decided during design) include: Keka webhook to an API Gateway + Lambda that enqueues to SQS, or another mechanism that places the event into **Amazon SQS**.

### 2.2 Role of SQS

**Amazon SQS** is used to:

- **Retain events for a day**: Messages stay in the queue until processed; retention is configured (e.g. one day) so that uploads from the day are not lost.
- **Decouple upload from processing**: The system that receives the upload event does not need to process the bill immediately; it only enqueues the event.
- **Enable end-of-day processing**: A scheduled Lambda runs at end of day, reads from SQS, and processes each message (each bill) one by one until the queue is drained (or up to a defined limit).

So SQS is required for this design: it holds the events until the pipeline runs at the end of the day and allows processing one bill at a time.

### 2.3 End-of-Day Trigger and Processing (Step Functions)

**EventBridge** runs on a schedule (e.g. once daily at end of day). It triggers an **AWS Step Functions** state machine (not the Lambda directly). Step Functions:

1. Reads messages from the SQS queue (one by one or in batches, as designed).
2. For each message, invokes the processing **Lambda**. Step Functions applies a **retry policy** (e.g. max attempts, backoff) so that if the Lambda fails (transient error) or returns low confidence (e.g. AI hallucination or OCR uncertainty), the step is retried. After retries are exhausted, the state machine still records the outcome (e.g. writes to DynamoDB with status `failed_verification` or `low_confidence`) so that the claim is not lost and can appear on the report.
3. Deletes the message from SQS after the step completes (success or exhausted retries).

This way, failure handling is centralized in Step Functions; the processing Lambda can signal failure or low confidence, and Step Functions decides whether to retry or to persist the outcome and continue.

### 2.4 Keka API Usage

When processing each queued event, the Lambda (or processing step) uses Keka APIs to fetch the actual bill and related data:

| API Endpoint | Purpose |
|--------------|---------|
| `GET /api/v1/hris/employees` | Resolve employee details when needed. |
| `GET /api/v1/expense/claims` | Resolve claim details for the event. |
| `GET /api/v1/expense/attachment` | Fetch the bill attachment (image or PDF) for the claim. |

### 2.5 Landing Zone

Raw attachments (and any API responses that need to be stored) are written to a defined Amazon S3 bucket and prefix structure. The exact structure (e.g. by date, employee id, claim id) is to be defined during design.

### 2.6 Dependencies

- Mechanism to receive upload events from Keka (e.g. webhook to API Gateway + Lambda that enqueues to SQS, or partner integration).
- Keka API credentials (secure storage, e.g. AWS Secrets Manager).
- Network access from the processing Lambda to Keka APIs and SQS.
- SQS queue with retention and (optionally) DLQ for failed messages; EventBridge rule for EOD schedule; Step Functions state machine for orchestration and retries.

---

## 3. Processing: OCR and Structured Extraction

### 3.1 Compute: Step Functions and Lambda

Processing is orchestrated by **AWS Step Functions**. EventBridge (EOD schedule) triggers the state machine, which reads from SQS and invokes the processing **Lambda** for each bill. The Lambda performs OCR, extraction, geocoding if needed, validation, and DynamoDB write. Step Functions provides retries (e.g. on Lambda failure or when the Lambda returns low-confidence so that possible AI hallucination can be retried). Glue is not required for this flow.

### 3.2 OCR

One of the following will be used for OCR on bill images and PDFs:

- **Mistral AI** (or equivalent OCR capability).
- **Docling**.

Both options will be evaluated during experimentation for accuracy, cost, and language support. Cost is to be estimated per document or per API call (placeholder).

### 3.3 Structured Extraction (Google LangExtract)

After OCR, Google LangExtract is used to extract structured fields from the text.

| Category | Fields |
|----------|--------|
| Common | date, price, type (food / cab / gym), invoice number. |
| Cab | from_location, to_location. |
| Gym | expires_date, invoice duration (for multi-month logic). |

The **invoice number** is obtained from the PDF or attachment via OCR. It is used for gym re-upload logic (same invoice number implies continuation from stored expiry). Employees may upload different invoice formats; normalisation of the invoice identifier for deduplication and lookup must be addressed in design.

### 3.4 Address Geocoding (Google Maps API)

Text-based addresses (e.g. cab **from_location** and **to_location** extracted from bills) may need to be converted to coordinates for validation or reporting. The **Google Maps Geocoding API** (or equivalent) will be used to convert address strings to latitude/longitude. This supports use cases such as verifying that cab trips are office-related or within allowed areas. The pipeline will call the Geocoding API for relevant location fields after extraction; rate limits and cost (per-request) are to be considered during design.

### 3.5 Output Storage (All Outcomes in DynamoDB)

All outcomes are written to **Amazon DynamoDB**: **valid** (passed validation), **invalid** (failed validation rules, with reason), and **failed verification** (Lambda error after retries or AI/OCR low confidence). The table design (single table or normalised) and access patterns (e.g. by employee, by month, by status, by invoice number for gym) will be defined during design. No outcome is dropped; the Report Lambda reads this data on a schedule.

---

## 4. Validation Rules (Config-Driven)

All rule parameters (limits, holiday list, food/cab/gym rules) are read from a configuration file stored in S3. That configuration is sourced from Google Sheets and updated monthly (see Section 5).

### 4.1 Rules Summary

| Rule | Description |
|------|-------------|
| **Food + cab cap** | Total food plus cab reimbursement per employee per month must not exceed INR 2,500. |
| **Food delivery window** | All food deliveries must be between 08:00 and 21:00. |
| **Working days only** | Only working days are allowed. Holidays are not allowed; the list of holiday dates is maintained in the config (from Google Sheets). |
| **Food classification** | Food invoices must be classified as valid for lunch or dinner. Vegetable-only orders and dry snack items are not allowed. An AI or rule-based classification step is required to accept or reject based on item type. |
| **Gym** | See Section 4.2. |

### 4.2 Gym Reimbursement Rules (Detailed)

- Reimbursement per gym invoice: **min(50% of invoice total, INR 1,000 per month)**.
- If the invoice spans more than one month:
  - Reimbursement = min(50% of total amount, number_of_months × 1,000).
  - **number_of_months is capped at 6.** For example, a 12-month invoice is treated as 6 months: reimburse min((total/12)×6, 6×1,000).
  - The **expiry date** stored in the database is start_date + 6 months (not the full invoice period).
- **Re-upload of the same invoice** (same invoice number, obtained from OCR):
  - The next eligible period starts from the **stored expiry date** of that invoice (from the database), not from the date on the new upload.
  - Again, a maximum of 6 months applies; there is no overlap with the previous period.
- Invoice number is derived from OCR; different invoice formats across employees require a normalisation strategy for matching and lookup.

---

## 5. Configuration Management

### 5.1 Source of Truth: Google Sheets

HR maintains a **Google Sheet** that is editable each month. It contains:

- Holiday dates (list of dates when claims are not allowed).
- Rules for food, cab, and gym (limits, time windows, and any other parameters that the pipeline uses).

The exact formatting of the sheet (columns, tabs, cell layout) for these rules is to be defined during design.

### 5.2 Config Sync Lambda

A Lambda function runs at **month start** (or as part of the pipeline trigger). It:

1. Reads the Google Sheet via the Google Sheets API.
2. Transforms the content into the pipeline JSON schema.
3. Uploads the resulting JSON to a defined S3 object (e.g. versioned by date or month).

### 5.3 Pipeline Usage

All pipeline components read the configuration from this S3 object at runtime. Versioning of the config object is recommended so that each run uses a consistent snapshot.

---

## 6. Report and Downstream Output

### 6.1 Report: Independent of Processing Sequence

Report generation is **not** part of the Step Functions or EOD processing flow. A **Report Lambda** runs on its own **schedule** (e.g. 1st of each month for the previous month’s data). It reads from DynamoDB only, builds the report for the chosen period, and sends it by email. It does not need to run after the validate step or in the same sequence as the processing pipeline.

### 6.2 Report Format and Delivery

- **Format**: CSV or Excel, neatly formatted.
- **Delivery**: Sent by email to the HR team via SES.
- **Trigger**: EventBridge schedule (e.g. monthly); Report Lambda is invoked by the schedule, not by Step Functions.

### 6.3 Report Content

The report is generated from DynamoDB, which holds all claims and their status:

- **Valid**: reimbursement correct (passed validation).
- **Invalid (flagged)**: claim failed validation rules; report includes **reason** (e.g. which rule was violated).
- **Failed verification**: pipeline could not verify (Lambda failure after retries, or AI/OCR low confidence). Report clearly distinguishes this from “invoice failed config criteria.”

### 6.4 Failure Handling (Processing Pipeline)

- **Step Functions retries**: When the processing Lambda fails (e.g. transient error) or returns low confidence (e.g. possible AI hallucination), Step Functions retries according to the state machine configuration (e.g. max attempts, backoff). After retries are exhausted, the outcome is still written to DynamoDB with a status such as `failed_verification` or `low_confidence`.
- **All outcomes in DynamoDB**: Valid, invalid, and failed verification are all stored. Nothing is dropped; the Report Lambda includes all of them in the report for the period.

---

## 7. High-Level Costing (Placeholders)

Costing is to be estimated during design and experimentation. The table below lists the services and leaves cost as a placeholder.

| Service / Component | Description | Cost |
|--------------------|-------------|------|
| Keka | API subscription and usage as per vendor. | TBD |
| Amazon S3 | Storage and request volume for raw data and config. | TBD |
| AWS Lambda | Event receiver (enqueue to SQS), processing (per bill, invoked by Step Functions), config sync, report (scheduled, reads DynamoDB only). | TBD |
| Amazon DynamoDB | Read/write capacity and storage. | TBD |
| Amazon SQS | Queue for upload events; retain messages for a day; EOD processing. | TBD |
| AWS Step Functions | Orchestrate EOD run; invoke processing Lambda per message; retry on failure or low confidence. | TBD |
| Amazon EventBridge | Schedule Step Functions (EOD), Config Sync Lambda (month start), Report Lambda (e.g. monthly). | TBD |
| Mistral AI / Docling | OCR; per-document or per-call. | TBD |
| Google LangExtract | Structured extraction; per-document or per-call. | TBD |
| Google Sheets API | Config sync; within free tier or paid. | TBD |
| Google Maps API (Geocoding) | Convert text-based addresses to coordinates; per-request. | TBD |
| Email (SES or SMTP) | Report delivery to HR. | TBD |
| Optional | API Gateway, Secrets Manager, CloudWatch (logging and monitoring). | TBD |

---

## 8. Resources and Roles

### 8.1 Infrastructure

- AWS account with appropriate networking and security.
- IAM roles and policies for Lambda, Step Functions, S3, SQS, DynamoDB, EventBridge, and any other services used.
- Keka API credentials (stored securely, e.g. Secrets Manager).
- Google Sheets API credentials (or service account) for the config sync Lambda.
- Google Maps API key (or equivalent) for the Geocoding API (address-to-coordinates).
- Email delivery mechanism (e.g. Amazon SES or SMTP) for sending the report to HR.

### 8.2 Team Roles

Roles needed for development, experimentation, and operations (no names, only roles):

- Backend or pipeline development (ingestion, processing, validation, report).
- Data or ML (OCR, LangExtract, food classification).
- DevOps or cloud (AWS setup, CI/CD, monitoring).

---

## 9. Experimentation and Build Phases

### 9.1 Experimentation

| Area | Activities |
|------|------------|
| **OCR** | Compare Mistral and Docling on sample bills for accuracy, cost, and language support. Test invoice number extraction and normalisation across different invoice formats. |
| **LangExtract** | Design and test prompts and schema for food, cab, and gym extraction. |
| **Food classification** | Define and test "valid food" (lunch/dinner) vs "not allowed" (vegetable-only, dry snacks). Implement and evaluate a model or rule set for classification. |
| **Geocoding** | Test Google Maps Geocoding API on sample address strings (cab from/to); validate rate limits, cost per request, and accuracy for Indian addresses. |
| **Lambda vs Glue** | Run a small batch with both; compare cost and implementation complexity for the expected volume. |

### 9.2 Build Order

1. Event reception and SQS: receive upload events from Keka, enqueue to SQS (retention e.g. one day).
2. EventBridge and Step Functions: trigger state machine at end of day; state machine reads SQS and invokes processing Lambda per message with retries (on Lambda failure or low AI confidence); all outcomes (valid, invalid, failed verification) written to DynamoDB.
3. Config sync: Google Sheets to S3 JSON (month start or as needed).
4. Validation rules: food and cab first, then food classification, then gym with expiry and re-upload logic.
5. Report Lambda (independent): schedule (e.g. monthly); read DynamoDB for period; generate CSV/Excel; send email to HR via SES.

### 9.3 Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Config schema changes | Versioned config in S3; document sheet format; handle missing or new fields gracefully. |
| Keka API rate limits | Backoff and retry; batch or throttle requests. |
| Invoice format variance | Normalise invoice identifiers; fallbacks for missing fields; clear failure reasons in report. |

---

## 10. Out of Scope and Assumptions

- **Out of scope (unless stated otherwise)**: Direct approval workflow in Keka (e.g. auto-approve/reject via API); payroll system integration; multi-currency (assume INR only).
- **Assumptions**: Currency is INR; Keka API behaviour and response format are as assumed; HR will maintain the Google Sheet and consume the report via email.

---

## 11. Document Conventions

- No emojis; formal tone; simple language.
- Acronyms are defined on first use (e.g. HRM, OCR, API, S3).

