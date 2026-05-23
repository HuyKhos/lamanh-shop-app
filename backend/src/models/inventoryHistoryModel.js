import mongoose from 'mongoose';

const inventoryHistorySchema = new mongoose.Schema({
  product_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true, 
    index: true // Đánh index để truy vấn nhanh theo sản phẩm
  },
  type: { 
    type: String, 
    required: true, 
    enum: ['IMPORT', 'EXPORT', 'UPDATE_MANUAL', 'DELETE_IMPORT', 'DELETE_EXPORT'] 
  },
  reference_code: { type: String }, // Lưu mã phiếu (VD: XK-260512-006)
  change_quantity: { type: Number, required: true }, // Số lượng thay đổi (Âm hoặc Dương)
  previous_stock: { type: Number, required: true },  // Tồn kho trước khi đổi
  new_stock: { type: Number, required: true },       // Tồn kho sau khi đổi
  note: { type: String }                             // Ghi chú giải thích
}, { timestamps: true });

// Index thêm createdAt để sắp xếp lịch sử theo thời gian nhanh hơn
inventoryHistorySchema.index({ product_id: 1, createdAt: -1 });

const InventoryHistory = mongoose.model('InventoryHistory', inventoryHistorySchema);
export default InventoryHistory;