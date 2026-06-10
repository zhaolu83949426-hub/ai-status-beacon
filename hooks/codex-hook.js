#!/usr/bin/env node
const { runHook } = require("./hook-runtime");

runHook("codex", {
  codexOfficial: true,
  permissionOutput: JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "no-decision" },
    },
  }),
});
