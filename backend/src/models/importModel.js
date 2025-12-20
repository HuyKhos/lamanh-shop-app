import mongoose from 'mongoose';

const importSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  supplier_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Partner', 
    required: true 
  },
  date: { type: Date, default: Date.now },
  
  total_quantity: { type: Number, default: 0 },
  total_amount: { type: Number, required: true },
  note: { type: String },

  // --- CẬP NHẬT MỚI: KHÓA CHỐNG TRÙNG LẶP ---
  // unique: true -> Đảm bảo không bao giờ có 2 phiếu cùng key này
  // sparse: true -> (Tùy chọn) Để các phiếu cũ (chưa có key) không bị lỗi duplicate null
  idempotency_key: { type: String, required: true, unique: true, index: true }, 
  // ------------------------------------------

  details: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    
    // GIỮ NGUYÊN CODE CŨ CỦA BẠN
    sku: { type: String }, 
    unit: { type: String },

    product_name_backup: String,
    quantity: Number,
    import_price: Number,
    total: Number
  }]
}, { timestamps: true });

const ImportReceipt = mongoose.model('ImportReceipt', importSchema);
export default ImportReceipt;