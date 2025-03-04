#!/bin/bash
CIRCOMLIB_REPO="https://github.com/iden3/circomlib.git"

# Check if the circomlib folder exists
if [ ! -d "circomlib" ]; then
  echo "circom circuits not found, cloning circomlib..."
  git clone $CIRCOMLIB_REPO
else
  echo "circom circuits are present."
fi

# Step 1: Compile the circuit
echo "Compiling medical records circuit..."
circom medical_records.circom --r1cs --wasm --sym --c -l circomlib/

# Step 2: Start a new powers of tau ceremony
echo "Starting powers of tau ceremony..."
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v

# Step 3: Contribute to the ceremony with automated entropy
echo "Contributing to ceremony phase 1..."
(echo "Automated entropy for first contribution phase - $(date) - medical_records_123") | snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v -e

# Step 4: Phase 2
echo "Preparing phase 2..."
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Step 5: Generate zkey
echo "Generating zkey..."
snarkjs groth16 setup medical_records.r1cs pot12_final.ptau medical_records_0000.zkey

# Step 6: Contribute to phase 2 of the ceremony with automated entropy
echo "Contributing to ceremony phase 2..."
(echo "Automated entropy for second contribution phase - $(date) - medical_records_456") | snarkjs zkey contribute medical_records_0000.zkey medical_records_0001.zkey --name="1st Contributor" -v -e

# Step 7: Export verification key
echo "Exporting verification key..."
snarkjs zkey export verificationkey medical_records_0001.zkey verification_key.json

# Step 8: Generate Verifier contract
echo "Generating verifier contract..."
snarkjs zkey export solidityverifier medical_records_0001.zkey verifier.sol

# Step 9: Generate and copy witness generation script
echo "Setting up witness generation..."
mkdir -p medical_records_js
cp medical_records_js/generate_witness.js ./

echo "Compilation and setup completed successfully!"