import mongoose from 'mongoose';

const exportSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  customer_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Partner', 
    required: true 
  },
  date: { type: Date, default: Date.now },

  payment_due_date: { type: Date },   // Hạn thanh toán
  
  total_amount: { type: Number, required: true },
  note: { type: String },
  hide_price: { type: Boolean, default: false }, // Ẩn giá khi in

  // Lưu tổng điểm của khách hàng NGAY TẠI THỜI ĐIỂM CHỐT ĐƠN
  partner_points_snapshot: { type: Number, default: 0 },

  // --- CẬP NHẬT MỚI: KHÓA CHỐNG TRÙNG LẶP ---
  idempotency_key: { type: String, required: true, unique: true, index: true },
  // ------------------------------------------

  details: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    
    // GIỮ NGUYÊN CODE CŨ CỦA BẠN
    sku: String,          // Mã SP
    unit: String,         // Đơn vị
    gift_points: Number,  // <--- QUAN TRỌNG: Lưu điểm vào đây
    
    product_name_backup: String,
    quantity: Number,
    import_price: Number, // Lưu giá vốn tại thời điểm xuất
    export_price: Number,
    discount: Number,
    total: Number,
    profit: Number
  }]
}, { timestamps: true });

const ExportReceipt = mongoose.model('ExportReceipt', exportSchema);
export default ExportReceipt;