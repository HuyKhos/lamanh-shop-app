import mongoose from 'mongoose';

const debtSchema = new mongoose.Schema({
  partner_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Partner', 
    required: true 
  },
  reference_code: { type: String }, 
  amount: { type: Number, required: true },
  paid_amount: { type: Number, default: 0 },
  dueDate: { type: Date },
  note: { type: String },
  debt_snapshot: { type: Number } 
}, { timestamps: true });

const DebtRecord = mongoose.model('DebtRecord', debtSchema);
export default DebtRecord;