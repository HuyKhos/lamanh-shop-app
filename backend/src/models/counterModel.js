import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // VD: 'import_20251127'
  seq: { type: Number, default: 0 }      // Số thứ tự hiện tại
});

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;