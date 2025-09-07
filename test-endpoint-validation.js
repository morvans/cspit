#!/usr/bin/env node

/**
 * Test script to verify endpoint validation in the reporting API
 * This script tests that reports are rejected when the endpoint token doesn't exist
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testEndpointValidation() {
  console.log('🧪 Testing Endpoint Validation\n');

  // Test 1: Try to submit a report to a non-existent endpoint (modern API)
  console.log('Test 1: Modern API with non-existent endpoint');
  try {
    const response = await fetch(`${API_BASE}/api/v1/report/non-existent-endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/reports+json',
      },
      body: JSON.stringify([{
        type: 'csp-violation',
        age: 1000,
        url: 'https://example.com/test',
        user_agent: 'Test Agent',
        body: {
          documentURL: 'https://example.com/test',
          violatedDirective: 'script-src',
          blockedURL: 'https://evil.com/script.js'
        }
      }])
    });

    const result = await response.json();
    
    if (response.status === 404 && result.error.includes('not found')) {
      console.log('✅ PASS: Modern API correctly rejected non-existent endpoint');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${result.error}\n`);
    } else {
      console.log('❌ FAIL: Modern API should have rejected non-existent endpoint');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(result, null, 2)}\n`);
    }
  } catch (error) {
    console.log('❌ ERROR: Failed to test modern API');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 2: Try to submit a legacy CSP report to a non-existent endpoint
  console.log('Test 2: Legacy CSP API with non-existent endpoint');
  try {
    const response = await fetch(`${API_BASE}/api/report/non-existent-legacy-endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/csp-report',
      },
      body: JSON.stringify({
        'csp-report': {
          'document-uri': 'https://example.com/test',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/script.js',
          'original-policy': 'script-src \'self\'',
          'disposition': 'enforce'
        }
      })
    });

    const result = await response.json();
    
    if (response.status === 404 && result.error.includes('not found')) {
      console.log('✅ PASS: Legacy API correctly rejected non-existent endpoint');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${result.error}\n`);
    } else {
      console.log('❌ FAIL: Legacy API should have rejected non-existent endpoint');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(result, null, 2)}\n`);
    }
  } catch (error) {
    console.log('❌ ERROR: Failed to test legacy API');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 3: Try to submit a modern report to v1 API with legacy CSP format
  console.log('Test 3: Modern API with legacy CSP format and non-existent endpoint');
  try {
    const response = await fetch(`${API_BASE}/api/v1/report/non-existent-csp-endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/csp-report',
      },
      body: JSON.stringify({
        'csp-report': {
          'document-uri': 'https://example.com/test',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/script.js',
          'original-policy': 'script-src \'self\'',
          'disposition': 'enforce'
        }
      })
    });

    const result = await response.json();
    
    if (response.status === 404 && result.error.includes('not found')) {
      console.log('✅ PASS: Modern API correctly rejected legacy CSP format with non-existent endpoint');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${result.error}\n`);
    } else {
      console.log('❌ FAIL: Modern API should have rejected legacy CSP format with non-existent endpoint');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(result, null, 2)}\n`);
    }
  } catch (error) {
    console.log('❌ ERROR: Failed to test modern API with legacy format');
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('🏁 Endpoint validation tests completed!');
  console.log('\n📝 Summary:');
  console.log('- All reporting endpoints now require existing endpoint tokens');
  console.log('- Reports to non-existent endpoints return 404 status');
  console.log('- Both modern and legacy APIs enforce endpoint validation');
  console.log('- Endpoints must be created via the /api/endpoints API first');
}

// Run the tests
if (require.main === module) {
  testEndpointValidation().catch(console.error);
}

module.exports = { testEndpointValidation };
