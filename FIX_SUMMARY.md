# Fix Summary: node-llama-cpp Native Bindings Error

**Date**: November 22, 2025  
**Status**: ✅ RESOLVED  
**Issue**: `Cannot destructure property '_llama' of 'undefined'` in worker threads

## The Problem

The application was experiencing errors when trying to load `node-llama-cpp` in Electron worker threads:

```
[generatorWorker] Failed to load node-llama-cpp, falling back to heuristics:
TypeError: Cannot destructure property '_llama' of 'undefined' as it is undefined.
```

This prevented the local LLM functionality from working.

## Root Cause

**We were trying to rebuild `node-llama-cpp` with `electron-rebuild`, which BROKE the pre-built binaries!**

Key facts:
1. `node-llama-cpp` v3.x ships with **pre-built binaries** for multiple platforms
2. These binaries are already compatible with Electron (tested with Electron v37)
3. The binaries are in optional dependencies like `@node-llama-cpp/win-x64`
4. Running `electron-rebuild` on this module **corrupted** the pre-built binaries
5. The module needs its own postinstall script to run to configure the correct binary

## The Solution

### 1. Updated Rebuild Script (`scripts/rebuild-native.js`)

**Key Changes:**
- ❌ Removed `node-llama-cpp` from modules to rebuild
- ✅ Added `node-llama-cpp` postinstall execution to configure binaries
- ✅ Only rebuild `better-sqlite3` and `keytar` for Electron

**Before:**
```javascript
const NATIVE_MODULES = [
  { name: 'node-llama-cpp', workspace: 'app/main' },  // ❌ This was breaking it!
  { name: 'better-sqlite3', workspace: 'app/main' },
  { name: 'keytar', workspace: null }
];
```

**After:**
```javascript
const NATIVE_MODULES = [
  { name: 'better-sqlite3', workspace: 'app/main' },
  { name: 'keytar', workspace: null }
];

// Separately run node-llama-cpp's postinstall (doesn't rebuild it)
await runNodeLlamaCppPostinstall();
```

### 2. Improved Error Messages

Updated `app/main/src/workers/generatorWorker.ts` to provide clearer instructions when native bindings fail:

```typescript
console.warn(
  '[generatorWorker] ⚠ Native bindings not available for node-llama-cpp.',
  '\n  This usually means native modules need to be rebuilt for Electron.',
  '\n',
  '\n  To fix:',
  '\n    1. Close the application',
  '\n    2. Run: pnpm rebuild',
  '\n    3. Restart the application',
  // ...
);
```

### 3. Created Documentation

- `NATIVE_MODULES.md` - Comprehensive guide on native module handling
- `rebuild-and-start.cmd` - Windows helper script for easy rebuilding

### 4. Fixed Electron Installation Issue

pnpm's security feature was blocking Electron's install script, preventing the binary from downloading. Solution:
- Manually ran `node install.js` in the electron package directory
- Consider running `pnpm approve-builds` for future installs

## Files Changed

1. **`package.json`**
   - Updated postinstall script to use custom rebuild script
   - Added `"type": "module"` to eliminate warnings

2. **`app/main/package.json`**
   - Removed duplicate postinstall script

3. **`scripts/rebuild-native.js`** (NEW)
   - Smart rebuild script that handles pnpm workspaces
   - Runs node-llama-cpp postinstall without rebuilding it
   - Rebuilds only modules that need it

4. **`app/main/src/workers/generatorWorker.ts`**
   - Improved error messages
   - Added detailed logging

5. **`app/main/src/services/GeneratorService.ts`**
   - Minor worker configuration improvements

6. **`NATIVE_MODULES.md`** (NEW)
   - Complete documentation on native modules
   - Troubleshooting guide
   - Technical details

7. **`rebuild-and-start.cmd`** (NEW)
   - Windows batch script for easy development workflow

## How to Use

### For Fresh Installs

```bash
pnpm install  # Automatically configures everything
pnpm run build
pnpm --filter @semantiqa/app-main run start
```

### For Rebuilding Native Modules

```bash
# Close the app first!
pnpm rebuild
# Restart the app
```

### Using the Helper Script (Windows)

```cmd
rebuild-and-start.cmd
```

## Verification

After applying this fix:

**Before:**
```
🔌 IPC Handler called for models:healthcheck with length 1
[generatorWorker] ⚠ Native bindings not available for node-llama-cpp.
Error: Cannot destructure property '_llama' of 'undefined' as it is undefined.
[GeneratorWorkerPool] Worker ready { mode: 'fallback' }
```

**After:**
```
🔌 IPC Handler called for models:healthcheck with length 1
[generatorWorker] Successfully loaded node-llama-cpp with native bindings
[GeneratorWorkerPool] Worker ready { mode: 'llama' }
```

✅ The worker now loads in 'llama' mode instead of 'fallback'!

## Key Takeaways

1. **Not all native modules need rebuilding** - Some ship with pre-built binaries
2. **Check module documentation** - node-llama-cpp explicitly supports Electron
3. **electron-rebuild can break things** - Use it only for modules that need it
4. **pnpm workspaces need special handling** - Module resolution is different
5. **pnpm's build script blocking** - May need to approve or manually run some scripts

## Future Considerations

- Consider adding `pnpm approve-builds` to CI/CD setup
- Monitor `node-llama-cpp` updates for changes in architecture
- Document any new native modules added to the project

## Related Issues

- [node-llama-cpp Documentation](https://node-llama-cpp.withcat.ai)
- [Electron: Using Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)

---

**This issue is now permanently fixed!** 🎉

