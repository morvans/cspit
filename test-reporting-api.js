#!/usr/bin/env node

/**
 * Test script for the Generic Reporting API
 * 
 * This script tests the new /api/v1/report/{endpoint} endpoint
 * with various report types to ensure it works correctly.
 * 
 * Usage: node test-reporting-api.js [base-url] [endpoint-name]
 * Example: node test-reporting-api.js http://localhost:3000 test-endpoint
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:3000';
const ENDPOINT_NAME = process.argv[3] || 'test-endpoint';
const API_URL = `${BASE_URL}/api/v1/report/${ENDPOINT_NAME}`;

console.log(`Testing Reporting API at: ${API_URL}\n`);

// Test reports
const testReports = [
  // CSP Violation Report
  {
    type: 'csp-violation',
    age: 1234,
    url: 'https://example.com/test-page',
    user_agent: 'Mozilla/5.0 (Test Agent)',
    body: {
      documentURL: 'https://example.com/test-page',
      referrer: 'https://example.com/',
      violatedDirective: 'script-src',
      effectiveDirective: 'script-src',
      originalPolicy: "script-src 'self'",
      disposition: 'enforce',
      blockedURL: 'https://evil.com/malicious.js',
      statusCode: 200
    }
  },
  
  // Deprecation Report
  {
    type: 'deprecation',
    age: 5678,
    url: 'https://example.com/deprecated-feature',
    user_agent: 'Mozilla/5.0 (Test Agent)',
    body: {
      id: 'WebComponentsV0',
      anticipatedRemoval: '2024-12-31',
      message: 'Web Components v0 APIs are deprecated and will be removed',
      sourceFile: 'https://example.com/app.js',
      lineNumber: 42,
      columnNumber: 15
    }
  },
  
  // Intervention Report
  {
    type: 'intervention',
    age: 9012,
    url: 'https://example.com/intervention-test',
    user_agent: 'Mozilla/5.0 (Test Agent)',
    body: {
      id: 'AudioContextAutoplay',
      message: 'AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page.',
      sourceFile: 'https://example.com/audio.js',
      lineNumber: 23,
      columnNumber: 8
    }
  },
  
  // Custom Report Type
  {
    type: 'performance-issue',
    age: 3456,
    url: 'https://example.com/slow-page',
    user_agent: 'Mozilla/5.0 (Test Agent)',
    body: {
      metric: 'largest-contentful-paint',
      value: 4500,
      threshold: 2500,
      message: 'LCP exceeded acceptable threshold'
    }
  }
];

/**
 * Send HTTP request
 */
function sendRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/reports+json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Reporting-API-Test/1.0'
      }
    };
    
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonResponse
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Run tests
 */
async function runTests() {
  console.log('🧪 Testing Generic Reporting API\n');
  
  try {
    // Test 1: Send all reports at once
    console.log('📤 Test 1: Sending batch of mixed report types...');
    const response1 = await sendRequest(API_URL, testReports);
    
    if (response1.statusCode === 201) {
      console.log('✅ Batch request successful!');
      console.log(`   Response: ${JSON.stringify(response1.body, null, 2)}\n`);
    } else {
      console.log(`❌ Batch request failed with status ${response1.statusCode}`);
      console.log(`   Response: ${JSON.stringify(response1.body, null, 2)}\n`);
    }
    
    // Test 2: Send individual reports as arrays
    console.log('📤 Test 2: Sending individual reports as arrays...');
    for (let i = 0; i < testReports.length; i++) {
      const report = testReports[i];
      console.log(`   Sending ${report.type} report as array...`);
      
      const response = await sendRequest(API_URL, [report]);
      
      if (response.statusCode === 201) {
        console.log(`   ✅ ${report.type} report sent successfully (array format)`);
      } else {
        console.log(`   ❌ ${report.type} report failed with status ${response.statusCode}`);
        console.log(`      Response: ${JSON.stringify(response.body, null, 2)}`);
      }
    }
    
    // Test 3: Send individual reports as single objects
    console.log('\n📤 Test 3: Sending individual reports as single objects...');
    for (let i = 0; i < testReports.length; i++) {
      const report = testReports[i];
      console.log(`   Sending ${report.type} report as single object...`);
      
      const response = await sendRequest(API_URL, report); // Send as single object, not array
      
      if (response.statusCode === 201) {
        console.log(`   ✅ ${report.type} report sent successfully (single format)`);
        if (response.body.format) {
          console.log(`      Format detected: ${response.body.format}`);
        }
      } else {
        console.log(`   ❌ ${report.type} report failed with status ${response.statusCode}`);
        console.log(`      Response: ${JSON.stringify(response.body, null, 2)}`);
      }
    }
    
    console.log('\n🎉 Testing completed!');
    console.log('\n📊 Next steps:');
    console.log(`   1. Open your dashboard at ${BASE_URL}`);
    console.log(`   2. Check the "Generic Reports" filter to see the test reports`);
    console.log(`   3. Click on individual reports to see their details`);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure your server is running');
    console.error('   2. Check that the endpoint exists in your dashboard');
    console.error('   3. Verify the URL is correct');
  }
}

// Run the tests
runTests();
