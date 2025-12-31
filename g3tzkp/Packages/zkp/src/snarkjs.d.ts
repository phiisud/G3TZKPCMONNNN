/**
 * Type declarations for snarkjs module
 */
declare module 'snarkjs' {
  export interface Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  }

  export interface ProofResult {
    proof: Proof;
    publicSignals: string[];
  }

  export interface VerificationKey {
    protocol: string;
    curve: string;
    nPublic: number;
    vk_alpha_1: string[];
    vk_beta_2: string[][];
    vk_gamma_2: string[][];
    vk_delta_2: string[][];
    IC: string[][];
  }

  export namespace groth16 {
    function fullProve(
      input: Record<string, string | number | bigint>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<ProofResult>;

    function verify(
      vkey: VerificationKey,
      publicSignals: string[],
      proof: Proof
    ): Promise<boolean>;

    function exportSolidityCallData(
      proof: Proof,
      publicSignals: string[]
    ): Promise<string>;
  }

  export namespace plonk {
    function fullProve(
      input: Record<string, string | number | bigint>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<ProofResult>;

    function verify(
      vkey: VerificationKey,
      publicSignals: string[],
      proof: Proof
    ): Promise<boolean>;
  }

  export namespace zKey {
    function exportVerificationKey(zkeyPath: string): Promise<VerificationKey>;
    function exportSolidityVerifier(zkeyPath: string): Promise<string>;
  }

  export namespace wtns {
    function calculate(
      input: Record<string, string | number | bigint>,
      wasmPath: string,
      wtnsPath: string
    ): Promise<void>;
  }
}
