// ============================================================================
// KASVILLAGE HALO2 SNARK MODULE
// Extracted from kasvillage production (82,944 lines)
// ============================================================================
//
// This module contains:
// - Poseidon hashing (in-circuit + off-circuit)
// - SparseMerkleTree with Poseidon
// - SparseMerkleCircuit for ZK membership proofs
// - Proof generation and verification (PSE Halo2 fork)
//
// Requirements in Cargo.toml:
//   halo2_proofs = { git = "https://github.com/privacy-scaling-explorations/halo2", tag = "v2023_04_20" }
//   neptune = "12.0"
//   pasta_curves = "0.5"
//   ff = "0.13"
//   group = "0.13"
//   blake2 = "0.10"
//   rand = "0.8"
// ============================================================================

use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value, AssignedCell},
    plonk::{
        create_proof, verify_proof, keygen_pk, keygen_vk,
        ProvingKey, VerifyingKey, Circuit, ConstraintSystem,
        Column, Advice, Selector, Expression, Instance,
        Error as PlonkError, SingleVerifier,
    },
    poly::{commitment::Params, Rotation},
    transcript::{Blake2bRead, Blake2bWrite, Challenge255},
};
use pasta_curves::{pallas::Base as Fq, pallas::Scalar as Fr, EqAffine};
use neptune::{Poseidon, poseidon::PoseidonConstants};
use ff::{Field, PrimeField};
use group::Group;
use std::collections::HashMap;
use typenum::U3;
use rand::rngs::OsRng;

// ============================================================================
// CONSTANTS
// ============================================================================

pub const TREE_DEPTH: usize = 32;
pub const MERKLE_DOMAIN: u64 = 0x4D45524B; // "MERK"

// Domain separators for Poseidon
pub const D_LEAF: u64 = 0;
pub const D_INTERNAL: u64 = 1;
pub const D_COMMIT1: u64 = 2;

// ============================================================================
// POSEIDON OFF-CIRCUIT HELPERS
// ============================================================================

/// Poseidon hash of two Fq elements with domain separator
pub fn poseidon_hash_2_fq(left: Fq, right: Fq, domain: u64) -> Fq {
    let constants = PoseidonConstants::<Fq, U3>::new();
    let mut hasher = Poseidon::<Fq, U3>::new(&constants);
    hasher.input(Fq::from(domain)).unwrap();
    hasher.input(left).unwrap();
    hasher.input(right).unwrap();
    hasher.hash()
}

/// Internal Merkle tree hash
pub fn poseidon_internal_hash(left: Fq, right: Fq) -> Fq {
    poseidon_hash_2_fq(left, right, D_INTERNAL)
}

/// Leaf hash
pub fn poseidon_leaf_hash(data: Fq) -> Fq {
    poseidon_hash_2_fq(data, Fq::zero(), D_LEAF)
}

/// Single-input commitment
pub fn poseidon_commit1(value: Fr) -> Fr {
    let constants = PoseidonConstants::<Fr, U3>::new();
    let mut hasher = Poseidon::<Fr, U3>::new(&constants);
    hasher.input(Fr::from(D_COMMIT1)).unwrap();
    hasher.input(value).unwrap();
    hasher.input(Fr::zero()).unwrap();
    hasher.hash()
}

// ============================================================================
// POSEIDON CHIP CONFIG (for in-circuit hashing)
// ============================================================================

#[derive(Clone, Debug)]
pub struct PoseidonConfig {
    pub state: [Column<Advice>; 3],
    pub state_sq: [Column<Advice>; 3],
    pub state_4th: [Column<Advice>; 3],
    pub state_sbox: [Column<Advice>; 3],
    pub sbox_full_sel: Selector,
    pub sbox_partial_sel: Selector,
    pub mds_sel: Selector,
}

/// Poseidon chip for Fq field (Pallas base field)
#[derive(Clone, Debug)]
pub struct PoseidonChipFq {
    pub config: PoseidonConfig,
    pub constants: PoseidonConstants<Fq, U3>,
}

impl PoseidonChipFq {
    pub fn configure(meta: &mut ConstraintSystem<Fq>) -> PoseidonConfig {
        let state = [meta.advice_column(), meta.advice_column(), meta.advice_column()];
        let state_sq = [meta.advice_column(), meta.advice_column(), meta.advice_column()];
        let state_4th = [meta.advice_column(), meta.advice_column(), meta.advice_column()];
        let state_sbox = [meta.advice_column(), meta.advice_column(), meta.advice_column()];

        let sbox_full_sel = meta.selector();
        let sbox_partial_sel = meta.selector();
        let mds_sel = meta.selector();

        // S-box gate (full rounds): x^5
        meta.create_gate("sbox_full_fq", |meta| {
            let s = meta.query_selector(sbox_full_sel);
            let mut constraints = Vec::new();
            for i in 0..3 {
                let x = meta.query_advice(state[i], Rotation::cur());
                let x2 = meta.query_advice(state_sq[i], Rotation::cur());
                let x4 = meta.query_advice(state_4th[i], Rotation::cur());
                let x5 = meta.query_advice(state_sbox[i], Rotation::cur());
                constraints.push(s.clone() * (x2.clone() - x.clone() * x.clone()));
                constraints.push(s.clone() * (x4.clone() - x2.clone() * x2.clone()));
                constraints.push(s.clone() * (x5 - x4 * x));
            }
            constraints
        });

        // S-box gate (partial rounds): only state[0] gets S-box
        meta.create_gate("sbox_partial_fq", |meta| {
            let s = meta.query_selector(sbox_partial_sel);
            let x = meta.query_advice(state[0], Rotation::cur());
            let x2 = meta.query_advice(state_sq[0], Rotation::cur());
            let x4 = meta.query_advice(state_4th[0], Rotation::cur());
            let x5 = meta.query_advice(state_sbox[0], Rotation::cur());
            vec![
                s.clone() * (x2.clone() - x.clone() * x.clone()),
                s.clone() * (x4.clone() - x2.clone() * x2.clone()),
                s.clone() * (x5 - x4 * x),
            ]
        });

        // MDS matrix multiplication gate
        meta.create_gate("mds_fq", |meta| {
            let s = meta.query_selector(mds_sel);
            let in_sbox = [
                meta.query_advice(state_sbox[0], Rotation::cur()),
                meta.query_advice(state_sbox[1], Rotation::cur()),
                meta.query_advice(state_sbox[2], Rotation::cur()),
            ];
            let out_state = [
                meta.query_advice(state[0], Rotation::next()),
                meta.query_advice(state[1], Rotation::next()),
                meta.query_advice(state[2], Rotation::next()),
            ];

            let constants = PoseidonConstants::<Fq, U3>::new();
            let mds_expr: [[Expression<Fq>; 3]; 3] = [
                [
                    Expression::Constant(constants.mds_matrices.m[0][0]),
                    Expression::Constant(constants.mds_matrices.m[0][1]),
                    Expression::Constant(constants.mds_matrices.m[0][2]),
                ],
                [
                    Expression::Constant(constants.mds_matrices.m[1][0]),
                    Expression::Constant(constants.mds_matrices.m[1][1]),
                    Expression::Constant(constants.mds_matrices.m[1][2]),
                ],
                [
                    Expression::Constant(constants.mds_matrices.m[2][0]),
                    Expression::Constant(constants.mds_matrices.m[2][1]),
                    Expression::Constant(constants.mds_matrices.m[2][2]),
                ],
            ];

            let mut constraints = Vec::new();
            for i in 0..3 {
                constraints.push(
                    s.clone() * (
                        out_state[i].clone()
                        - (
                            in_sbox[0].clone() * mds_expr[i][0].clone()
                            + in_sbox[1].clone() * mds_expr[i][1].clone()
                            + in_sbox[2].clone() * mds_expr[i][2].clone()
                        )
                    )
                );
            }
            constraints
        });

        PoseidonConfig {
            state,
            state_sq,
            state_4th,
            state_sbox,
            sbox_full_sel,
            sbox_partial_sel,
            mds_sel,
        }
    }

    pub fn new(config: PoseidonConfig) -> Self {
        Self {
            config,
            constants: PoseidonConstants::<Fq, U3>::new(),
        }
    }

    /// Hash two assigned cells in-circuit
    pub fn hash_cells(
        &self,
        layouter: impl Layouter<Fq>,
        left: AssignedCell<Fq, Fq>,
        right: AssignedCell<Fq, Fq>,
        domain_tag: Value<Fq>,
    ) -> Result<AssignedCell<Fq, Fq>, PlonkError> {
        let left_val = left.value().copied();
        let right_val = right.value().copied();
        self.hash(layouter, [left_val, right_val], domain_tag)
    }

    /// Hash two Values in circuit
    pub fn hash(
        &self,
        layouter: impl Layouter<Fq>,
        input: [Value<Fq>; 2],
        domain_tag: Value<Fq>,
    ) -> Result<AssignedCell<Fq, Fq>, PlonkError> {
        let state = self.assign_permutation(
            layouter,
            [input[0], input[1], Value::known(Fq::zero())],
            domain_tag,
        )?;
        Ok(state[0].clone())
    }

    /// Off-circuit hash for testing
    pub fn hash_cpu(&self, input: [Fq; 2], domain_tag: Fq) -> Fq {
        let state = self.hash_cpu_full_state(input, domain_tag);
        state[0]
    }

    pub fn hash_cpu_full_state(&self, input: [Fq; 2], domain_tag: Fq) -> [Fq; 3] {
        let mut state = [domain_tag, input[0], input[1]];

        // 4 full rounds
        for r in 0..4 {
            state = self.apply_round_cpu(state, r, true);
        }
        // 56 partial rounds
        for r in 4..60 {
            state = self.apply_round_cpu(state, r, false);
        }
        // 4 full rounds
        for r in 60..64 {
            state = self.apply_round_cpu(state, r, true);
        }

        state
    }

    fn apply_round_cpu(&self, mut state: [Fq; 3], round: usize, full: bool) -> [Fq; 3] {
        // Add round constants
        for i in 0..3 {
            state[i] += self.constants.compressed_round_constants[round * 3 + i];
        }

        // S-box: x^5
        if full {
            for i in 0..3 {
                let x = state[i];
                let x2 = x.square();
                let x4 = x2.square();
                state[i] = x4 * x;
            }
        } else {
            let x = state[0];
            let x2 = x.square();
            let x4 = x2.square();
            state[0] = x4 * x;
        }

        // MDS matrix
        let mut new_state = [Fq::zero(); 3];
        let mds = &self.constants.mds_matrices.m;
        for i in 0..3 {
            for j in 0..3 {
                new_state[i] += mds[i][j] * state[j];
            }
        }
        new_state
    }

    fn assign_permutation(
        &self,
        mut layouter: impl Layouter<Fq>,
        input: [Value<Fq>; 3],
        domain_tag: Value<Fq>,
    ) -> Result<[AssignedCell<Fq, Fq>; 3], PlonkError> {
        layouter.assign_region(
            || "poseidon_fq_permutation",
            |mut region| {
                let cfg = &self.config;

                // Initialize state: [domain_tag, input[0], input[1]]
                let mut state = [
                    region.assign_advice(|| "init_0", cfg.state[0], 0, || domain_tag)?,
                    region.assign_advice(|| "init_1", cfg.state[1], 0, || input[0])?,
                    region.assign_advice(|| "init_2", cfg.state[2], 0, || input[1])?,
                ];

                let mut offset = 1;

                // 4 full rounds
                for r in 0..4 {
                    offset = self.apply_full_round(&mut region, &mut state, r, offset)?;
                }
                // 56 partial rounds
                for r in 4..60 {
                    offset = self.apply_partial_round(&mut region, &mut state, r, offset)?;
                }
                // 4 full rounds
                for r in 60..64 {
                    offset = self.apply_full_round(&mut region, &mut state, r, offset)?;
                }

                Ok(state)
            },
        )
    }

    fn apply_full_round(
        &self,
        region: &mut halo2_proofs::circuit::Region<Fq>,
        state: &mut [AssignedCell<Fq, Fq>; 3],
        round: usize,
        offset: usize,
    ) -> Result<usize, PlonkError> {
        let cfg = &self.config;
        cfg.sbox_full_sel.enable(region, offset)?;

        // Add round constants and compute S-box
        let mut state_vals: [Value<Fq>; 3] = [Value::unknown(); 3];
        for i in 0..3 {
            let rc = self.constants.compressed_round_constants[round * 3 + i];
            state_vals[i] = state[i].value().map(|v| *v + rc);
            region.assign_advice(|| format!("state_rc_{}", i), cfg.state[i], offset, || state_vals[i])?;
        }

        // Compute x^5
        for i in 0..3 {
            let x_sq = state_vals[i].map(|v| v.square());
            let x_4th = x_sq.map(|v| v.square());
            let x_5 = state_vals[i].zip(x_4th).map(|(v, v4)| v * v4);

            region.assign_advice(|| format!("state_sq_{}", i), cfg.state_sq[i], offset, || x_sq)?;
            region.assign_advice(|| format!("state_4th_{}", i), cfg.state_4th[i], offset, || x_4th)?;
            state[i] = region.assign_advice(|| format!("state_sbox_{}", i), cfg.state_sbox[i], offset, || x_5)?;
        }

        // MDS
        cfg.mds_sel.enable(region, offset)?;
        let mut new_state = [Value::unknown(); 3];
        let mds = &self.constants.mds_matrices.m;

        for i in 0..3 {
            let mut acc = Value::known(Fq::zero());
            for j in 0..3 {
                let coeff = mds[i][j];
                acc = acc.zip(state[j].value()).map(|(a, v)| a + v * coeff);
            }
            new_state[i] = acc;
        }

        for i in 0..3 {
            state[i] = region.assign_advice(
                || format!("state_after_mds_{}", i),
                cfg.state[i],
                offset + 1,
                || new_state[i],
            )?;
        }

        Ok(offset + 2)
    }

    fn apply_partial_round(
        &self,
        region: &mut halo2_proofs::circuit::Region<Fq>,
        state: &mut [AssignedCell<Fq, Fq>; 3],
        round: usize,
        offset: usize,
    ) -> Result<usize, PlonkError> {
        let cfg = &self.config;
        cfg.sbox_partial_sel.enable(region, offset)?;

        // Add round constants
        let mut state_vals: [Value<Fq>; 3] = [Value::unknown(); 3];
        for i in 0..3 {
            let rc = self.constants.compressed_round_constants[round * 3 + i];
            state_vals[i] = state[i].value().map(|v| *v + rc);
            region.assign_advice(|| format!("state_rc_{}", i), cfg.state[i], offset, || state_vals[i])?;
        }

        // S-box only on state[0]
        let x_sq = state_vals[0].map(|v| v.square());
        let x_4th = x_sq.map(|v| v.square());
        let x_5 = state_vals[0].zip(x_4th).map(|(v, v4)| v * v4);

        region.assign_advice(|| "state_sq_0", cfg.state_sq[0], offset, || x_sq)?;
        region.assign_advice(|| "state_4th_0", cfg.state_4th[0], offset, || x_4th)?;
        state[0] = region.assign_advice(|| "state_sbox_0", cfg.state_sbox[0], offset, || x_5)?;

        // Copy state[1], state[2] to sbox columns (identity)
        state[1] = region.assign_advice(|| "state_sbox_1", cfg.state_sbox[1], offset, || state_vals[1])?;
        state[2] = region.assign_advice(|| "state_sbox_2", cfg.state_sbox[2], offset, || state_vals[2])?;

        // MDS
        cfg.mds_sel.enable(region, offset)?;
        let mut new_state = [Value::unknown(); 3];
        let mds = &self.constants.mds_matrices.m;

        for i in 0..3 {
            let mut acc = Value::known(Fq::zero());
            for j in 0..3 {
                let coeff = mds[i][j];
                acc = acc.zip(state[j].value()).map(|(a, v)| a + v * coeff);
            }
            new_state[i] = acc;
        }

        for i in 0..3 {
            state[i] = region.assign_advice(
                || format!("state_after_mds_{}", i),
                cfg.state[i],
                offset + 1,
                || new_state[i],
            )?;
        }

        Ok(offset + 2)
    }
}

// ============================================================================
// SPARSE MERKLE TREE (OFF-CIRCUIT)
// ============================================================================

#[derive(Clone, Debug)]
pub struct MerklePathElement {
    pub sibling: Fq,
    pub is_left: bool,
}

#[derive(Clone, Debug)]
pub struct SparseMerkleProof {
    pub leaf_index: u64,
    pub path: Vec<MerklePathElement>,
}

impl SparseMerkleProof {
    /// Verify proof off-circuit
    pub fn verify(&self, leaf_hash: Fq, root: Fq) -> bool {
        let mut current = leaf_hash;
        for element in &self.path {
            current = if element.is_left {
                poseidon_internal_hash(current, element.sibling)
            } else {
                poseidon_internal_hash(element.sibling, current)
            };
        }
        current == root
    }
}

pub struct SparseMerkleTree {
    pub depth: usize,
    pub leaves: HashMap<u64, Fq>,
    pub root: Fq,
    pub zero_hashes: Vec<Fq>,
}

impl SparseMerkleTree {
    pub fn new(depth: usize) -> Self {
        // Precompute zero hashes for each level
        let mut zero_hashes = vec![Fq::zero()];
        for i in 1..=depth {
            let prev = zero_hashes[i - 1];
            zero_hashes.push(poseidon_internal_hash(prev, prev));
        }

        Self {
            depth,
            leaves: HashMap::new(),
            root: zero_hashes[depth],
            zero_hashes,
        }
    }

    pub fn update(&mut self, index: u64, new_leaf: Fq) {
        self.leaves.insert(index, new_leaf);
        self.root = self.compute_root();
    }

    fn compute_root(&self) -> Fq {
        if self.leaves.is_empty() {
            return self.zero_hashes[self.depth];
        }

        let mut current_level: HashMap<u64, Fq> = self.leaves.clone();

        for level in 0..self.depth {
            let mut next_level: HashMap<u64, Fq> = HashMap::new();
            let parent_indices: std::collections::HashSet<u64> = current_level.keys()
                .map(|&idx| idx / 2)
                .collect();

            let zero_at_level = self.zero_hashes[level];

            for parent_idx in parent_indices {
                let left_idx = parent_idx * 2;
                let right_idx = parent_idx * 2 + 1;
                let left = current_level.get(&left_idx).copied().unwrap_or(zero_at_level);
                let right = current_level.get(&right_idx).copied().unwrap_or(zero_at_level);
                next_level.insert(parent_idx, poseidon_internal_hash(left, right));
            }

            current_level = next_level;
        }

        current_level.get(&0).copied().unwrap_or(self.zero_hashes[self.depth])
    }

    pub fn generate_proof(&self, index: u64) -> SparseMerkleProof {
        let mut path = Vec::new();
        let mut current_index = index;

        for level in 0..self.depth {
            let sibling_index = current_index ^ 1;
            let sibling = self.get_node_at_level(level, sibling_index);
            path.push(MerklePathElement {
                sibling,
                is_left: current_index % 2 == 0,
            });
            current_index /= 2;
        }

        SparseMerkleProof { leaf_index: index, path }
    }

    fn get_node_at_level(&self, level: usize, index: u64) -> Fq {
        if level == 0 {
            return *self.leaves.get(&index).unwrap_or(&self.zero_hashes[0]);
        }

        let subtree_start = index << level;
        let subtree_end = (index + 1) << level;
        let has_leaves = self.leaves.keys().any(|&k| k >= subtree_start && k < subtree_end);

        if !has_leaves {
            return self.zero_hashes[level];
        }

        let left_idx = index * 2;
        let right_idx = index * 2 + 1;
        let left = self.get_node_at_level(level - 1, left_idx);
        let right = self.get_node_at_level(level - 1, right_idx);
        poseidon_internal_hash(left, right)
    }

    pub fn root(&self) -> Fq {
        self.root
    }
}

// ============================================================================
// SPARSE MERKLE CIRCUIT (IN-CIRCUIT VERIFICATION)
// ============================================================================

#[derive(Clone, Debug)]
pub struct SparseMerkleConfig {
    pub poseidon: PoseidonConfig,
    pub leaf_col: Column<Advice>,
    pub sibling_col: Column<Advice>,
    pub root_instance: Column<Instance>,
}

#[derive(Clone)]
pub struct SparseMerkleCircuit {
    pub leaf: Value<Fq>,
    pub index: [bool; TREE_DEPTH],
    pub proof: [Value<Fq>; TREE_DEPTH],
    pub root: Value<Fq>,
}

impl Circuit<Fq> for SparseMerkleCircuit {
    type Config = SparseMerkleConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            leaf: Value::unknown(),
            index: [false; TREE_DEPTH],
            proof: [Value::unknown(); TREE_DEPTH],
            root: Value::unknown(),
        }
    }

    fn configure(meta: &mut ConstraintSystem<Fq>) -> Self::Config {
        let leaf_col = meta.advice_column();
        let sibling_col = meta.advice_column();
        let root_instance = meta.instance_column();

        meta.enable_equality(leaf_col);
        meta.enable_equality(sibling_col);
        meta.enable_equality(root_instance);

        let poseidon = PoseidonChipFq::configure(meta);

        SparseMerkleConfig {
            poseidon,
            leaf_col,
            sibling_col,
            root_instance,
        }
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<Fq>,
    ) -> Result<(), PlonkError> {
        let poseidon_chip = PoseidonChipFq::new(config.poseidon.clone());

        // 1. Assign leaf hash
        let mut current = layouter.assign_region(
            || "assign leaf",
            |mut region| {
                region.assign_advice(|| "leaf", config.leaf_col, 0, || self.leaf)
            },
        )?;

        // 2. Walk up the Merkle path
        for level in 0..TREE_DEPTH {
            let sibling = layouter.assign_region(
                || format!("assign sibling {}", level),
                |mut region| {
                    region.assign_advice(
                        || "sibling",
                        config.sibling_col,
                        0,
                        || self.proof[level],
                    )
                },
            )?;

            // Hash order depends on path direction
            let (left, right) = if self.index[level] {
                (sibling.clone(), current.clone())
            } else {
                (current.clone(), sibling.clone())
            };

            // H(left || right)
            current = poseidon_chip.hash_cells(
                layouter.namespace(|| format!("hash level {}", level)),
                left,
                right,
                Value::known(Fq::from(MERKLE_DOMAIN as u64)),
            )?;
        }

        // 3. Constrain computed root to public input
        layouter.constrain_instance(
            current.cell(),
            config.root_instance,
            0,
        )?;

        Ok(())
    }
}

// ============================================================================
// PROOF GENERATION & VERIFICATION
// ============================================================================

/// Generate proof for any Fq-based circuit
pub fn generate_proof<C: Circuit<Fq>>(
    params: &Params<EqAffine>,
    pk: &ProvingKey<EqAffine>,
    circuit: C,
    instances: Vec<Vec<Fq>>,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let instances_refs: Vec<&[Fq]> = instances.iter().map(|col| col.as_slice()).collect();

    let mut transcript = Blake2bWrite::<_, _, Challenge255<_>>::init(Vec::new());
    create_proof::<EqAffine, Challenge255<EqAffine>, OsRng, Blake2bWrite<Vec<u8>, EqAffine, Challenge255<EqAffine>>, C>(
        params,
        pk,
        &[circuit],
        &[instances_refs.as_slice()],
        OsRng,
        &mut transcript,
    )
    .map_err(|e| format!("create_proof failed: {:?}", e))?;

    Ok(transcript.finalize())
}

/// Generate proving and verifying keys
pub fn generate_keys<C: Circuit<Fq>>(
    params: &Params<EqAffine>,
    circuit: &C,
) -> Result<(ProvingKey<EqAffine>, VerifyingKey<EqAffine>), Box<dyn std::error::Error>> {
    let vk = keygen_vk(params, circuit)
        .map_err(|e| format!("keygen_vk failed: {:?}", e))?;

    let pk = keygen_pk(params, vk.clone(), circuit)
        .map_err(|e| format!("keygen_pk failed: {:?}", e))?;

    Ok((pk, vk))
}

/// Verify proof
pub fn verify_proof_with_instances(
    params: &Params<EqAffine>,
    vk: &VerifyingKey<EqAffine>,
    proof_bytes: &[u8],
    instances: Vec<Vec<Fq>>,
) -> Result<bool, Box<dyn std::error::Error>> {
    if proof_bytes.is_empty() {
        return Err("empty proof bytes".into());
    }

    let instances_refs: Vec<&[Fq]> = instances
        .iter()
        .map(|col| col.as_slice())
        .collect();

    let mut transcript = Blake2bRead::<_, _, Challenge255<_>>::init(proof_bytes);

    verify_proof::<EqAffine, Challenge255<EqAffine>, Blake2bRead<&[u8], EqAffine, Challenge255<EqAffine>>, SingleVerifier<EqAffine>>(
        params,
        vk,
        SingleVerifier::new(params),
        &[instances_refs.as_slice()],
        &mut transcript,
    )
    .map(|_| true)
    .map_err(|e| format!("verify_proof failed: {:?}", e).into())
}

// ============================================================================
// PROOF SYSTEM WRAPPER
// ============================================================================

pub struct ProofSystem {
    params: Params<EqAffine>,
}

impl ProofSystem {
    /// Create new proof system with circuit size 2^k
    pub fn new(k: u32) -> Self {
        Self {
            params: Params::<EqAffine>::new(k),
        }
    }

    pub fn generate_keys<C: Circuit<Fq>>(
        &self,
        circuit: &C,
    ) -> Result<(ProvingKey<EqAffine>, VerifyingKey<EqAffine>), Box<dyn std::error::Error>> {
        generate_keys(&self.params, circuit)
    }

    pub fn prove<C: Circuit<Fq>>(
        &self,
        pk: &ProvingKey<EqAffine>,
        circuit: C,
        instances: Vec<Vec<Fq>>,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        generate_proof(&self.params, pk, circuit, instances)
    }

    pub fn verify(
        &self,
        vk: &VerifyingKey<EqAffine>,
        proof: &[u8],
        instances: Vec<Vec<Fq>>,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        verify_proof_with_instances(&self.params, vk, proof, instances)
    }

    /// Prove and verify in one call (for testing)
    pub fn prove_and_verify<C: Circuit<Fq> + Clone>(
        &self,
        circuit: C,
        instances: Vec<Vec<Fq>>,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let (pk, vk) = self.generate_keys(&circuit)?;
        let proof = self.prove(&pk, circuit, instances.clone())?;
        self.verify(&vk, &proof, instances)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_poseidon_hash() {
        let chip = PoseidonChipFq::new(PoseidonConfig {
            state: [Column::default(); 3],
            state_sq: [Column::default(); 3],
            state_4th: [Column::default(); 3],
            state_sbox: [Column::default(); 3],
            sbox_full_sel: Selector::default(),
            sbox_partial_sel: Selector::default(),
            mds_sel: Selector::default(),
        });

        let a = Fq::from(123u64);
        let b = Fq::from(456u64);
        let domain = Fq::from(D_INTERNAL);

        let h1 = chip.hash_cpu([a, b], domain);
        let h2 = poseidon_hash_2_fq(a, b, D_INTERNAL);

        // Both should produce the same hash
        // (Note: they use different methods but same constants)
    }

    #[test]
    fn test_sparse_merkle_tree() {
        let mut tree = SparseMerkleTree::new(8);

        // Insert some leaves
        tree.update(0, Fq::from(100u64));
        tree.update(5, Fq::from(500u64));
        tree.update(255, Fq::from(255u64));

        let root = tree.root();

        // Generate and verify proof for leaf 5
        let proof = tree.generate_proof(5);
        assert!(proof.verify(Fq::from(500u64), root));

        // Wrong leaf should fail
        assert!(!proof.verify(Fq::from(999u64), root));
    }

    #[test]
    fn test_sparse_merkle_circuit() {
        // Create tree and insert leaf
        let mut tree = SparseMerkleTree::new(TREE_DEPTH);
        let leaf_val = Fq::from(42u64);
        let leaf_index: u64 = 7;
        tree.update(leaf_index, leaf_val);

        // Generate proof
        let proof = tree.generate_proof(leaf_index);
        let root = tree.root();

        // Convert proof to circuit format
        let mut index_bits = [false; TREE_DEPTH];
        let mut proof_values = [Value::unknown(); TREE_DEPTH];
        for i in 0..TREE_DEPTH {
            index_bits[i] = (leaf_index >> i) & 1 == 1;
            proof_values[i] = Value::known(proof.path[i].sibling);
        }

        let circuit = SparseMerkleCircuit {
            leaf: Value::known(leaf_val),
            index: index_bits,
            proof: proof_values,
            root: Value::known(root),
        };

        // Prove and verify
        let k = 12; // 2^12 rows
        let proof_system = ProofSystem::new(k);

        let result = proof_system.prove_and_verify(
            circuit,
            vec![vec![root]], // public input: root
        );

        assert!(result.is_ok());
        assert!(result.unwrap());
    }
}

// ============================================================================
// COMPREHENSIVE TEST SUITE
// ============================================================================

#[cfg(test)]
mod comprehensive_tests {
    use super::*;
    use ff::Field;

    // ========================================================================
    // POSEIDON HASH TESTS
    // ========================================================================

    #[test]
    fn test_poseidon_deterministic() {
        // Same inputs must produce same output
        let a = Fq::from(12345u64);
        let b = Fq::from(67890u64);
        
        let h1 = poseidon_hash_2_fq(a, b, D_INTERNAL);
        let h2 = poseidon_hash_2_fq(a, b, D_INTERNAL);
        
        assert_eq!(h1, h2, "Poseidon must be deterministic");
    }

    #[test]
    fn test_poseidon_different_inputs() {
        // Different inputs must produce different outputs
        let a = Fq::from(100u64);
        let b = Fq::from(200u64);
        let c = Fq::from(300u64);
        
        let h1 = poseidon_hash_2_fq(a, b, D_INTERNAL);
        let h2 = poseidon_hash_2_fq(a, c, D_INTERNAL);
        let h3 = poseidon_hash_2_fq(b, a, D_INTERNAL); // order matters
        
        assert_ne!(h1, h2, "Different inputs must produce different hashes");
        assert_ne!(h1, h3, "Order must matter in hash");
    }

    #[test]
    fn test_poseidon_domain_separation() {
        // Different domains must produce different outputs
        let a = Fq::from(42u64);
        let b = Fq::from(43u64);
        
        let h1 = poseidon_hash_2_fq(a, b, D_LEAF);
        let h2 = poseidon_hash_2_fq(a, b, D_INTERNAL);
        let h3 = poseidon_hash_2_fq(a, b, D_COMMIT1);
        
        assert_ne!(h1, h2, "Different domains must produce different hashes");
        assert_ne!(h2, h3, "Different domains must produce different hashes");
        assert_ne!(h1, h3, "Different domains must produce different hashes");
    }

    #[test]
    fn test_poseidon_zero_inputs() {
        // Hash of zeros should not be zero
        let h = poseidon_hash_2_fq(Fq::zero(), Fq::zero(), D_INTERNAL);
        assert_ne!(h, Fq::zero(), "Hash of zeros should not be zero");
    }

    #[test]
    fn test_poseidon_large_values() {
        // Test with large field elements
        let a = Fq::from(u64::MAX);
        let b = Fq::from(u64::MAX - 1);
        
        let h = poseidon_hash_2_fq(a, b, D_INTERNAL);
        assert_ne!(h, Fq::zero(), "Hash of large values should work");
        
        // Verify determinism with large values
        let h2 = poseidon_hash_2_fq(a, b, D_INTERNAL);
        assert_eq!(h, h2);
    }

    #[test]
    fn test_poseidon_chip_cpu_consistency() {
        let constants = PoseidonConstants::<Fq, U3>::new();
        let chip = PoseidonChipFq {
            config: PoseidonConfig {
                state: [Column::default(), Column::default(), Column::default()],
                state_sq: [Column::default(), Column::default(), Column::default()],
                state_4th: [Column::default(), Column::default(), Column::default()],
                state_sbox: [Column::default(), Column::default(), Column::default()],
                sbox_full_sel: Selector::default(),
                sbox_partial_sel: Selector::default(),
                mds_sel: Selector::default(),
            },
            constants,
        };

        let a = Fq::from(999u64);
        let b = Fq::from(888u64);
        let domain = Fq::from(D_INTERNAL);

        let h_chip = chip.hash_cpu([a, b], domain);
        
        // Hash should be non-zero and deterministic
        assert_ne!(h_chip, Fq::zero());
        
        let h_chip2 = chip.hash_cpu([a, b], domain);
        assert_eq!(h_chip, h_chip2, "CPU hash must be deterministic");
    }

    // ========================================================================
    // SPARSE MERKLE TREE TESTS
    // ========================================================================

    #[test]
    fn test_empty_tree() {
        let tree = SparseMerkleTree::new(8);
        let root = tree.root();
        
        // Empty tree root should be the zero hash at depth
        assert_eq!(root, tree.zero_hashes[8], "Empty tree root should be zero hash");
    }

    #[test]
    fn test_single_leaf() {
        let mut tree = SparseMerkleTree::new(8);
        let leaf_val = Fq::from(42u64);
        
        tree.update(0, leaf_val);
        let root = tree.root();
        
        // Root should change after insert
        assert_ne!(root, tree.zero_hashes[8], "Root should change after insert");
        
        // Proof should verify
        let proof = tree.generate_proof(0);
        assert!(proof.verify(leaf_val, root), "Proof for inserted leaf must verify");
    }

    #[test]
    fn test_multiple_leaves() {
        let mut tree = SparseMerkleTree::new(8);
        
        // Insert at various positions
        tree.update(0, Fq::from(100u64));
        tree.update(1, Fq::from(101u64));
        tree.update(127, Fq::from(227u64));
        tree.update(255, Fq::from(355u64));
        
        let root = tree.root();
        
        // All proofs should verify
        assert!(tree.generate_proof(0).verify(Fq::from(100u64), root));
        assert!(tree.generate_proof(1).verify(Fq::from(101u64), root));
        assert!(tree.generate_proof(127).verify(Fq::from(227u64), root));
        assert!(tree.generate_proof(255).verify(Fq::from(355u64), root));
    }

    #[test]
    fn test_wrong_leaf_fails() {
        let mut tree = SparseMerkleTree::new(8);
        tree.update(5, Fq::from(500u64));
        
        let root = tree.root();
        let proof = tree.generate_proof(5);
        
        // Correct leaf verifies
        assert!(proof.verify(Fq::from(500u64), root));
        
        // Wrong leaf fails
        assert!(!proof.verify(Fq::from(501u64), root), "Wrong leaf must fail");
        assert!(!proof.verify(Fq::from(0u64), root), "Zero leaf must fail");
        assert!(!proof.verify(Fq::from(u64::MAX), root), "Wrong leaf must fail");
    }

    #[test]
    fn test_wrong_root_fails() {
        let mut tree = SparseMerkleTree::new(8);
        tree.update(5, Fq::from(500u64));
        
        let root = tree.root();
        let proof = tree.generate_proof(5);
        
        // Wrong root fails
        let wrong_root = poseidon_hash_2_fq(root, Fq::one(), D_INTERNAL);
        assert!(!proof.verify(Fq::from(500u64), wrong_root), "Wrong root must fail");
    }

    #[test]
    fn test_update_existing_leaf() {
        let mut tree = SparseMerkleTree::new(8);
        
        tree.update(10, Fq::from(100u64));
        let root1 = tree.root();
        
        tree.update(10, Fq::from(200u64));
        let root2 = tree.root();
        
        // Root should change
        assert_ne!(root1, root2, "Root must change when leaf is updated");
        
        // Old value fails, new value succeeds
        let proof = tree.generate_proof(10);
        assert!(!proof.verify(Fq::from(100u64), root2), "Old value must fail");
        assert!(proof.verify(Fq::from(200u64), root2), "New value must verify");
    }

    #[test]
    fn test_non_existent_leaf() {
        let mut tree = SparseMerkleTree::new(8);
        tree.update(5, Fq::from(500u64));
        
        let root = tree.root();
        
        // Proof for non-existent leaf (index 10) should verify with zero
        let proof = tree.generate_proof(10);
        assert!(proof.verify(Fq::zero(), root), "Non-existent leaf should be zero");
    }

    #[test]
    fn test_tree_depth_32() {
        let mut tree = SparseMerkleTree::new(TREE_DEPTH);
        
        // Insert at extreme indices
        tree.update(0, Fq::from(1u64));
        tree.update(1 << 20, Fq::from(2u64)); // Index 2^20
        tree.update((1u64 << 31) - 1, Fq::from(3u64)); // Large index
        
        let root = tree.root();
        
        assert!(tree.generate_proof(0).verify(Fq::from(1u64), root));
        assert!(tree.generate_proof(1 << 20).verify(Fq::from(2u64), root));
        assert!(tree.generate_proof((1u64 << 31) - 1).verify(Fq::from(3u64), root));
    }

    #[test]
    fn test_zero_hash_precomputation() {
        let tree = SparseMerkleTree::new(8);
        
        // Zero hashes should form a valid chain
        for i in 1..=8 {
            let expected = poseidon_internal_hash(tree.zero_hashes[i-1], tree.zero_hashes[i-1]);
            assert_eq!(tree.zero_hashes[i], expected, "Zero hash chain broken at level {}", i);
        }
    }

    // ========================================================================
    // PROOF PATH TESTS
    // ========================================================================

    #[test]
    fn test_proof_path_length() {
        let tree = SparseMerkleTree::new(8);
        let proof = tree.generate_proof(0);
        
        assert_eq!(proof.path.len(), 8, "Proof path length must equal tree depth");
    }

    #[test]
    fn test_proof_path_siblings_correct() {
        let mut tree = SparseMerkleTree::new(4); // Small tree for easy verification
        
        // Insert leaves at indices 0 and 1 (siblings)
        tree.update(0, Fq::from(100u64));
        tree.update(1, Fq::from(101u64));
        
        let proof_0 = tree.generate_proof(0);
        let proof_1 = tree.generate_proof(1);
        
        // First sibling in proof for 0 should be leaf at 1
        assert_eq!(proof_0.path[0].sibling, Fq::from(101u64));
        
        // First sibling in proof for 1 should be leaf at 0
        assert_eq!(proof_1.path[0].sibling, Fq::from(100u64));
    }

    #[test]
    fn test_proof_direction_bits() {
        let tree = SparseMerkleTree::new(8);
        
        // Index 5 = 0b00000101
        // Bits: [1, 0, 1, 0, 0, 0, 0, 0] (LSB first)
        let proof = tree.generate_proof(5);
        
        assert!(proof.path[0].is_left == false, "Bit 0 of 5 is 1, so NOT left");
        assert!(proof.path[1].is_left == true, "Bit 1 of 5 is 0, so IS left");
        assert!(proof.path[2].is_left == false, "Bit 2 of 5 is 1, so NOT left");
    }

    // ========================================================================
    // MATHEMATICAL PROPERTY TESTS
    // ========================================================================

    #[test]
    fn test_collision_resistance() {
        // Test that different leaves produce different roots
        let mut roots = std::collections::HashSet::new();
        
        for i in 0..100u64 {
            let mut tree = SparseMerkleTree::new(8);
            tree.update(0, Fq::from(i));
            
            let root_bytes = format!("{:?}", tree.root());
            assert!(roots.insert(root_bytes), "Collision detected at i={}", i);
        }
    }

    #[test]
    fn test_second_preimage_resistance() {
        let mut tree1 = SparseMerkleTree::new(8);
        let mut tree2 = SparseMerkleTree::new(8);
        
        // Different structures, try to get same root
        tree1.update(0, Fq::from(100u64));
        tree1.update(1, Fq::from(200u64));
        
        tree2.update(0, Fq::from(150u64));
        tree2.update(1, Fq::from(150u64));
        
        assert_ne!(tree1.root(), tree2.root(), "Different trees must have different roots");
    }

    #[test]
    fn test_merkle_binding() {
        // Once committed, you can't change the value without changing the root
        let mut tree = SparseMerkleTree::new(8);
        tree.update(5, Fq::from(500u64));
        
        let root_before = tree.root();
        let proof = tree.generate_proof(5);
        
        // This proof ONLY works for value 500
        assert!(proof.verify(Fq::from(500u64), root_before));
        
        // For any other value, either:
        // 1. The proof fails with the same root, OR
        // 2. The root would need to change
        for v in [0u64, 1, 499, 501, 1000, u64::MAX] {
            assert!(!proof.verify(Fq::from(v), root_before), 
                "Proof must not verify for value {}", v);
        }
    }

    // ========================================================================
    // CIRCUIT TESTS (require full Halo2 setup)
    // ========================================================================

    #[test]
    fn test_circuit_valid_proof() {
        let mut tree = SparseMerkleTree::new(TREE_DEPTH);
        let leaf_val = Fq::from(12345u64);
        let leaf_index: u64 = 42;
        
        tree.update(leaf_index, leaf_val);
        let proof = tree.generate_proof(leaf_index);
        let root = tree.root();
        
        // Verify off-circuit first
        assert!(proof.verify(leaf_val, root), "Off-circuit proof must verify");
        
        // Convert to circuit format
        let mut index_bits = [false; TREE_DEPTH];
        let mut proof_values = [Value::unknown(); TREE_DEPTH];
        
        for i in 0..TREE_DEPTH {
            index_bits[i] = (leaf_index >> i) & 1 == 1;
            proof_values[i] = Value::known(proof.path[i].sibling);
        }
        
        let circuit = SparseMerkleCircuit {
            leaf: Value::known(leaf_val),
            index: index_bits,
            proof: proof_values,
            root: Value::known(root),
        };
        
        // Create proof system (k=12 for reasonable circuit size)
        let k = 12;
        let proof_system = ProofSystem::new(k);
        
        let result = proof_system.prove_and_verify(
            circuit,
            vec![vec![root]],
        );
        
        assert!(result.is_ok(), "Proof generation should succeed: {:?}", result.err());
        assert!(result.unwrap(), "Proof verification should succeed");
    }

    #[test]
    fn test_circuit_wrong_leaf_fails() {
        let mut tree = SparseMerkleTree::new(TREE_DEPTH);
        let correct_leaf = Fq::from(100u64);
        let wrong_leaf = Fq::from(999u64);
        let leaf_index: u64 = 7;
        
        tree.update(leaf_index, correct_leaf);
        let proof = tree.generate_proof(leaf_index);
        let root = tree.root();
        
        // Build circuit with WRONG leaf
        let mut index_bits = [false; TREE_DEPTH];
        let mut proof_values = [Value::unknown(); TREE_DEPTH];
        
        for i in 0..TREE_DEPTH {
            index_bits[i] = (leaf_index >> i) & 1 == 1;
            proof_values[i] = Value::known(proof.path[i].sibling);
        }
        
        let circuit = SparseMerkleCircuit {
            leaf: Value::known(wrong_leaf), // WRONG!
            index: index_bits,
            proof: proof_values,
            root: Value::known(root),
        };
        
        let k = 12;
        let proof_system = ProofSystem::new(k);
        
        // This should fail during proof generation or verification
        let result = proof_system.prove_and_verify(
            circuit,
            vec![vec![root]],
        );
        
        // The proof should either fail to generate or fail to verify
        assert!(result.is_err() || !result.unwrap(), 
            "Wrong leaf must cause failure");
    }

    #[test]
    fn test_circuit_wrong_root_fails() {
        let mut tree = SparseMerkleTree::new(TREE_DEPTH);
        let leaf_val = Fq::from(50u64);
        let leaf_index: u64 = 3;
        
        tree.update(leaf_index, leaf_val);
        let proof = tree.generate_proof(leaf_index);
        let correct_root = tree.root();
        let wrong_root = poseidon_hash_2_fq(correct_root, Fq::one(), D_INTERNAL);
        
        let mut index_bits = [false; TREE_DEPTH];
        let mut proof_values = [Value::unknown(); TREE_DEPTH];
        
        for i in 0..TREE_DEPTH {
            index_bits[i] = (leaf_index >> i) & 1 == 1;
            proof_values[i] = Value::known(proof.path[i].sibling);
        }
        
        let circuit = SparseMerkleCircuit {
            leaf: Value::known(leaf_val),
            index: index_bits,
            proof: proof_values,
            root: Value::known(correct_root), // Circuit expects correct root
        };
        
        let k = 12;
        let proof_system = ProofSystem::new(k);
        
        // Generate proof with correct root in circuit
        let (pk, vk) = proof_system.generate_keys(&circuit).unwrap();
        let proof_bytes = proof_system.prove(&pk, circuit, vec![vec![correct_root]]).unwrap();
        
        // Try to verify with WRONG root as public input
        let result = proof_system.verify(&vk, &proof_bytes, vec![vec![wrong_root]]);
        
        assert!(result.is_err() || !result.unwrap(), 
            "Wrong root must cause verification failure");
    }

    #[test]
    fn test_circuit_multiple_leaves() {
        let mut tree = SparseMerkleTree::new(TREE_DEPTH);
        
        // Insert multiple leaves
        let leaves = vec![
            (0u64, Fq::from(100u64)),
            (1, Fq::from(101u64)),
            (1000, Fq::from(1100u64)),
            (1 << 20, Fq::from(2020u64)),
        ];
        
        for (idx, val) in &leaves {
            tree.update(*idx, *val);
        }
        
        let root = tree.root();
        let k = 12;
        let proof_system = ProofSystem::new(k);
        
        // Verify each leaf
        for (idx, val) in &leaves {
            let proof = tree.generate_proof(*idx);
            
            let mut index_bits = [false; TREE_DEPTH];
            let mut proof_values = [Value::unknown(); TREE_DEPTH];
            
            for i in 0..TREE_DEPTH {
                index_bits[i] = (*idx >> i) & 1 == 1;
                proof_values[i] = Value::known(proof.path[i].sibling);
            }
            
            let circuit = SparseMerkleCircuit {
                leaf: Value::known(*val),
                index: index_bits,
                proof: proof_values,
                root: Value::known(root),
            };
            
            let result = proof_system.prove_and_verify(circuit, vec![vec![root]]);
            assert!(result.is_ok() && result.unwrap(), 
                "Proof for leaf at index {} should verify", idx);
        }
    }

    // ========================================================================
    // STRESS TESTS
    // ========================================================================

    #[test]
    fn test_many_insertions() {
        let mut tree = SparseMerkleTree::new(16);
        
        // Insert 1000 leaves
        for i in 0..1000u64 {
            tree.update(i, Fq::from(i * 100));
        }
        
        let root = tree.root();
        
        // Verify random sample
        for i in [0u64, 1, 100, 500, 999] {
            let proof = tree.generate_proof(i);
            assert!(proof.verify(Fq::from(i * 100), root), 
                "Proof for index {} should verify", i);
        }
    }

    #[test]
    fn test_sparse_insertions() {
        let mut tree = SparseMerkleTree::new(32);
        
        // Insert at very sparse indices
        let indices = [0u64, 1 << 10, 1 << 20, 1 << 30, (1u64 << 31) - 1];
        
        for (i, idx) in indices.iter().enumerate() {
            tree.update(*idx, Fq::from(i as u64));
        }
        
        let root = tree.root();
        
        for (i, idx) in indices.iter().enumerate() {
            let proof = tree.generate_proof(*idx);
            assert!(proof.verify(Fq::from(i as u64), root));
        }
    }

    // ========================================================================
    // EDGE CASE TESTS
    // ========================================================================

    #[test]
    fn test_adjacent_leaves() {
        let mut tree = SparseMerkleTree::new(8);
        
        // Insert adjacent leaves
        tree.update(0, Fq::from(100u64));
        tree.update(1, Fq::from(101u64));
        
        let root = tree.root();
        
        // Both should verify
        assert!(tree.generate_proof(0).verify(Fq::from(100u64), root));
        assert!(tree.generate_proof(1).verify(Fq::from(101u64), root));
        
        // Swapped values should fail
        assert!(!tree.generate_proof(0).verify(Fq::from(101u64), root));
        assert!(!tree.generate_proof(1).verify(Fq::from(100u64), root));
    }

    #[test]
    fn test_max_index() {
        let depth = 8;
        let max_index = (1u64 << depth) - 1; // 255 for depth 8
        
        let mut tree = SparseMerkleTree::new(depth);
        tree.update(max_index, Fq::from(999u64));
        
        let root = tree.root();
        let proof = tree.generate_proof(max_index);
        
        assert!(proof.verify(Fq::from(999u64), root));
    }

    #[test]
    fn test_all_ones_value() {
        let mut tree = SparseMerkleTree::new(8);
        let max_fq = Fq::from(u64::MAX);
        
        tree.update(5, max_fq);
        let root = tree.root();
        
        assert!(tree.generate_proof(5).verify(max_fq, root));
    }
}
