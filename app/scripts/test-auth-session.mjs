import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/auth/session.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
const auth = await import(moduleUrl);

assert.equal(auth.SHARED_PASSWORD, "govimo2026");
assert.deepEqual(
  auth.USERS.map((user) => user.name),
  ["Michael", "Felipe", "Federico"],
);

const michael = auth.authenticateUser("Michael", "govimo2026");
assert.equal(michael?.name, "Michael");
assert.equal(michael?.role, "AXIO Builder");

assert.equal(auth.authenticateUser("Michael", "wrong"), null);
assert.equal(auth.authenticateUser("Unknown", "govimo2026"), null);

const serialized = auth.serializeSession(michael);
assert.deepEqual(auth.restoreSession(serialized), michael);
assert.equal(auth.restoreSession("not-json"), null);
assert.equal(auth.restoreSession(JSON.stringify({ name: "Unknown" })), null);
