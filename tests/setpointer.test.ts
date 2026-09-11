import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Widget = {
    connect(signal: string, callback: () => void): void;
    set_cursor_type?(cursor: number): void;
};

const source = readFileSync(new URL("../dist/build/clutterutils.js", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
});

function loadSetPointer(Clutter: unknown, Meta: unknown, display: unknown) {
    const gi: Record<string, unknown> = {
        "gi://Clutter": Clutter,
        "gi://Meta": Meta,
        "gi://St": {}
    };
    const exports: { setPointer?: (widget: Widget) => void } = {};
    runInNewContext(outputText, {
        exports,
        global: { display },
        require(specifier: string) {
            assert.ok(specifier in gi, `Unexpected import: ${specifier}`);
            return { default: gi[specifier] };
        }
    });
    assert.equal(typeof exports.setPointer, "function");
    return exports.setPointer!;
}

// Cursor values from upstream Mutter src/meta/meta-enums.h for each version:
// https://github.com/GNOME/mutter/blob/gnome-46/src/meta/meta-enums.h
// https://github.com/GNOME/mutter/blob/gnome-47/src/meta/meta-enums.h
// https://github.com/GNOME/mutter/blob/48.0/src/meta/meta-enums.h
// https://github.com/GNOME/mutter/blob/49.0/src/meta/meta-enums.h
for(const [ version, Cursor, pointer ] of [
    [ 46, { DEFAULT: 1, EAST_RESIZE: 5, POINTING_HAND: 16 }, 16 ],
    [ 47, { DEFAULT: 1, EAST_RESIZE: 5, POINTING_HAND: 16 }, 16 ],
    [ 48, { DEFAULT: 2, POINTER: 5 }, 5 ],
    [ 49, { DEFAULT: 2, POINTER: 5 }, 5 ]
] as const) {
    test(`pointer cursor enters and resets on GNOME ${version}`, () => {
        const cursors: number[] = [];
        const handlers = new Map<string, () => void>();
        const setPointer = loadSetPointer({}, { Cursor }, {
            set_cursor(cursor: number) { cursors.push(cursor); }
        });
        setPointer({
            connect(signal, callback) { handlers.set(signal, callback); }
        });

        assert.deepStrictEqual(cursors, []);
        for(let hover = 0; hover < 2; hover++) {
            handlers.get("enter-event")!();
            assert.equal(cursors.at(-1), pointer);
            handlers.get("leave-event")!();
            assert.equal(cursors.at(-1), Cursor.DEFAULT);
        }
    });
}

test("GNOME 50+ uses the actor pointer cursor without display event handlers", () => {
    const cursors: number[] = [];
    const setPointer = loadSetPointer({ CursorType: { POINTER: 5 } }, {}, {
        set_cursor() { assert.fail("Actor cursors should not set the display cursor"); }
    });
    setPointer({
        connect() { assert.fail("Actor cursors should not connect hover handlers"); },
        set_cursor_type(cursor) { cursors.push(cursor); }
    });
    assert.deepStrictEqual(cursors, [ 5 ]);
});
