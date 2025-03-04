const express = require('express');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
app.use(bodyParser.json());

// Storage structure
const STORAGE_DIR = './medical_records';

// Ensure storage directories exist
async function initializeDirectories() {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
}

// Helper function to generate unique ID
function generatePatientId() {
    return crypto.randomBytes(16).toString('hex');
}

// Convert medical data to circuit-compatible numbers
function convertMedicalData(input) {
    const diagnosisMap = {
        'HEALTHY': 1,
        'MILD': 2,
        'MODERATE': 3,
        'SEVERE': 4,
        'CRITICAL': 5
    };

    const departmentMap = {
        'CARDIOLOGY': 1,
        'NEUROLOGY': 2,
        'ONCOLOGY': 3,
        'PEDIATRICS': 4,
        'GENERAL': 5
    };

    // Convert all values to numbers and ensure they're within field size
    return {
        patientAge: parseInt(input.patientAge) || 0,
        departmentId: departmentMap[input.department.toUpperCase()] || 0,
        conditionSeverity: diagnosisMap[input.severity.toUpperCase()] || 0,
        admissionDate: parseInt(input.admissionDate) || Math.floor(Date.now() / 1000),
        dischargeDate: parseInt(input.dischargeDate) || 0,
        doctorId: parseInt(input.doctorId.replace(/[^0-9]/g, '')) || 0,
        treatmentCode: parseInt(input.treatmentCode) || 0,
        // Public information
        publicDepartmentId: departmentMap[input.department.toUpperCase()] || 0,
        publicAdmissionYear: new Date(input.admissionDate * 1000).getFullYear()
    };
}

// Store medical record data
async function storeMedicalRecord(recordId, data) {
    const recordDir = path.join(STORAGE_DIR, recordId);
    await fs.mkdir(recordDir, { recursive: true });
    await fs.writeFile(
        path.join(recordDir, 'record.json'), 
        JSON.stringify(data, null, 2)
    );
}

// API endpoint for doctor to submit initial medical record
app.post('/api/submit-medical-record', async (req, res) => {
    try {
        const recordId = generatePatientId();
        const convertedData = convertMedicalData(req.body);
        
        // Store initial record
        await storeMedicalRecord(recordId, {
            status: 'pending_review',
            medicalData: convertedData,
            timestamp: Date.now(),
            lastModified: Date.now(),
            accessLog: [{
                doctorId: convertedData.doctorId,
                timestamp: Date.now(),
                action: 'CREATED'
            }]
        });

        res.json({
            success: true,
            recordId,
            message: 'Medical record created successfully'
        });
    } catch (error) {
        console.error('Error creating medical record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create medical record'
        });
    }
});

// API endpoint for updating medical record
app.post('/api/update-medical-record/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const recordDir = path.join(STORAGE_DIR, recordId);
        
        // Read existing record
        const existingRecord = JSON.parse(
            await fs.readFile(path.join(recordDir, 'record.json'), 'utf8')
        );

        // Update with new medical data
        const updatedData = convertMedicalData(req.body);
        const combinedData = {
            ...existingRecord.medicalData,
            ...updatedData
        };

        // Store input for witness generation
        await fs.writeFile(
            path.join(recordDir, 'input.json'),
            JSON.stringify(combinedData, null, 2)
        );

        // Update record
        existingRecord.status = 'pending_proof_generation';
        existingRecord.medicalData = combinedData;
        existingRecord.lastModified = Date.now();
        existingRecord.accessLog.push({
            doctorId: updatedData.doctorId,
            timestamp: Date.now(),
            action: 'UPDATED'
        });

        await storeMedicalRecord(recordId, existingRecord);

        // Generate proof
        await generateProof(recordId);

        res.json({
            success: true,
            message: 'Medical record updated and proof generated',
            verificationLink: `/verify/${recordId}`
        });
    } catch (error) {
        console.error('Error updating medical record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update medical record'
        });
    }
});

// Generate ZK proof for medical record
async function generateProof(recordId) {
    const recordDir = path.join(STORAGE_DIR, recordId);
    
    try {
        // Generate witness
        await execPromise(
            `node medical_records_js/generate_witness.js medical_records_js/medical_records.wasm ${path.join(recordDir, 'input.json')} ${path.join(recordDir, 'witness.wtns')}`
        );

        // Generate proof
        await execPromise(
            `snarkjs groth16 prove medical_records_0001.zkey ${path.join(recordDir, 'witness.wtns')} ${path.join(recordDir, 'proof.json')} ${path.join(recordDir, 'public.json')}`
        );

        // Update status
        const record = JSON.parse(await fs.readFile(path.join(recordDir, 'record.json'), 'utf8'));
        record.status = 'proof_generated';
        await storeMedicalRecord(recordId, record);
    } catch (error) {
        console.error('Error in proof generation:', error);
        throw error;
    }
}

// API endpoint to verify medical record proof
app.get('/api/verify/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const recordDir = path.join(STORAGE_DIR, recordId);

        // Verify the proof
        const { stdout } = await execPromise(
            `snarkjs groth16 verify verification_key.json ${path.join(recordDir, 'public.json')} ${path.join(recordDir, 'proof.json')}`
        );

        const isValid = stdout.includes('OK');

        // Add verification to access log
        const record = JSON.parse(await fs.readFile(path.join(recordDir, 'record.json'), 'utf8'));
        record.accessLog.push({
            timestamp: Date.now(),
            action: 'VERIFIED',
            result: isValid
        });
        await storeMedicalRecord(recordId, record);

        res.json({
            success: true,
            isValid,
            recordId,
            verificationResult: isValid ? 'Valid medical record' : 'Invalid medical record'
        });
    } catch (error) {
        console.error('Error verifying medical record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify medical record'
        });
    }
});

// API endpoint to get public record information
app.get('/api/public-record/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const recordDir = path.join(STORAGE_DIR, recordId);
        
        const record = JSON.parse(
            await fs.readFile(path.join(recordDir, 'record.json'), 'utf8')
        );

        // Only return public information
        res.json({
            success: true,
            publicInfo: {
                department: record.medicalData.publicDepartmentId,
                admissionYear: record.medicalData.publicAdmissionYear,
                lastModified: record.lastModified
            }
        });
    } catch (error) {
        console.error('Error retrieving public record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve public record'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await initializeDirectories();
    console.log(`Medical Records System running on port ${PORT}`);
});