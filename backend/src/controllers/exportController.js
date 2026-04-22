import mongoose from 'mongoose'; // Cần thêm để dùng session
import ExportReceipt from '../models/exportModel.js';
import Product from '../models/productModel.js';
import Partner from '../models/partnerModel.js';
import Counter from '../models/counterModel.js';

// --- 1. HÀM SINH MÃ TỰ ĐỘNG ---
export const generateExportCode = async () => {
  const now = new Date();
  const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`; 
  
  const counterId = `export_${dateStr}`;
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return `XK-${dateStr}-${String(counter.seq).padStart(3, '0')}`;
};

// --- 2. TẠO PHIẾU XUẤT (Đã bỏ Công nợ) ---
const createExport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, details, total_amount, note, payment_due_date, idempotency_key } = req.body;

    if (!idempotency_key) {
      throw new Error("Thiếu khóa bảo mật (idempotency_key). Vui lòng tải lại trang.");
    }

    if (!details || details.length === 0) throw new Error('Giỏ hàng rỗng');

    let totalPointsChange = 0;
    const enrichedDetails = [];

    // --- XỬ LÝ KHO & ĐIỂM ---
    for (const item of details) {
      const productUpdate = await Product.findOneAndUpdate(
        { _id: item.product_id, current_stock: { $gte: item.quantity } },
        { $inc: { current_stock: -item.quantity } },
        { session, new: true }
      );
      if (!productUpdate) throw new Error(`Sản phẩm ID ${item.product_id} không đủ hàng.`);
      
      totalPointsChange += (item.gift_points || 0) * item.quantity;

      const importPrice = productUpdate.import_price || 0;
      const lineProfit = (item.total || 0) - (importPrice * item.quantity);

      enrichedDetails.push({
        ...item,
        import_price: productUpdate.import_price || 0,
        profit: lineProfit
      });
    }

    // CẬP NHẬT: Chỉ cộng điểm cho khách, KHÔNG cộng current_debt nữa
    const updatedCustomer = await Partner.findByIdAndUpdate(
      customer_id,
      { $inc: { saved_points: totalPointsChange } }, 
      { session, new: true }
    );
    if (!updatedCustomer) throw new Error('Khách hàng không tồn tại');

    // --- LƯU PHIẾU ---
    const code = await generateExportCode();
    const exportReceipt = new ExportReceipt({
      code, 
      customer_id, 
      total_amount, 
      note, 
      details: enrichedDetails, 
      payment_due_date,
      partner_points_snapshot: updatedCustomer.saved_points,
      idempotency_key
    });
    
    await exportReceipt.save({ session });

    // Đã xóa phần tạo bảng ghi DebtRecord ở đây

    await session.commitTransaction();
    res.status(201).json({ receipt: exportReceipt, message: 'Xuất kho thành công!' });

  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000 && error.keyPattern && error.keyPattern.idempotency_key) {
      return res.status(409).json({ 
        message: 'Giao dịch này đã được xử lý thành công trước đó (Trùng lặp thao tác).' 
      });
    }
    res.status(400).json({ message: 'Lỗi tạo phiếu: ' + error.message });
  } finally {
    session.endSession();
  }
};

// --- 3. XÓA PHIẾU (Đã bỏ Công nợ) ---
const deleteExport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receipt = await ExportReceipt.findById(req.params.id).session(session);
    if (!receipt) throw new Error('Không tìm thấy phiếu');

    // 1. Hoàn lại kho (Atomic)
    for (const item of receipt.details) {
      await Product.findByIdAndUpdate(
        item.product_id,
        { $inc: { current_stock: item.quantity } },
        { session }
      );
    }

    // 2. Tính lại điểm cần hoàn
    let pointsToRevert = 0;
    for (const item of receipt.details) {
      pointsToRevert += (item.gift_points || 0) * item.quantity;
    }

    // 3. CẬP NHẬT: Chỉ hoàn lại Điểm cho khách (không trừ current_debt nữa)
    await Partner.findByIdAndUpdate(
      receipt.customer_id,
      { 
        $inc: { 
          saved_points: -pointsToRevert 
        } 
      },
      { session }
    );

    // 4. Xóa phiếu (Đã bỏ phần xóa DebtRecord)
    await ExportReceipt.deleteOne({ _id: receipt._id }).session(session);

    await session.commitTransaction();
    res.json({ message: 'Đã xóa phiếu, hoàn kho và điểm thành công.' });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Lỗi xóa phiếu: ' + error.message });
  } finally {
    session.endSession();
  }
};

// --- GIỮ NGUYÊN CÁC HÀM KHÁC ---
const getExports = async (req, res) => {
  try {
    const exports = await ExportReceipt.find({}).populate('customer_id', 'name phone address saved_points').sort({ createdAt: -1 });
    res.json(exports);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const updateExport = async (req, res) => {
  try {
    const { note, hide_price } = req.body;
    const receipt = await ExportReceipt.findByIdAndUpdate(
      req.params.id,
      { $set: { note, hide_price } },
      { new: true }
    );
    receipt ? res.json(receipt) : res.status(404).json({ message: 'Không tìm thấy phiếu' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const getNewExportCode = async (req, res) => {
  try {
    const now = new Date();
    const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`;
    const counterId = `export_${dateStr}`;
    const counter = await Counter.findOneAndUpdate({ _id: counterId }, { $setOnInsert: { seq: 0 } }, { new: true, upsert: true });
    res.json({ code: `XK-${dateStr}-${String(counter.seq + 1).padStart(3, '0')}` });
  } catch (error) { res.status(500).json({ message: "Lỗi sinh mã: " + error.message }); }
};

export { createExport, getExports, updateExport, deleteExport, getNewExportCode };