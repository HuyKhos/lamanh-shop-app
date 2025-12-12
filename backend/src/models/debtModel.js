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
  
  // Trường quan trọng để lọc công nợ còn lại
  remaining: { type: Number, default: 0 },

  dueDate: { type: Date },
  note: { type: String },
  debt_snapshot: { type: Number } 
}, { timestamps: true });

// --- MIDDLEWARE TÍNH TOÁN TỰ ĐỘNG ---
// Trước khi lưu, tự động tính remaining = amount - paid_amount
debtSchema.pre('save', function(next) {
  this.remaining = this.amount - (this.paid_amount || 0);
  next();
});

// --- INDEX ---
// Sửa lỗi ở đây: dùng đúng tên biến "debtSchema" đã khai báo ở trên
debtSchema.index({ remaining: 1, dueDate: 1 });

const DebtRecord = mongoose.model('DebtRecord', debtSchema);
export default DebtRecord;