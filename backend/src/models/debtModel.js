import mongoose from 'mongoose';

// [SỬA] Đảm bảo tên biến Schema đồng nhất (trong file gốc bạn dùng debtSchema nhưng export debtRecordSchema)
const debtRecordSchema = new mongoose.Schema({
  partner_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Partner', 
    required: true 
  },
  reference_code: { type: String }, 
  amount: { type: Number, required: true },     // Tổng nợ ban đầu
  paid_amount: { type: Number, default: 0 },    // Đã trả
  
  // [THÊM] Trường này bắt buộc để truy vấn nhanh cho Dashboard
  remaining: { type: Number, default: 0 },      
  
  dueDate: { type: Date },
  note: { type: String },
  debt_snapshot: { type: Number } 
}, { timestamps: true });

// Middleware: Tự động tính remaining trước khi lưu (để đảm bảo dữ liệu luôn đúng)
debtRecordSchema.pre('save', function(next) {
  this.remaining = this.amount - (this.paid_amount || 0);
  next();
});

debtRecordSchema.index({ remaining: 1, dueDate: 1 });

const DebtRecord = mongoose.model('DebtRecord', debtRecordSchema);
export default DebtRecord;