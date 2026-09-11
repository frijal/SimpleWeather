import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { AUTHORS, GITHASH } from "../dist/build/resource.js";

test("built resources include the Git hash and author credits", () => {
    const root = new URL("../", import.meta.url);
    const gitHash = execFileSync("git", [ "rev-parse", "--short", "HEAD" ], {
        cwd: root,
        encoding: "utf8"
    }).trim();
    const authors = readFileSync(new URL("AUTHORS", root), "utf8").replace(/\n+$/, "");

    assert.equal(GITHASH(), gitHash);
    assert.equal(AUTHORS(), authors);
});
