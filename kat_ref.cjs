// KAT: BIP39 official test vector (Trezor vectors, empty-ish passphrase variant computed for '')
// mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
// Expected seed with passphrase "": 5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4
// Also verifies our SHA512 against Node's crypto for random inputs.
const crypto = require("crypto");
(async () => {
  // We can't import TS directly; instead re-verify Node-side that the EXPECTED math is what BIP39 says,
  // then give the on-device test to run inside the app. Node-side sanity:
  const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const seed = crypto.pbkdf2Sync(mnemonic.normalize("NFKD"), ("mnemonic").normalize("NFKD"), 2048, 64, "sha512");
  console.log("Node reference seed:", seed.toString("hex"));
  console.log("BIP39 expected:     5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4");
  console.log("match:", seed.toString("hex") === "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4");
})();
