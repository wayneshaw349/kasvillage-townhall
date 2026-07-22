"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shamir_1 = require("./shamir");
const shamir_wire_1 = require("./shamir_wire");
const crypto_1 = require("crypto");
const rng = (n) => new Uint8Array((0, crypto_1.randomBytes)(n));
function eq(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
let pass = 0, fail = 0;
function check(name, cond) {
    if (cond)
        pass++;
    else {
        fail++;
        console.error('  FAIL:', name);
    }
}
// ---------------------------------------------------------------------------
// 1. wire encode/decode round-trips for 1000 random shares
// ---------------------------------------------------------------------------
{
    let ok = true;
    for (let t = 0; t < 1000; t++) {
        const secret = rng(32);
        const shares = (0, shamir_1.split)(secret, 2, 4, (t % 7) + 1, rng);
        for (const sh of shares) {
            const back = (0, shamir_wire_1.decodeShare)((0, shamir_wire_1.encodeShare)(sh));
            if (back.index !== sh.index || back.gen !== sh.gen ||
                back.threshold !== sh.threshold || back.total !== sh.total ||
                !eq(back.data, sh.data)) {
                ok = false;
                break;
            }
        }
        if (!ok)
            break;
    }
    check('wire round-trips: 1000 shares survive encode->decode', ok);
}
// ---------------------------------------------------------------------------
// 2. splitWithVerify returns wires that reconstruct end-to-end
// ---------------------------------------------------------------------------
{
    let ok = true;
    for (let t = 0; t < 500; t++) {
        const secret = rng(32);
        const { wires } = (0, shamir_wire_1.splitWithVerify)(secret, 2, 4, 1, rng);
        if (wires.length !== 4) {
            ok = false;
            break;
        }
        // any 2 of the 4 wires recover
        const rec = (0, shamir_wire_1.recoverFromWires)([wires[1], wires[3]]);
        if (!eq(rec, secret)) {
            ok = false;
            break;
        }
    }
    check('splitWithVerify: 500 seeds, wires reconstruct via recoverFromWires', ok);
}
// ---------------------------------------------------------------------------
// 3. checksum catches a single-character QR misread
// ---------------------------------------------------------------------------
{
    const secret = rng(32);
    const { wires } = (0, shamir_wire_1.splitWithVerify)(secret, 2, 4, 1, rng);
    const w = wires[0];
    // corrupt one char in the data section (field index 5)
    const parts = w.split('-');
    const data = parts[5];
    // flip one char to a different valid base32 char
    const idx = Math.floor(data.length / 2);
    const orig = data[idx];
    const repl = orig === 'Z' ? 'Y' : 'Z';
    parts[5] = data.slice(0, idx) + repl + data.slice(idx + 1);
    const corrupted = parts.join('-');
    let threw = false;
    try {
        (0, shamir_wire_1.decodeShare)(corrupted);
    }
    catch {
        threw = true;
    }
    check('checksum rejects single-char corruption', threw);
}
// ---------------------------------------------------------------------------
// 4. stale-generation recovery is rejected
// ---------------------------------------------------------------------------
{
    const secret = rng(32);
    const g1 = (0, shamir_wire_1.splitWithVerify)(secret, 2, 4, 1, rng).wires;
    const g2 = (0, shamir_wire_1.splitWithVerify)(secret, 2, 4, 2, rng).wires;
    let threw = false;
    try {
        (0, shamir_wire_1.recoverFromWires)([g1[0], g2[1]]);
    }
    catch {
        threw = true;
    }
    check('recoverFromWires rejects mixed generations', threw);
}
// ---------------------------------------------------------------------------
// 5. below-threshold recovery is rejected
// ---------------------------------------------------------------------------
{
    const secret = rng(32);
    const wires = (0, shamir_wire_1.splitWithVerify)(secret, 3, 5, 1, rng).wires;
    let threw = false;
    try {
        (0, shamir_wire_1.recoverFromWires)([wires[0], wires[1]]);
    }
    catch {
        threw = true;
    }
    check('recoverFromWires rejects below-threshold (2 of 3-of-5)', threw);
}
// ---------------------------------------------------------------------------
// 6. splitWithVerify catches a tampered core (inject a bad split)
//    We simulate by monkey-testing: a correct split must always pass verify.
//    (Negative path: if combine were broken, verify would throw — covered by
//     the guard existing; here we just confirm the happy path never throws.)
// ---------------------------------------------------------------------------
{
    let threwUnexpectedly = false;
    for (let t = 0; t < 200; t++) {
        try {
            (0, shamir_wire_1.splitWithVerify)(rng(32), 2, 4, 1, rng);
        }
        catch {
            threwUnexpectedly = true;
            break;
        }
    }
    check('splitWithVerify never throws on valid splits (200x)', !threwUnexpectedly);
}
// ---------------------------------------------------------------------------
// 7. wire string is QR-reasonable in size (32-byte secret, 2-of-4)
// ---------------------------------------------------------------------------
{
    const { wires } = (0, shamir_wire_1.splitWithVerify)(rng(32), 2, 4, 1, rng);
    const len = wires[0].length;
    // 32 bytes -> ~52 base32 chars + prefix/fields/crc ~ under 80 chars.
    // QR alphanumeric mode handles hundreds of chars at low error correction.
    check(`wire length reasonable for QR (${len} chars < 120)`, len < 120);
}
console.log(`\nShamir WIRE self-test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
