import mongoose from 'mongoose';

const partnerSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  type: { 
    type: String, 
    enum: ['customer', 'supplier'], 
    required: true 
  },
  phone: { 
    type: String, 
    unique: true, 
    sparse: true
  },
  address: { type: String },
  
  saved_points: { type: Number, default: 0 },
  current_debt: { type: Number, default: 0 },
  
  // --- THÊM 2 TRƯỜNG NÀY ---
  is_wholesale: { type: Boolean, default: false }, // True = Khách sỉ (Hưởng CK% sản phẩm)
  hide_price: { type: Boolean, default: false },   // True = Ẩn giá trên phiếu in
  
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

partnerSchema.index({ name: 'text', phone: 'text' });

const Partner = mongoose.model('Partner', partnerSchema);
export default Partner;