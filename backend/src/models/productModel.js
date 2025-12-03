import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  unit: { type: String },
  
  import_price: { type: Number, default: 0 },
  export_price: { type: Number, default: 0 },
  
  discount_percent: { type: Number, default: 0 },
  gift_points: { type: Number, default: 0 },
  
  current_stock: { type: Number, default: 0 },

  // --- SỬA ĐOẠN NÀY ---
  // note: { type: String }  <-- Xóa cái này
  min_stock: { type: Number, default: 10 } // <-- Thêm cái này (Mặc định là 5)
  
}, { timestamps: true });

productSchema.index({ name: 'text', sku: 'text' });

const Product = mongoose.model('Product', productSchema);
export default Product;