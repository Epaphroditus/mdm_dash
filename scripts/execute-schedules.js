#!/usr/bin/env node
// scripts/execute-schedules.js

/**
 * This script can be run via a cron job or scheduler to execute pending schedules.
 * It calls the /api/schedules/execute endpoint to check and execute due schedules.
 * 
 * Example cron job:
 * */5 * * * * /path/to/node /path/to/execute-schedules.js
 * 
 * This would run every 5 minutes
 */

const https = require('https');
const http = require('http');
require('dotenv').config();

const apiUrl = process.env.API_URL || 'http://localhost:3000';
const apiKey = process.env.SCHEDULE_EXECUTOR_API_KEY;

if (!apiKey) {
  console.error('SCHEDULE_EXECUTOR_API_KEY environment variable is not set');
  process.exit(1);
}

// Determine if we're using http or https
const client = apiUrl.startsWith('https') ? https : http;
const url = `${apiUrl}/api/schedules/execute`;

console.log(`Executing schedules: ${new Date().toISOString()}`);
console.log(`Calling: ${url}`);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey
  }
};

const req = client.request(url, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (result.message === 'No schedules to execute') {
          console.log('No schedules to execute at this time');
        } else {
          console.log(`Successfully executed ${result.executed} schedules, ${result.failed} failed`);
          if (result.results) {
            console.log('Results:', JSON.stringify(result.results, null, 2));
          }
        }
      } else {
        console.error(`Error (${res.statusCode}):`, result);
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      console.error('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error calling execute endpoint:', error);
});

req.end();