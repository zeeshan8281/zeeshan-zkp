const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const wc = require("./medical_records_js/witness_calculator.js");
const cors = require("cors");
const mongoose = require("mongoose");
const snarkjs = require("snarkjs");
require('dotenv').config();

const Proof = require('./models/Proof');
const Input = require('./models/Input');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const RECORDS_DIR = path.join(__dirname, "medical_records");
if (!fs.existsSync(RECORDS_DIR)) fs.mkdirSync(RECORDS_DIR);

app.post("/api/submit-basic-info", async (req, res) => {
  try {
    const { patientAge, departmentId, admissionDate } = req.body;
    if (!patientAge || !departmentId || !admissionDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const recordId = generateRecordId();
    const recordPath = path.join(RECORDS_DIR, recordId);
    fs.mkdirSync(recordPath);

    const inputData = {
      patientAge,
      departmentId,
      conditionSeverity: 0,
      admissionDate,
      dischargeDate: 0,
      doctorId: 0,
      treatmentCode: 0,
      publicDepartmentId: departmentId,
      publicAdmissionYear: Math.floor(admissionDate / 31536000),
    };

    fs.writeFileSync(
      path.join(recordPath, "input.json"),
      JSON.stringify(inputData, null, 2)
    );

    // Store input in MongoDB
    try {
      const inputEntry = new Input({
        recordId: recordId,
        ...inputData
      });
      await inputEntry.save();
      console.log(`Input data saved to MongoDB for record: ${recordId}`);
    } catch (error) {
      console.error("Error saving input to MongoDB:", error);
      throw error;
    }

    return res.json({
      message: "Basic info submitted successfully",
      recordId,
      updateUrl: `/api/update-medical-record/${recordId}`,
    });
  } catch (error) {
    console.error("Error submitting basic info:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/update-medical-record/:recordId", async (req, res) => {
  try {
    const { recordId } = req.params;
    const { conditionSeverity, dischargeDate, doctorId, treatmentCode } =
      req.body;
    const recordPath = path.join(RECORDS_DIR, recordId);

    if (!fs.existsSync(recordPath)) {

      return res.status(404).json({ error: "Record not found" });
    }

    let inputData = JSON.parse(
      fs.readFileSync(path.join(recordPath, "input.json"), "utf8")
    );
    inputData.conditionSeverity = conditionSeverity;
    inputData.dischargeDate = dischargeDate;
    inputData.doctorId = doctorId;
    inputData.treatmentCode = treatmentCode;

    fs.writeFileSync(
      path.join(recordPath, "input.json"),
      JSON.stringify(inputData, null, 2)
    );

    // Generate witness and proof
    await generateWitness(recordId, recordPath);

    // Store proof in MongoDB
    const proofPath = path.join(recordPath, "proof.json");
    const publicSignalsPath = path.join(recordPath, "public.json");

    const proofData = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    const publicSignalsData = JSON.parse(fs.readFileSync(publicSignalsPath, "utf8"));

    try {
      const proofEntry = new Proof({
        recordId: recordId,
        proof: proofData,
        publicSignals: publicSignalsData
      });
      await proofEntry.save();
      console.log(`Proof data saved to MongoDB for record: ${recordId}`);
    } catch (error) {
      console.error("Error saving proof to MongoDB:", error);
      throw error;
    }

    return res.json({
      message: "Medical record updated successfully",
      verifyUrl: `/api/verify/${recordId}`
    });

  } catch (error) {
    console.error("Error updating medical record:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function generateWitness(recordId, recordPath) {
  return new Promise((resolve, reject) => {
    const buffer = fs.readFileSync("./medical_records_js/medical_records.wasm");


    console.log("Loading witness calculator...");
    wc(buffer)
      .then(async (witnessCalculator) => {
        console.log("Witness calculator loaded");
        let inputData = JSON.parse(
          fs.readFileSync(path.join(recordPath, "input.json"), "utf8")
        );
        console.log("Input data loaded:", inputData);

        // Remove public outputs
        delete inputData.publicDepartmentId;
        delete inputData.publicAdmissionYear;

        console.log("Calculating witness...");
        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
          inputData,
          0
        );
        const witnessPath = path.join(recordPath, "witness.wtns");
        fs.writeFileSync(witnessPath, witnessBuffer);
        console.log(`✅ Witness file created for record: ${recordId}`);
        console.log("Witness file size:", witnessBuffer.length);

        // Generate proof and public signals
        const zkeyPath = "./medical_records_0001.zkey";
        const proofPath = path.join(recordPath, "proof.json");
        const publicSignalsPath = path.join(recordPath, "public.json");

        const cmd = `snarkjs groth16 prove ${zkeyPath} ${witnessPath} ${proofPath} ${publicSignalsPath}`;
        
        console.log(`Executing command: ${cmd}`);
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Error generating proof: ${stderr}`);
            console.error(`Command output: ${stdout}`);
            return reject(error);
          }
          console.log(`✅ Proof generated for record: ${recordId}`);
          console.log(`Command output: ${stdout}`);
          
          // Verify the files were created
          if (!fs.existsSync(proofPath) || !fs.existsSync(publicSignalsPath)) {
            const errMsg = `Proof files not created for record ${recordId}`;
            console.error(`❌ ${errMsg}`);
            return reject(new Error(errMsg));
          }
          
          resolve();
        });

      })
      .catch(reject);
  });
}

function generateRecordId() {
  return Math.random().toString(36).substring(2, 10);
}

// Retrieve medical record
app.get('/api/retrieve/:recordId', async (req, res) => {
  try {
    const recordId = req.params.recordId;
    const recordPath = path.join(RECORDS_DIR, recordId);
    
    if (!fs.existsSync(recordPath)) {
      return res.status(404).json({ error: "Record not found" });
    }

    // Try to get input from MongoDB first
    let inputData;
    try {
      inputData = await Input.findOne({ recordId: recordId });
      
      if (!inputData) {
        console.log(`Input data not found in MongoDB for record: ${recordId}, falling back to file system`);
        const inputPath = path.join(recordPath, 'input.json');
        
        if (!fs.existsSync(inputPath)) {
          return res.status(404).json({ error: "Input data not found" });
        }

        inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      }
    } catch (error) {
      console.error("Error retrieving input from MongoDB:", error);
      // Fallback to file system
      const inputPath = path.join(recordPath, 'input.json');
      
      if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: "Input data not found" });
      }

      inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    }
    
    return res.json({
      recordId: recordId,
      data: inputData
    });
  } catch (error) {
    console.error('Retrieval error:', error);
    res.status(500).json({ error: "Retrieval failed" });

  }
});

// Verify medical record
app.get('/api/verify/:recordId', async (req, res) => {
  try {
    const recordId = req.params.recordId;
    const recordPath = path.join(RECORDS_DIR, recordId);
    
    if (!fs.existsSync(recordPath)) {
      return res.status(404).json({ error: "Record not found" });
    }

    const proofPath = path.join(recordPath, 'proof.json');
    const publicSignalsPath = path.join(recordPath, 'public.json');
    
    if (!fs.existsSync(proofPath) || !fs.existsSync(publicSignalsPath)) {
      return res.status(404).json({ error: "Proof not found" });
    }

    const vkey = require('./verification_key.json');
    const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    const publicSignals = JSON.parse(fs.readFileSync(publicSignalsPath, 'utf8'));

    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    return res.json({
      valid: isValid,
      recordId: recordId
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: "Verification failed" });
  }
});

app.listen(3000, () =>
  console.log("Medical Records System running on port 3000")
);
