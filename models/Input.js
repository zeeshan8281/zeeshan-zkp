const mongoose = require('mongoose');

const inputSchema = new mongoose.Schema({
  recordId: {
    type: String,
    required: true,
    unique: true
  },
  patientAge: Number,
  departmentId: Number,
  conditionSeverity: Number,
  admissionDate: Number,
  dischargeDate: Number,
  doctorId: Number,
  treatmentCode: Number,
  publicDepartmentId: Number,
  publicAdmissionYear: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Input', inputSchema);
