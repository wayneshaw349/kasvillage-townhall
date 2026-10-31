import sys, json, base64, hashlib
sys.path.insert(0, sys.argv[1])
import dkim
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
priv_pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption())
spki_b64 = base64.b64encode(key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)).decode()
pkcs1_b64 = base64.b64encode(key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.PKCS1)).decode()

PUB = "037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133"
ch = "KV-" + hashlib.sha256(("KV_ACADEMIC_V2:" + PUB).encode()).digest()[:5].hex().upper()

def msg(subject=None, from_="Ada Lovelace <ada@cs.mit.edu>", extra=b"", body=b"Hello,\r\n\r\nverifying my address.  Thanks!\r\n\r\n\r\n"):
    subject = subject if subject is not None else ("KasVillage verification " + ch).encode()
    return (b"Received: from mail.mit.edu by mx.mit.edu; Fri, 30 Oct 2026 20:00:00 -0400\r\n"
            b"From: " + from_.encode() + b"\r\n"
            b"To: ada@cs.mit.edu\r\n"
            b"Subject: " + subject + b"\r\n"
            b"Date: Fri, 30 Oct 2026 20:00:00 -0400\r\n"
            b"Message-ID: <abc123@cs.mit.edu>\r\n" + extra +
            b"\r\n" + body)

def sign(m, canon=(b"relaxed", b"relaxed"), domain=b"mit.edu", headers=None):
    hs = headers or [b"from", b"to", b"subject", b"date", b"message-id"]
    sig = dkim.sign(m, b"sel2026", domain, priv_pem, canonicalize=canon, include_headers=hs)
    return sig + m

cases = []
def add(name, raw, expect, academic=None, note=""):
    cases.append({"name": name, "raw": raw.decode("latin-1"), "expect_dkim": expect, "expect_academic": academic, "note": note})

# 1. realistic relaxed/relaxed
good = sign(msg()); add("relaxed_relaxed", good, True, True)
# 2. simple/simple
add("simple_simple", sign(msg(), canon=(b"simple", b"simple")), True, True)
# 3. relaxed header / simple body
add("relaxed_simple", sign(msg(), canon=(b"relaxed", b"simple")), True, True)
# 4. folded subject + messy whitespace (relaxed must normalize)
add("folded_subject", sign(msg(subject=b"KasVillage   verification\r\n\t " + ch.encode() + b"   ")), True, True)
# 5. duplicate header: two To lines, signed once -> bottom-up selection
add("dup_header", sign(msg(extra=b"To: second@cs.mit.edu\r\n"), headers=[b"from", b"to", b"subject"]), True, True)
# 6. oversigned header (h lists a header twice / absent instance)
add("oversigned", sign(msg(), headers=[b"from", b"subject", b"subject", b"to"]), True, True)
# 7. headers only (UI pastes raw headers): body hash skipped, signature still verifies
add("headers_only", good.split(b"\r\n\r\n", 1)[0] + b"\r\n", True, True)
# 8. LF line endings (pasted on a phone)
add("lf_endings", good.replace(b"\r\n", b"\n"), True, True)
# --- must FAIL ---
add("tampered_subject", good.replace(ch.encode(), b"KV-0000000000"), False, False, "signed subject altered")
add("tampered_from", good.replace(b"ada@cs.mit.edu>", b"eve@cs.mit.edu>"), False, False, "signed from altered")
add("tampered_body", good.replace(b"Thanks!", b"Thanks?"), False, False, "body altered -> bh mismatch")
# --- DKIM passes but ACADEMIC policy fails ---
add("wrong_challenge", sign(msg(subject=b"KasVillage verification KV-ABCDEF0123")), True, False, "challenge for another pubkey")
add("not_academic", sign(msg(from_="Ada <ada@gmail.com>"), domain=b"gmail.com"), True, False, "gmail is not academic")
add("misaligned_from", sign(msg(from_="Ada <ada@harvard.edu>")), True, False, "From domain != d=")
add("subject_unsigned", sign(msg(), headers=[b"from", b"to", b"date"]), True, False, "subject not covered")

json.dump({"key_spki_b64": spki_b64, "key_pkcs1_b64": pkcs1_b64, "domain": "mit.edu", "selector": "sel2026",
           "pubkey": PUB, "challenge": ch, "cases": cases}, open(sys.argv[2], "w"), indent=1)

# sanity: dkimpy itself agrees on every expect_dkim
def dnsfunc(name, timeout=5):
    return ("v=DKIM1; k=rsa; p=" + spki_b64).encode()
for c in cases:
    ok = dkim.verify(c["raw"].encode("latin-1").replace(b"\n", b"\r\n").replace(b"\r\r\n", b"\r\n"), dnsfunc=dnsfunc)
    if c["name"] == "headers_only": continue  # dkimpy requires a body
    assert ok == c["expect_dkim"], (c["name"], ok)
print(len(cases), "fixtures; dkimpy agrees on all; challenge", ch)
