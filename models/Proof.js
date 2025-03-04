const mongoose = require('mongoose');

const proofSchema = new mongoose.Schema({
  recordId: {
    type: String,
    required: true,
    unique: true
  },
  proof: {
    type: Object,
    required: true
  },
  publicSignals: {
    type: Object,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Proof', proofSchema);
