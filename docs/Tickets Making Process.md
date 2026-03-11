1. Repository setup
Create a new repo
Setting up Serverless for local testing of lambdas
Setting up rules for CI/CD
AI tool setup - Cursor rules, skills
Testing for functions and pipeline
2. Research & Design
Event-driven architecture and Keka integration (SQS EventBridge Step Functions webhook API usage)
OCR and document processing workflow (PDFs receipts preprocessing)
Validation rule structure (Google Sheets config confidence thresholds) scheduling and report design
Step Functions flow and retry design (low-confidence idempotency)
3. AI generated boilerplate
Build prompt to generate AI plan
Execute and refine plan
Build plan
Initial fixes and getting the application working
4. IAC fixes and ammendmends
Foundation (remote state IAM roles policies env separation)
Event ingestion and queueing (API Gateway Event Receiver Lambda SQS retention DLQ)
Step Functions and processing pipeline (EOD trigger SQS consume Lambda invoke retries)
Observability security (CloudWatch Secrets Manager encryption alerts)
5. Keka APIs fixes and validations
Refine Keka API integration and endpoints
Fix integration points and object schemas
OCR and rule validation experimentation
Experimentation - OCR and Inference tools
6. OCR tool evaluation (Mistral vs Docling) and invoice number extraction across formats
LangExtract prompt and schema design (food cab gym) and food classification (valid vs blocked items)
OCR and extraction improvement (prompt tuning fallbacks error handling)
7. Automated tests
Build automation framework 
Write tests for validation rules
8. Testing (Manual)
Validation rules (food cab gym caps working days food type) and config integration
Confidence routing and DynamoDB outcomes (valid invalid failed_verification)
Report generation (read DynamoDB by period CSV/Excel) and SES delivery to HR
Gym re-upload logic and audit trail (reason codes)
9. Config Management (Out of scope for MVP)
Google Sheets API and Config Sync Lambda (Sheets to S3 JSON)
Config schema (holidays food cab gym rules) and EventBridge rule (month start)