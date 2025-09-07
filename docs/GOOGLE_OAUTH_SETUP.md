# Google OAuth Configuration Fix

## Problem
Google authentication is failing with "Couldn't sign you in" and "This browser or app may not be secure" error.

## Root Cause
The Google Cloud Console OAuth configuration doesn't match what NextAuth.js expects.

## Solution
You need to update your Google Cloud Console OAuth 2.0 Client configuration:

### 1. Go to Google Cloud Console
- Navigate to: https://console.cloud.google.com/
- Select your project (or the project containing your OAuth client)
- Go to "APIs & Services" > "Credentials"

### 2. Edit your OAuth 2.0 Client ID
Find your OAuth client ID: `823859054648-r80hptonq2cmjrpl3qdl0k4gqq8gdl0n.apps.googleusercontent.com`

### 3. Update Authorized JavaScript Origins
Add these origins:
```
http://localhost:3000
```

### 4. Update Authorized Redirect URIs
Add this exact redirect URI:
```
http://localhost:3000/api/auth/callback/google
```

### 5. Save the Configuration
Click "Save" in Google Cloud Console.

## Important Notes
- The redirect URI must be **exactly** `http://localhost:3000/api/auth/callback/google`
- Make sure `localhost` is in the authorized origins
- Changes may take a few minutes to propagate

## Test After Configuration
1. Restart your Docker containers: `docker-compose restart`
2. Try the authentication flow again at http://localhost:3000

## Expected Callback URL Format
NextAuth.js uses this pattern for Google OAuth callbacks:
`{NEXTAUTH_URL}/api/auth/callback/{provider}`

Where:
- `NEXTAUTH_URL` = `http://localhost:3000`
- `provider` = `google`
- Full callback URL = `http://localhost:3000/api/auth/callback/google`
