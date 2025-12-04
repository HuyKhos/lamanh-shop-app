import mongoose from 'mongoose';

const configSchema = mongoose.Schema({
  key: { type: String, required: true, unique: true }, // Ví dụ: 'dashboard_note'
  value: { type: String, default: '' }
}, { timestamps: true });

const Config = mongoose.model('Config', configSchema);
export default Config;