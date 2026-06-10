#!/usr/bin/env node
const { runHook } = require("./hook-runtime");

runHook("qwen-code", { permissionOutput: "{}" });
