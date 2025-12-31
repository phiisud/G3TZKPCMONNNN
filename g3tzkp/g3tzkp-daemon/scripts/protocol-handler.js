#!/usr/bin/env node
import { exec } from 'child_process';

const url = process.argv[2];

if (!url || !url.startsWith('g3tzkp://')) {
  console.error('Invalid G3TZKP URL');
  process.exit(1);
}

const appName = url.replace('g3tzkp://', '').split('/')[0].toUpperCase();
const localUrl = `http://127.0.0.1:47777/open/${appName}`;

console.log(`[G3TZKP] Opening: ${appName}`);
console.log(`[G3TZKP] Redirecting to: ${localUrl}`);

const platform = process.platform;
let command;

if (platform === 'win32') {
  command = `start "" "${localUrl}"`;
} else if (platform === 'darwin') {
  command = `open "${localUrl}"`;
} else {
  command = `xdg-open "${localUrl}"`;
}

exec(command, (error) => {
  if (error) {
    console.error('[G3TZKP] Failed to open browser:', error.message);
    process.exit(1);
  }
});
