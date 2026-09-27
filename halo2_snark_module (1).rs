// ============================================================================
// KASVILLAGE HALO2 SNARK MODULE (Updated for PSE v2023_04_20)
// ============================================================================
// - Poseidon hashing (in-circuit + off-circuit via neptune)
// - SparseMerkleTree with Poseidon
// - SparseMerkleCircuit for ZK membership proofs
// - Proof generation and verification (scheme-based API)
// ============================================================================

use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value, AssignedCell},
    plonk::{
        create_proof, verify_proof, keygen_pk, keygen_vk,
        ProvingKey, VerifyingKey, Circuit, ConstraintSystem,
        Column, Advice, Selector, Expression, Instance,
        Error as PlonkError,
    },
    poly::{
        commitment::ParamsProver,
        ipa::{
            commitment::{ParamsIPA, IPACommitmentScheme},
            multiopen::{ProverIPA, VerifierIPA},
            strategy::SingleStrategy,
        },
        Rotation,
    },
    transcript::{Blake2bRead, Blake2bWrite, Challenge255, TranscriptWriterBuffer},
};
use pasta_curves::{pallas::Base as Fq, pallas::Scalar as Fr, EqAffine};
use neptune::{Poseidon, poseidon::PoseidonConstants};
use ff::{Field, PrimeField};
use std::collections::HashMap;
use typenum::U3;
use rand_core::OsRng;

// ============================================================================
// CONSTANTS
// ============================================================================

pub const TREE_DEPTH: usize = 32;
pub const MERKLE_DOMAIN: u64 = 0x4D45524B; // "MERK"

pub const D_LEAF: u64 = 0;
pub const D_INTERNAL: u64 = 1;
pub const D_COMMIT1: u64 = 2;

// ============================================================================
// POSEIDON OFF-CIRCUIT HELPERS
// ============================================================================

pub fn poseidon_hash_2_fq(left: Fq, right: Fq, domain: u64) -> Fq {
    let constants = PoseidonConstants::<Fq, U3>::new();
    let mut hasher = Poseidon::<Fq, U3>::new(&constants);
    hasher.input(Fq::from(domain)).unwrap();
    hasher.input(left).unwrap();
    hasher.input(right).unwrap();
    hasher.hash()
}

pub fn poseidon_internal_hash(left: Fq, right: Fq) -> Fq {
    poseidon_hash_2_fq(left, right, D_INTERNAL)
}

pub fn poseidon_leaf_hash(data: Fq) -> Fq {
    poseidon_hash_2_fq(data, Fq::zero(), D_LEAF)
}

// ============================================================================
// POSEIDON CHIP (in-circuit)
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
            let mds_expr: [[Expression<Fq>; 3]; 3] = std::array::from_fn(|i| {
                std::array::from_fn(|j| Expression::Constant(constants.mds_matrices.m[i][j]))
            });
            let mut constraints = Vec::new();
            for i in 0..3 {
                constraints.push(s.clone() * (
                    out_state[i].clone()
                    - (in_sbox[0].clone() * mds_expr[i][0].clone()
                     + in_sbox[1].clone() * mds_expr[i][1].clone()
                     + in_sbox[2].clone() * mds_expr[i][2].clone())
                ));
            }
            constraints
        });

        PoseidonConfig { state, state_sq, state_4th, state_sbox, sbox_full_sel, sbox_partial_sel, mds_sel }
    }

    pub fn new(config: PoseidonConfig) -> Self {
        Self { config, constants: PoseidonConstants::<Fq, U3>::new() }
    }

    pub fn hash_cells(
        &self, layouter: impl Layouter<Fq>,
        left: AssignedCell<Fq, Fq>, right: AssignedCell<Fq, Fq>,
        domain_tag: Value<Fq>,
    ) -> Result<AssignedCell<Fq, Fq>, PlonkError> {
        self.hash(layouter, [left.value().copied(), right.value().copied()], domain_tag)
    }

    pub fn hash(
        &self, layouter: impl Layouter<Fq>,
        input: [Value<Fq>; 2], domain_tag: Value<Fq>,
    ) -> Result<AssignedCell<Fq, Fq>, PlonkError> {
        let state = self.assign_permutation(layouter, [input[0], input[1], Value::known(Fq::zero())], domain_tag)?;
        Ok(state[0].clone())
    }

    fn assign_permutation(
        &self, mut layouter: impl Layouter<Fq>,
        input: [Value<Fq>; 3], domain_tag: Value<Fq>,
    ) -> Result<[AssignedCell<Fq, Fq>; 3], PlonkError> {
        layouter.assign_region(|| "poseidon_fq", |mut region| {
            let cfg = &self.config;
            let mut state = [
                region.assign_advice(|| "d", cfg.state[0], 0, || domain_tag)?,
                region.assign_advice(|| "l", cfg.state[1], 0, || input[0])?,
                region.assign_advice(|| "r", cfg.state[2], 0, || input[1])?,
            ];
            let mut offset = 1;
            for r in 0..4 { offset = self.apply_full_round(&mut region, &mut state, r, offset)?; }
            for r in 4..60 { offset = self.apply_partial_round(&mut region, &mut state, r, offset)?; }
            for r in 60..64 { offset = self.apply_full_round(&mut region, &mut state, r, offset)?; }
            Ok(state)
        })
    }

    fn apply_full_round(&self, region: &mut halo2_proofs::circuit::Region<Fq>, state: &mut [AssignedCell<Fq, Fq>; 3], round: usize, offset: usize) -> Result<usize, PlonkError> {
        let cfg = &self.config;
        cfg.sbox_full_sel.enable(region, offset)?;
        let mut sv: [Value<Fq>; 3] = [Value::unknown(); 3];
        for i in 0..3 {
            let rc = self.constants.compressed_round_constants[round * 3 + i];
            sv[i] = state[i].value().map(|v| *v + rc);
            region.assign_advice(|| "rc", cfg.state[i], offset, || sv[i])?;
        }
        for i in 0..3 {
            let x2 = sv[i].map(|v| v.square());
            let x4 = x2.map(|v| v.square());
            let x5 = sv[i].zip(x4).map(|(v, v4)| v * v4);
            region.assign_advice(|| "sq", cfg.state_sq[i], offset, || x2)?;
            region.assign_advice(|| "4th", cfg.state_4th[i], offset, || x4)?;
            state[i] = region.assign_advice(|| "sb", cfg.state_sbox[i], offset, || x5)?;
        }
        cfg.mds_sel.enable(region, offset)?;
        let mds = &self.constants.mds_matrices.m;
        let mut ns = [Value::unknown(); 3];
        for i in 0..3 {
            let mut acc = Value::known(Fq::zero());
            for j in 0..3 { acc = acc.zip(state[j].value()).map(|(a, v)| a + v * mds[i][j]); }
            ns[i] = acc;
        }
        for i in 0..3 { state[i] = region.assign_advice(|| "mds", cfg.state[i], offset + 1, || ns[i])?; }
        Ok(offset + 2)
    }

    fn apply_partial_round(&self, region: &mut halo2_proofs::circuit::Region<Fq>, state: &mut [AssignedCell<Fq, Fq>; 3], round: usize, offset: usize) -> Result<usize, PlonkError> {
        let cfg = &self.config;
        cfg.sbox_partial_sel.enable(region, offset)?;
        let mut sv: [Value<Fq>; 3] = [Value::unknown(); 3];
        for i in 0..3 {
            let rc = self.constants.compressed_round_constants[round * 3 + i];
            sv[i] = state[i].value().map(|v| *v + rc);
            region.assign_advice(|| "rc", cfg.state[i], offset, || sv[i])?;
        }
        let x2 = sv[0].map(|v| v.square());
        let x4 = x2.map(|v| v.square());
        let x5 = sv[0].zip(x4).map(|(v, v4)| v * v4);
        region.assign_advice(|| "sq", cfg.state_sq[0], offset, || x2)?;
        region.assign_advice(|| "4th", cfg.state_4th[0], offset, || x4)?;
        state[0] = region.assign_advice(|| "sb", cfg.state_sbox[0], offset, || x5)?;
        state[1] = region.assign_advice(|| "id1", cfg.state_sbox[1], offset, || sv[1])?;
        state[2] = region.assign_advice(|| "id2", cfg.state_sbox[2], offset, || sv[2])?;
        cfg.mds_sel.enable(region, offset)?;
        let mds = &self.constants.mds_matrices.m;
        let mut ns = [Value::unknown(); 3];
        for i in 0..3 {
            let mut acc = Value::known(Fq::zero());
            for j in 0..3 { acc = acc.zip(state[j].value()).map(|(a, v)| a + v * mds[i][j]); }
            ns[i] = acc;
        }
        for i in 0..3 { state[i] = region.assign_advice(|| "mds", cfg.state[i], offset + 1, || ns[i])?; }
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
        let mut zero_hashes = vec![Fq::zero()];
        for i in 1..=depth {
            let prev = zero_hashes[i - 1];
            zero_hashes.push(poseidon_internal_hash(prev, prev));
        }
        Self { depth, leaves: HashMap::new(), root: zero_hashes[depth], zero_hashes }
    }

    pub fn update(&mut self, index: u64, new_leaf: Fq) {
        self.leaves.insert(index, new_leaf);
        self.root = self.compute_root();
    }

    fn compute_root(&self) -> Fq {
        if self.leaves.is_empty() { return self.zero_hashes[self.depth]; }
        let mut current_level: HashMap<u64, Fq> = self.leaves.clone();
        for level in 0..self.depth {
            let mut next_level: HashMap<u64, Fq> = HashMap::new();
            let parent_indices: std::collections::HashSet<u64> = current_level.keys().map(|&idx| idx / 2).collect();
            let zero_at_level = self.zero_hashes[level];
            for parent_idx in parent_indices {
                let left = current_level.get(&(parent_idx * 2)).copied().unwrap_or(zero_at_level);
                let right = current_level.get(&(parent_idx * 2 + 1)).copied().unwrap_or(zero_at_level);
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
            path.push(MerklePathElement { sibling, is_left: current_index % 2 == 0 });
            current_index /= 2;
        }
        SparseMerkleProof { leaf_index: index, path }
    }

    fn get_node_at_level(&self, level: usize, index: u64) -> Fq {
        if level == 0 { return *self.leaves.get(&index).unwrap_or(&self.zero_hashes[0]); }
        let subtree_start = index << level;
        let subtree_end = (index + 1) << level;
        let has_leaves = self.leaves.keys().any(|&k| k >= subtree_start && k < subtree_end);
        if !has_leaves { return self.zero_hashes[level]; }
        let left = self.get_node_at_level(level - 1, index * 2);
        let right = self.get_node_at_level(level - 1, index * 2 + 1);
        poseidon_internal_hash(left, right)
    }

    pub fn root(&self) -> Fq { self.root }
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
        SparseMerkleConfig { poseidon, leaf_col, sibling_col, root_instance }
    }

    fn synthesize(&self, config: Self::Config, mut layouter: impl Layouter<Fq>) -> Result<(), PlonkError> {
        let poseidon_chip = PoseidonChipFq::new(config.poseidon.clone());
        let mut current = layouter.assign_region(
            || "leaf", |mut region| region.assign_advice(|| "leaf", config.leaf_col, 0, || self.leaf),
        )?;
        for level in 0..TREE_DEPTH {
            let sibling = layouter.assign_region(
                || format!("sib_{}", level),
                |mut region| region.assign_advice(|| "s", config.sibling_col, 0, || self.proof[level]),
            )?;
            let (left, right) = if self.index[level] {
                (sibling.clone(), current.clone())
            } else {
                (current.clone(), sibling.clone())
            };
            current = poseidon_chip.hash_cells(
                layouter.namespace(|| format!("h_{}", level)),
                left, right, Value::known(Fq::from(MERKLE_DOMAIN)),
            )?;
        }
        layouter.constrain_instance(current.cell(), config.root_instance, 0)?;
        Ok(())
    }
}

// ============================================================================
// PROOF SYSTEM (Updated for PSE v2023_04_20 scheme-based API)
// ============================================================================

pub struct ProofSystem {
    params: ParamsIPA<EqAffine>,
}

impl ProofSystem {
    pub fn new(k: u32) -> Self {
        Self { params: ParamsIPA::<EqAffine>::new(k) }
    }

    pub fn generate_keys<C: Circuit<Fq>>(
        &self, circuit: &C,
    ) -> Result<(ProvingKey<EqAffine>, VerifyingKey<EqAffine>), Box<dyn std::error::Error>> {
        let vk = keygen_vk(&self.params, circuit).map_err(|e| format!("keygen_vk: {:?}", e))?;
        let pk = keygen_pk(&self.params, vk.clone(), circuit).map_err(|e| format!("keygen_pk: {:?}", e))?;
        Ok((pk, vk))
    }

    pub fn prove<C: Circuit<Fq>>(
        &self, pk: &ProvingKey<EqAffine>, circuit: C, instances: Vec<Vec<Fq>>,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let instances_refs: Vec<&[Fq]> = instances.iter().map(|col| col.as_slice()).collect();
        let mut transcript = Blake2bWrite::<Vec<u8>, EqAffine, Challenge255<EqAffine>>::init(vec![]);
        create_proof::<
            IPACommitmentScheme<EqAffine>,
            ProverIPA<EqAffine>,
            Challenge255<EqAffine>,
            _,
            Blake2bWrite<Vec<u8>, EqAffine, Challenge255<EqAffine>>,
            C,
        >(&self.params, pk, &[circuit], &[instances_refs.as_slice()], OsRng, &mut transcript)
            .map_err(|e| format!("create_proof: {:?}", e))?;
        Ok(transcript.finalize())
    }

    pub fn verify(
        &self, vk: &VerifyingKey<EqAffine>, proof: &[u8], instances: Vec<Vec<Fq>>,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        if proof.is_empty() { return Err("empty proof".into()); }
        let instances_refs: Vec<&[Fq]> = instances.iter().map(|col| col.as_slice()).collect();
        let mut transcript = Blake2bRead::<_, _, Challenge255<_>>::init(proof);
        let strategy = SingleStrategy::new(&self.params);
        verify_proof::<
            IPACommitmentScheme<EqAffine>,
            VerifierIPA<EqAffine>,
            Challenge255<EqAffine>,
            Blake2bRead<&[u8], EqAffine, Challenge255<EqAffine>>,
            SingleStrategy<EqAffine>,
        >(&self.params, vk, strategy, &[instances_refs.as_slice()], &mut transcript)
            .map(|_| true)
            .map_err(|e| format!("verify_proof: {:?}", e).into())
    }

    pub fn prove_and_verify<C: Circuit<Fq> + Clone>(
        &self, circuit: C, instances: Vec<Vec<Fq>>,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let (pk, vk) = self.generate_keys(&circuit)?;
        let proof = self.prove(&pk, circuit, instances.clone())?;
        self.verify(&vk, &proof, instances)
    }
}
