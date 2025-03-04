pragma circom 2.1.4;

template MedicalRecord() {
    signal input patientAge;
    signal input departmentId;
    signal input conditionSeverity;
    signal input admissionDate;
    signal input dischargeDate;
    signal input doctorId;
    signal input treatmentCode;

    // Public outputs
    signal output publicDepartmentId;
    signal output publicAdmissionYear;

    // Circuit logic
    publicDepartmentId <== departmentId;
    publicAdmissionYear <== admissionDate / 31536000; // Approximate year calculation
}

component main = MedicalRecord();
