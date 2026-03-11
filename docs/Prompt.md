# Architecture Diagram Prompt

Use this prompt in [Eraser DiagramGPT](https://www.eraser.io/diagramgpt) or a similar tool to generate a clean reimbursement pipeline architecture diagram. Copy the content below the line.

---

Draw a clean cloud architecture diagram for an event-driven reimbursement pipeline. Use a professional style, clear labels, and correct arrows for data and trigger flow. Do not use emojis.

## Components

**External systems**
- Keka (HRM): employees upload bills; exposes webhook for upload events and APIs for employees, claims, attachment.
- Google Sheets: HR-editable config (holidays, rules).
- Google Sheets API: used by Config Sync Lambda to read sheet data.
- Mistral AI or Docling: OCR API for bill images/PDFs.
- Google LangExtract: structured extraction API (date, price, type, locations, etc.).
- Google Maps Geocoding API: address text to coordinates.
- HR team: receives report by email.

**AWS – event and queue**
- API Gateway: HTTP endpoint that receives the upload event (webhook) from Keka and invokes the Event Receiver Lambda.
- Amazon SQS: queue that holds upload events; retention one day; consumed at end of day by the Step Functions state machine (which invokes the Processing Lambda per message).
- Amazon EventBridge: three scheduled rules – (1) end-of-day trigger for **Step Functions** (not Lambda directly), (2) month-start trigger for Config Sync Lambda, (3) report trigger for Report Lambda (e.g. 1st of month for previous month).
- **AWS Step Functions**: state machine triggered at EOD; reads SQS, invokes Processing Lambda for each message with **retry** (on Lambda failure or low AI confidence); after retries exhausted, outcome (valid, invalid, or failed_verification) is still written to DynamoDB. Report Lambda is **not** in this sequence.

**AWS – Lambdas (list what each Lambda calls)**

1. **Event Receiver Lambda**
   - Triggered by: API Gateway (when Keka sends webhook on bill upload).
   - Targets: **SQS** only. It enqueues one message per upload event (payload: employee/claim/attachment identifiers).

2. **Config Sync Lambda**
   - Triggered by: EventBridge (schedule, e.g. month start).
   - Targets: **Google Sheets API** (read), **S3** (write config JSON object).

3. **Processing Lambda** (bill processor, invoked by Step Functions)
   - Triggered by: **Step Functions** (one invocation per SQS message at EOD).
   - Targets: **SQS** (read/delete message), **Keka API** (fetch employees, claims, attachment), **S3** (write raw attachment; read config), **Mistral or Docling** (OCR), **Google LangExtract** (extract), **Google Maps Geocoding API** (geocode), **DynamoDB** (write outcome: valid, invalid, or failed_verification). Can return low_confidence to trigger Step Functions retry.

4. **Report Lambda** (independent of processing sequence)
   - Triggered by: **EventBridge** (schedule only, e.g. 1st of month for previous month). **Not** triggered by Step Functions or by the validate step.
   - Targets: **DynamoDB** (read claim data for the period), **S3** (read config if needed), **Amazon SES** (send CSV/Excel report email to HR).

**AWS – storage and delivery**
- Amazon S3: (1) raw bill attachments written by Processing Lambda, (2) config JSON written by Config Sync Lambda, read by Processing Lambda and Report Lambda.
- Amazon DynamoDB: stores **all** outcomes – valid, invalid (failed validation), and failed_verification (Lambda error after retries or low AI confidence). Read only by Report Lambda for report generation.
- Amazon SES: sends the report email to HR; invoked by Report Lambda.

## Arrows (direction and meaning)

Ensure arrows go in the correct direction (from caller to target, or from data source to consumer).

1. **Upload flow:** Keka → API Gateway (webhook); API Gateway → Event Receiver Lambda (invoke); Event Receiver Lambda → SQS (send message).
2. **Config flow:** EventBridge (month start) → Config Sync Lambda (invoke); Config Sync Lambda → Google Sheets API (read); Config Sync Lambda → S3 (write config).
3. **EOD processing flow (Step Functions):** EventBridge (EOD schedule) → **Step Functions** (invoke state machine); Step Functions → SQS (read messages); Step Functions → **Processing Lambda** (invoke per message, with retry on failure or low confidence); Processing Lambda → Keka API (fetch); Processing Lambda → S3 (write attachment; read config); Processing Lambda → Mistral/Docling (OCR); Processing Lambda → Google LangExtract (extract); Processing Lambda → Google Maps Geocoding API (geocode); Processing Lambda → DynamoDB (write outcome: valid, invalid, or failed_verification); Step Functions → SQS (delete message after step). Do **not** draw an arrow from Step Functions or Processing Lambda to Report Lambda.
4. **Report flow (independent):** EventBridge (report schedule, e.g. monthly) → Report Lambda (invoke); Report Lambda → DynamoDB (read claim data for period); Report Lambda → S3 (read config if needed); Report Lambda → SES (send email); SES → HR (email delivered). Report Lambda is not in the EOD or Step Functions sequence.

## Diagram rules

- One box per component. Include **Step Functions** as the EOD orchestrator (between EventBridge and Processing Lambda). Label each Lambda with its name and the services it targets.
- Use arrows for: (a) triggers (EventBridge → Step Functions, EventBridge → Config Sync Lambda, EventBridge → Report Lambda; Step Functions → Processing Lambda), (b) data/calls (Processing Lambda → SQS, Keka, S3, OCR, LangExtract, Geocoding, DynamoDB; Report Lambda → DynamoDB, S3, SES), (c) SES → HR.
- Show that Report Lambda is **independent**: triggered only by EventBridge schedule; no arrow from Step Functions or Processing Lambda to Report Lambda. DynamoDB is the only link between processing and report (processing writes all outcomes; report reads by period).
- Group external systems on one side, AWS in the middle, HR as report consumer. Keep the diagram uncluttered; use a legend if needed for trigger vs data/call.
