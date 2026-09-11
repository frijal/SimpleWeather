import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const Orientation = { HORIZONTAL: 0, VERTICAL: 1 };
type BoxProps = { orientation?: number; vertical?: boolean };

const source = readFileSync(new URL("../dist/build/clutterutils.js", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
});

for(const [ name, supported ] of [
    [ "legacy", [ "vertical" ] ],
    [ "transitional", [ "vertical", "orientation" ] ],
    [ "modern", [ "orientation" ] ]
] as const) {
    test(`box orientation supports both axes on ${name} GNOME Shell`, () => {
        class BoxLayout {
            readonly isVertical: boolean;

            constructor(props: BoxProps) {
                for(const property of Object.keys(props)) {
                    assert.ok((supported as readonly string[]).includes(property),
                        `Unsupported BoxLayout property: ${property}`);
                }
                this.isVertical = "orientation" in props
                    ? props.orientation === Orientation.VERTICAL
                    : props.vertical === true;
            }
        }
        for(const property of supported) {
            Object.defineProperty(BoxLayout.prototype, property, { value: 0 });
        }

        const gi: Record<string, unknown> = {
            "gi://Clutter": { Orientation },
            "gi://Meta": {},
            "gi://St": { BoxLayout }
        };
        const exports: { boxOrientation?: (orientation: number) => BoxProps } = {};
        runInNewContext(outputText, {
            exports,
            require(specifier: string) {
                assert.ok(specifier in gi, `Unexpected import: ${specifier}`);
                return { default: gi[specifier] };
            }
        });
        assert.equal(typeof exports.boxOrientation, "function");

        for(const orientation of Object.values(Orientation)) {
            const props = exports.boxOrientation!(orientation);
            const expected = name === "legacy"
                ? { vertical: orientation === Orientation.VERTICAL }
                : { orientation };
            assert.deepStrictEqual({ ...props }, expected);
            assert.equal(new BoxLayout(props).isVertical, orientation === Orientation.VERTICAL);
        }
    });
}
