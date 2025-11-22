# Native Modules in Semantiqa Electron App

This document explains how native Node.js modules are handled in this Electron application.

## Overview

This application uses several native Node modules that require special handling:

1. **`node-llama-cpp`** - Local LLM inference (uses pre-built binaries)
2. **`better-sqlite3`** - SQLite database (needs rebuilding for Electron)
3. **`keytar`** - Secure credential storage (needs rebuilding for Electron)

## Critical Information

### ⚠️ DO NOT Rebuild node-llama-cpp

**`node-llama-cpp` v3.x uses PRE-BUILT BINARIES that are already compatible with Electron.**

- The module ships with platform-specific binaries for Windows, macOS, and Linux
- These binaries are in optional dependencies like `@node-llama-cpp/win-x64`
- Running `electron-rebuild` on this module will **BREAK** the pre-built binaries
- The module has its own postinstall script that configures the correct binary for your platform

### ✅ Modules That Need Rebuilding

Only these modules should be rebuilt with `electron-rebuild`:
- `better-sqlite3` - Compiled for your platform's Node ABI
- `keytar` - Native credential store bindings

## How It Works

### Automatic Setup (Recommended)

When you run `pnpm install`, the postinstall script automatically:

1. Runs `node-llama-cpp`'s postinstall to configure platform binaries
2. Rebuilds `better-sqlite3` and `keytar` for Electron using `@electron/rebuild`

### Manual Rebuild

If you need to rebuild manually:

```bash
# Close the application first!
pnpm rebuild
```

This runs `scripts/rebuild-native.js` which:
- Configures `node-llama-cpp` (doesn't rebuild it)
- Rebuilds `better-sqlite3` for Electron
- Rebuilds `keytar` for Electron

## Troubleshooting

### Error: "Cannot destructure property '_llama' of 'undefined'"

**Cause**: `node-llama-cpp` was incorrectly rebuilt with `electron-rebuild`, breaking the pre-built binaries.

**Solution**:
```bash
# 1. Stop the app
# 2. Reinstall node-llama-cpp to restore pre-built binaries
pnpm install --force
# 3. Rebuild other native modules properly
pnpm rebuild
# 4. Start the app
pnpm --filter @semantiqa/app-main run start
```

### Worker Thread Errors

If you see errors loading native modules in worker threads:

1. **Check that the module is properly installed**:
   ```bash
   ls node_modules/.pnpm/@node-llama-cpp+win-x64@*/node_modules/@node-llama-cpp/win-x64/bins/
   ```

2. **Verify the binary exists**:
   - Windows: `llama-addon.node` should be in the bins directory
   - macOS: Look for `llama-addon.node` in the metal directory
   - Linux: Look for `llama-addon.node` in the bins directory

3. **Check permissions**: Ensure the binary has execute permissions

### File Locked Errors (Windows)

If you get "EPERM: operation not permitted" errors:

1. **Close all instances of the application**
2. **Check Task Manager** for any lingering Electron processes
3. **Run the rebuild**: `pnpm rebuild`

### Platform-Specific Issues

**Windows:**
- Requires Visual C++ Redistributable for some native modules
- May need Windows Build Tools for some compilations

**macOS:**
- Xcode Command Line Tools required
- May need to accept Xcode license

**Linux:**
- Build essentials required (`build-essential` package)
- Python 3 required for node-gyp

## Development Workflow

### After Cloning the Repository

```bash
pnpm install  # Automatically sets up all native modules
pnpm run build
pnpm --filter @semantiqa/app-main run start
```

### After Upgrading Electron

```bash
pnpm rebuild  # Rebuild modules for new Electron version
```

### After Adding a New Native Module

1. Install the module: `pnpm add <module-name>`
2. If it needs Electron rebuilding, add it to `scripts/rebuild-native.js`
3. Update this document

## Technical Details

### How node-llama-cpp Works

`node-llama-cpp` v3.x architecture:
```
node-llama-cpp (main package)
├── dist/              (JavaScript/TypeScript code)
├── llama/             (llama.cpp source - optional)
└── optionalDependencies:
    ├── @node-llama-cpp/win-x64
    │   └── bins/win-x64/llama-addon.node  (pre-built for Node + Electron)
    ├── @node-llama-cpp/mac-arm64-metal
    │   └── bins/mac-arm64-metal/llama-addon.node
    └── ... (other platforms)
```

The module's postinstall script (`dist/cli/cli.js postinstall`) detects your platform and configures the correct optional dependency.

### How Electron Native Modules Work

Electron uses a different Node ABI than standalone Node.js because:
- Different V8 version
- Different Node.js version  
- Electron-specific patches

Modules compiled for Node.js won't work in Electron and vice versa.

**Solutions:**
1. **Pre-built binaries** (node-llama-cpp): Ship binaries for both Node and Electron
2. **Rebuild** (better-sqlite3, keytar): Recompile from source for Electron's ABI

### Worker Threads and Native Modules

Worker threads in Electron can load native modules, but:
- The module must be properly initialized
- Module resolution must work from the worker's context
- Native bindings must be thread-safe

`node-llama-cpp` is designed to work in worker threads and handles thread safety internally.

## References

- [Electron: Using Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [node-llama-cpp Documentation](https://node-llama-cpp.withcat.ai)
- [@electron/rebuild](https://github.com/electron/rebuild)

## Maintenance

**Last Updated**: November 2025  
**Electron Version**: 32.3.3  
**node-llama-cpp Version**: 3.14.2

If you encounter issues not covered here, please update this document with the solution!
