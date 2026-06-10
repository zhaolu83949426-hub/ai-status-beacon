#!/usr/bin/env node
const { runHook } = require("./hook-runtime");

runHook("gemini-cli", { stateOutput: "{}" });
