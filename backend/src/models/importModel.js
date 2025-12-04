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

  // --- CẬP NHẬT PHẦN NÀY ---
  details: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    
    // BỔ SUNG 2 DÒNG NÀY ĐỂ LƯU ĐƯỢC MÃ VÀ ĐƠN VỊ
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