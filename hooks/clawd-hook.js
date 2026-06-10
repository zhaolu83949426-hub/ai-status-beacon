#!/usr/bin/env node
const { runHook } = require("./hook-runtime");

runHook("claude-code", { stateOutput: "" });
