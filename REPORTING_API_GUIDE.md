# Reporting API Implementation Guide

This application now supports the full W3C Reporting API specification, allowing you to collect various types of reports beyond just CSP violations.

## Supported Report Types

The application can now handle all report types defined in the Reporting API specification:

- **CSP Violations** (`csp-violation`) - Content Security Policy violations
- **Deprecation Reports** (`deprecation`) - Usage of deprecated web features
- **Intervention Reports** (`intervention`) - Browser interventions
- **Crash Reports** (`crash`) - Page crashes
- **Network Error Reports** (`network-error`) - Network-related errors
- **Custom Report Types** - Any other report type you define

## API Endpoints

### Legacy CSP Endpoint (Backward Compatible)
```
POST /api/report/{endpoint-name}
POST /api/report
```
These endpoints continue to work with the legacy CSP report format for backward compatibility.

### New Generic Reporting Endpoint
```
POST /api/v1/report/{endpoint-name}
```
This endpoint is highly flexible and accepts multiple formats:
- **Modern array format**: Send multiple reports as a JSON array (standard Reporting API format)
- **Modern single format**: Send a single report as a JSON object (for convenience)
- **Legacy CSP format**: Automatically detects and handles legacy CSP reports with `csp-report` wrapper

## Report Format

### Modern Reporting API Format
Send reports as a JSON array (or single object) where each report has this structure:

```json
[
  {
    "type": "csp-violation",
    "age": 12345,
    "url": "https://example.com/page",
    "user_agent": "Mozilla/5.0...",
    "body": {
      "documentURL": "https://example.com/page",
      "referrer": "https://example.com/",
      "violatedDirective": "script-src",
      "effectiveDirective": "script-src",
      "originalPolicy": "script-src 'self'",
      "disposition": "enforce",
      "blockedURL": "https://evil.com/script.js"
    }
  },
  {
    "type": "deprecation",
    "age": 5432,
    "url": "https://example.com/page",
    "user_agent": "Mozilla/5.0...",
    "body": {
      "id": "WebComponentsV0",
      "anticipatedRemoval": "2024-01-01",
      "message": "Web Components v0 APIs are deprecated",
      "sourceFile": "https://example.com/app.js",
      "lineNumber": 42,
      "columnNumber": 15
    }
  }
]
```

## Configuration Examples

### HTML Meta Tag Configuration
```html
<meta http-equiv="Reporting-Endpoints" content="default="/api/v1/report/my-app"">
```

### HTTP Header Configuration
```
Reporting-Endpoints: default="/api/v1/report/my-app"
```

### Content Security Policy with Reporting
```
Content-Security-Policy: default-src 'self'; report-to default
```

### Feature Policy with Reporting
```
Permissions-Policy: camera=(), microphone=(); report-to=default
```

## Dashboard Features

The web dashboard now supports:

1. **Unified View**: See both legacy CSP reports and modern generic reports in one interface
2. **Filtering**: Filter by report type (CSP, Generic, or All)
3. **Endpoint Management**: Create and manage multiple reporting endpoints
4. **Detailed Views**: Click on any report to see full details
5. **Statistics**: View counts for different report types

## Testing Your Implementation

### 1. Create an Endpoint
Use the dashboard to create a new endpoint, e.g., "test-app"

### 2. Send a Test Report

**Array format (standard):**
```bash
curl -X POST https://your-domain.com/api/v1/report/test-app \
  -H "Content-Type: application/reports+json" \
  -d '[{
    "type": "deprecation",
    "age": 1000,
    "url": "https://example.com/test",
    "user_agent": "Test Agent",
    "body": {
      "id": "TestFeature",
      "message": "This is a test deprecation report"
    }
  }]'
```

**Single object format (convenience):**
```bash
curl -X POST https://your-domain.com/api/v1/report/test-app \
  -H "Content-Type: application/reports+json" \
  -d '{
    "type": "deprecation",
    "age": 1000,
    "url": "https://example.com/test",
    "user_agent": "Test Agent",
    "body": {
      "id": "TestFeature",
      "message": "This is a test deprecation report"
    }
  }'
```

### 3. View in Dashboard
Check the dashboard to see your test report appear in the "Generic Reports" section.

## Migration from Legacy CSP

The new generic endpoint provides seamless migration from legacy CSP reporting:

### Option 1: Gradual Migration (Recommended)
1. Update your `Reporting-Endpoints` header to point to `/api/v1/report/{endpoint}`
2. Your existing CSP reports will continue to work automatically (legacy format is detected)
3. Configure other policies (Feature Policy, etc.) to use the same endpoint
4. All reports will appear in the unified dashboard

### Option 2: Keep Existing Setup
- Legacy endpoints (`/api/report/{endpoint}`) continue to work unchanged
- Use new endpoint (`/api/v1/report/{endpoint}`) for new report types
- Both will appear in the unified dashboard

The new endpoint automatically detects the report format, so browsers sending legacy CSP reports will work without any configuration changes.

## Database Schema

The application uses two database models:

- **CspReport**: Legacy CSP-specific reports (backward compatibility)
- **Report**: Generic reports that can store any report type with flexible JSON body

Both are displayed together in the dashboard for a unified experience.
