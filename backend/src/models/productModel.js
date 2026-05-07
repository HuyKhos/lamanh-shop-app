import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  brand: { type: String, trim: true },
  unit: { type: String },
  
  import_price: { type: Number, default: 0 },
  export_price: { type: Number, default: 0 },
  
  // ĐÃ XÓA: discount_percent
  gift_points: { type: Number, default: 0 },
  
  current_stock: { type: Number, default: 0 },

  min_stock: { type: Number, default: 10 } 
  
}, { timestamps: true });

productSchema.index({ name: 'text', sku: 'text' });

const Product = mongoose.model('Product', productSchema);
export default Product;