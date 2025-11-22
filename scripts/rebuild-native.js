#!/usr/bin/env node

/**
 * Rebuild native Node modules for Electron
 * This script ensures node-llama-cpp, better-sqlite3, and keytar work in Electron
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Native modules that need rebuilding with their locations
// NOTE: node-llama-cpp uses pre-built binaries and should NOT be rebuilt
const NATIVE_MODULES = [
  { name: 'better-sqlite3', workspace: 'app/main' },
  { name: 'keytar', workspace: null } // root level
];

function log(message, type = 'info') {
  const prefix = {
    info: '✓',
    warn: '⚠',
    error: '✗',
    start: '▶'
  }[type] || 'ℹ';
  console.log(`${prefix} ${message}`);
}

function findModuleInPnpm(moduleName) {
  // Check in .pnpm store
  const pnpmDir = join(rootDir, 'node_modules', '.pnpm');
  if (!existsSync(pnpmDir)) {
    return null;
  }

  try {
    const entries = readdirSync(pnpmDir);
    const moduleDir = entries.find(e => e.startsWith(moduleName + '@'));
    if (moduleDir) {
      return join(pnpmDir, moduleDir, 'node_modules', moduleName);
    }
  } catch (error) {
    // Ignore errors
  }

  return null;
}

function checkModuleExists(moduleName) {
  // Check regular node_modules first
  const regularPath = join(rootDir, 'node_modules', moduleName);
  if (existsSync(regularPath)) {
    return regularPath;
  }

  // Check pnpm store
  return findModuleInPnpm(moduleName);
}

function rebuildModule(moduleInfo) {
  const modulePath = checkModuleExists(moduleInfo.name);
  
  if (!modulePath) {
    log(`Module ${moduleInfo.name} not installed, skipping rebuild`, 'warn');
    return 'skip';
  }

  try {
    log(`Rebuilding ${moduleInfo.name} for Electron...`, 'start');
    
    // Use electron-rebuild from node_modules/.bin
    const electronRebuildPath = join(rootDir, 'node_modules', '.bin', 
      process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild');
    
    if (!existsSync(electronRebuildPath)) {
      log('electron-rebuild not found. Installing @electron/rebuild...', 'warn');
      execSync('pnpm add -D @electron/rebuild', {
        cwd: rootDir,
        stdio: 'inherit'
      });
    }

    // Rebuild the specific module using the module path
    const command = `"${electronRebuildPath}" -f -w ${moduleInfo.name} -m "${modulePath}"`;
    
    execSync(command, {
      cwd: rootDir,
      stdio: 'pipe',
      shell: true,
      encoding: 'utf-8'
    });
    
    log(`Successfully rebuilt ${moduleInfo.name}`, 'info');
    return 'success';
  } catch (error) {
    const errorMsg = error.message || String(error);
    
    // Check if it's a file lock error (app is running)
    if (errorMsg.includes('EPERM') || errorMsg.includes('operation not permitted')) {
      log(`Cannot rebuild ${moduleInfo.name}: File is in use (app may be running)`, 'warn');
      log('Please close the application and run: pnpm rebuild', 'info');
      return 'locked';
    }
    
    log(`Failed to rebuild ${moduleInfo.name}: ${errorMsg}`, 'error');
    return 'error';
  }
}

async function runNodeLlamaCppPostinstall() {
  const modulePath = checkModuleExists('node-llama-cpp');
  if (!modulePath) {
    return false;
  }

  try {
    log('Running node-llama-cpp postinstall script...', 'start');
    
    const postinstallScript = join(modulePath, 'dist', 'cli', 'cli.js');
    if (!existsSync(postinstallScript)) {
      log('node-llama-cpp postinstall script not found, skipping', 'warn');
      return false;
    }

    execSync(`node "${postinstallScript}" postinstall`, {
      cwd: modulePath,
      stdio: 'pipe',
      shell: true,
      encoding: 'utf-8'
    });
    
    log('node-llama-cpp postinstall completed', 'info');
    return true;
  } catch (error) {
    log(`node-llama-cpp postinstall failed: ${error.message}`, 'warn');
    return false;
  }
}

async function main() {
  log('Starting native module rebuild for Electron...', 'start');
  log('Note: node-llama-cpp uses pre-built binaries and will not be rebuilt', 'info');
  log('This will rebuild: better-sqlite3, keytar\n', 'info');
  
  // First, run node-llama-cpp's postinstall to ensure platform binaries are set up
  const llamaPostinstall = await runNodeLlamaCppPostinstall();
  if (llamaPostinstall) {
    log('✓ node-llama-cpp binaries configured\n', 'info');
  }
  
  const results = { success: 0, error: 0, skip: 0, locked: 0 };

  for (const moduleInfo of NATIVE_MODULES) {
    const result = rebuildModule(moduleInfo);
    results[result]++;
  }

  console.log('\n' + '='.repeat(60));
  log(`Rebuild summary: ${results.success} succeeded, ${results.error} failed, ${results.skip} skipped, ${results.locked} locked`, 'info');
  
  if (results.locked > 0) {
    log('\n⚠ WARNING: Some modules are locked by the running application', 'warn');
    log('Close the app and run: pnpm rebuild', 'info');
    log('Then restart the app to see changes\n', 'info');
    process.exit(0); // Don't fail on locked files during postinstall
  }
  
  if (results.error > 0) {
    log('Some modules failed to rebuild. The app may not work correctly.', 'warn');
    process.exit(1);
  }
  
  if (results.success > 0) {
    log('✓ All native modules rebuilt successfully!', 'info');
  }
  
  console.log('='.repeat(60) + '\n');
}

main().catch(error => {
  log(`Rebuild script failed: ${error.message}`, 'error');
  process.exit(1);
});

