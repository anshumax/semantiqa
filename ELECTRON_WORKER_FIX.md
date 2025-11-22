# Electron Worker Thread Issue with node-llama-cpp

## Current Status: ⚠️ PARTIALLY RESOLVED

The error "Cannot destructure property '_llama' of 'undefined'" persists because:

**Root Cause:** `node-llama-cpp` doesn't officially support Node.js worker threads in Electron.

From the [official documentation](https://node-llama-cpp.withcat.ai/guide/electron):
> "You can only use `node-llama-cpp` on the main process in Electron applications."

## Why This Happens

1. **Worker Threads**: Our `GeneratorService` uses Node.js worker threads for async LLM operations
2. **Native Bindings**: `node-llama-cpp` loads native `.node` addons that aren't initialized properly in workers
3. **Electron Restrictions**: Electron's worker thread environment has limitations with native modules

## Current Workaround

The app **works** but uses **fallback heuristics** instead of the actual LLM:
- Summarization: Returns first 2-3 sentences
- SQL Generation: Returns template SQL  
- NL Queries: Returns generic query plans

This is acceptable for development and allows the app to function without crashes.

## Permanent Solutions (Choose One)

### Option 1: Refactor to Main Process (Recommended)

**Pros:**
- Officially supported by node-llama-cpp
- Guaranteed to work
- Module handles threading internally

**Cons:**
- Requires architectural changes
- Main process becomes more loaded
- More complex IPC communication

**Implementation:**
1. Remove worker thread pool from `GeneratorService`
2. Use node-llama-cpp directly in main process
3. Make all generator methods async
4. Let node-llama-cpp manage its own threads

### Option 2: Use Alternative LLM Library

Consider libraries that explicitly support worker threads:
- `@mlc-ai/web-llm` - WebGPU-based, works in workers
- `transformers.js` - ONNX-based, worker-friendly
- Remote API (Ollama, LM Studio) - No native modules

### Option 3: Accept Fallback Mode

Keep current architecture, document that LLM features require:
- Manual setup
- External LLM service
- Future refactor

## Recommended Next Steps

1. **For Now**: Document that LLM features use heuristics
2. **Short Term**: Add configuration for external LLM API (Ollama/LM Studio)
3. **Long Term**: Refactor to Option 1 when LLM features become critical

## Technical Details

### Why Pre-built Binaries Don't Help

- Pre-built binaries work in the main process
- Worker threads have different module resolution
- Native addon initialization fails in worker context
- No amount of rebuilding will fix this

### What We Tried

✅ Stopped rebuilding node-llama-cpp (was breaking pre-built binaries)  
✅ Ensured pre-built binaries are properly installed  
✅ Fixed other native modules (better-sqlite3, keytar)  
❌ Attempted to use node-llama-cpp in worker threads (not supported)

## Code References

- **Worker Implementation**: `app/main/src/workers/generatorWorker.ts`
- **Service**: `app/main/src/services/GeneratorService.ts`
- **Fallback Logic**: Already implemented in `generatorWorker.ts`

## Decision Required

Please decide which option to pursue:
- [ ] Option 1: Refactor to main process
- [ ] Option 2: Use alternative library
- [ ] Option 3: Accept fallback mode for now

Current status: **Option 3 (Fallback Mode)** - App is functional, LLM features pending.

