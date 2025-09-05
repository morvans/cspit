# CSP Violation Reporter

A Next.js application that collects and displays Content Security Policy (CSP) violation reports from browsers. Built with TypeScript, MongoDB, Prisma, and shadcn/ui components.

## Features

- **API Endpoint**: Receives CSP violation reports from browsers at `/api/report`
- **Dashboard**: View and analyze collected CSP violations with a clean UI
- **Statistics**: Track total reports, enforced vs report-only violations
- **Real-time Data**: Automatically fetches and displays the latest violations
- **Docker Support**: Complete containerized development environment

## Technology Stack

- **Framework**: Next.js 15 with TypeScript
- **Database**: MongoDB
- **ORM**: Prisma
- **UI**: shadcn/ui components with Tailwind CSS
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose installed on your system

### Installation & Setup

1. **Clone and navigate to the project**:
   ```bash
   cd /path/to/your/project
   ```

2. **Start the application**:
   ```bash
   docker-compose up
   ```

   This will:
   - Build the Next.js application
   - Start the MongoDB database
   - Install all dependencies
   - Start the development server on http://localhost:3000

3. **Access the application**:
   - Dashboard: http://localhost:3000
   - API endpoint: http://localhost:3000/api/report

## Usage

### Setting up CSP Reporting

To start receiving CSP violation reports, add the `report-uri` or `report-to` directive to your website's CSP header:

```http
Content-Security-Policy: default-src 'self'; report-uri http://localhost:3000/api/report
```

Or using the newer `report-to` directive:

```http
Content-Security-Policy: default-src 'self'; report-to csp-endpoint
Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"http://localhost:3000/api/report"}]}
```

### API Endpoints

#### POST /api/report
Receives CSP violation reports from browsers.

**Request Format**:
```json
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "referrer": "https://example.com/",
    "violated-directive": "script-src 'self'",
    "effective-directive": "script-src",
    "original-policy": "default-src 'self'; script-src 'self'",
    "disposition": "enforce",
    "blocked-uri": "https://evil.com/script.js",
    "line-number": 10,
    "column-number": 5,
    "source-file": "https://example.com/page",
    "status-code": 200,
    "script-sample": "console.log('blocked')"
  }
}
```

#### GET /api/reports
Returns all collected CSP violation reports, ordered by timestamp (newest first).

### Dashboard Features

The web dashboard provides:

- **Overview Cards**: Total reports, enforced violations, and report-only violations
- **Reports Table**: Detailed view of all violations with:
  - Timestamp
  - Document URI where the violation occurred
  - Violated directive
  - Blocked URI
  - Disposition (enforce/report)

## Development

### Running Commands

Since the development environment runs in Docker, use these commands to interact with the application:

```bash
# Install new packages
docker-compose run --rm app npm install <package-name>

# Run Prisma commands
docker-compose run --rm app npx prisma generate
docker-compose run --rm app npx prisma db push

# Access the app container shell
docker-compose exec app sh
```

### Database Schema

The application uses a single `CspReport` model with the following fields:

- `id`: Unique identifier
- `documentUri`: URL where the violation occurred
- `referrer`: Referring page URL
- `violatedDirective`: The CSP directive that was violated
- `effectiveDirective`: The effective directive that caused the violation
- `originalPolicy`: The complete CSP policy
- `disposition`: "enforce" or "report"
- `blockedUri`: The URI that was blocked
- `lineNumber`, `columnNumber`: Location in source file
- `sourceFile`: Source file URL
- `statusCode`: HTTP status code
- `scriptSample`: Sample of blocked script
- `userAgent`: Browser user agent
- `timestamp`: When the violation was reported

## Testing the Application

1. **Start the application**:
   ```bash
   docker-compose up
   ```

2. **Test the API endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/report \
     -H "Content-Type: application/json" \
     -d '{
       "csp-report": {
         "document-uri": "https://example.com/test",
         "violated-directive": "script-src '\''self'\''",
         "effective-directive": "script-src",
         "original-policy": "default-src '\''self'\''; script-src '\''self'\''",
         "disposition": "enforce",
         "blocked-uri": "https://malicious.com/script.js"
       }
     }'
   ```

3. **View the dashboard**: Open http://localhost:3000 to see the reported violation.

## Production Deployment

For production deployment:

1. Update the `DATABASE_URL` environment variable to point to your production MongoDB instance
2. Set `NODE_ENV=production`
3. Build and deploy the Docker container to your preferred hosting platform

## Contributing

1. Make changes to the code
2. Test locally using `docker-compose up`
3. Ensure all TypeScript types are correct
4. Submit a pull request

## License

MIT License - feel free to use this project for your CSP monitoring needs.
