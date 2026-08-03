import { SHIGURE_MANIFEST, validateManifest } from "../src/manifest";

const violations = validateManifest(SHIGURE_MANIFEST);
if (violations.length > 0) {
  console.error("FAIL: asset manifest validation failed");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("PASS: asset manifest validation passed");
}
