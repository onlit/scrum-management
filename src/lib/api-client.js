const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const axios = require('axios');
const { BASE_URL } = require('./constants');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('ERROR: ACCESS_TOKEN not found.');
  console.error('Create a .env file in the project root with:');
  console.error('  ACCESS_TOKEN=Bearer <your_token>');
  process.exit(1);
}

// ACCESS_TOKEN already contains "Bearer " prefix — never wrap again
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
});

module.exports = api;
