import mongoose from 'mongoose';
import ImportReceipt from '../models/importModel.js';
import Product from '../models/productModel.js';
import DebtRecord from '../models/debtModel.js';
import Partner from '../models/partnerModel.js';
import Counter from '../models/counterModel.js';

// --- 1. HÀM SINH MÃ TỰ ĐỘNG ---
export const generateImportCode = async () => {
  const now = new Date();
  const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`; 
  
  const counterId = `import_${dateStr}`;
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true } 
  );
  return `NK-${dateStr}-${String(counter.seq).padStart(3, '0')}`;
};

// --- 2. TẠO PHIẾU NHẬP (Cập nhật: Transaction & Atomic) ---
const createImport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Nhận idempotency_key
    const { supplier_id, details, total_amount, total_quantity, note, idempotency_key } = req.body;

    if (!idempotency_key) throw new Error("Thiếu khóa bảo mật (idempotency_key).");
    if (!details || details.length === 0) throw new Error('Giỏ hàng rỗng');

    // --- SINH MÃ & CẬP NHẬT KHO/NỢ (Giữ nguyên logic cũ) ---
    const code = await generateImportCode();

    for (const item of details) {
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product_id,
        { $inc: { current_stock: item.quantity } },
        { session, new: true }
      );
      if (!updatedProduct) throw new Error(`Sản phẩm ID ${item.product_id} lỗi.`);
    }

    const supplier = await Partner.findByIdAndUpdate(
      supplier_id,
      { $inc: { current_debt: total_amount } },
      { session, new: true }
    );
    if (!supplier) throw new Error('Nhà cung cấp không tồn tại');

    // --- LƯU PHIẾU (Thêm idempotency_key) ---
    const importReceipt = new ImportReceipt({
      code, 
      supplier_id, 
      total_amount, 
      total_quantity, 
      note, 
      details,
      idempotency_key // <--- Lưu vào đây
    });
    await importReceipt.save({ session });

    // --- GHI NỢ (Giữ nguyên) ---
    const debt = new DebtRecord({
      partner_id: supplier_id,
      reference_code: code,
      reference_id: savedImport._id, // Lưu ý: savedImport là kết quả của lệnh save() trên
      amount: total_amount, 
      paid_amount: 0,
      remaining_amount: total_amount,
    });
    await debt.save({ session });

    await session.commitTransaction();
    res.status(201).json({ receipt: importReceipt, message: 'Nhập kho thành công!' });

  } catch (error) {
    await session.abortTransaction();

    // --- BẮT LỖI TRÙNG LẶP ---
    if (error.code === 11000 && error.keyPattern && error.keyPattern.idempotency_key) {
      return res.status(409).json({ 
        message: 'Phiếu nhập này đã được tạo thành công rồi (Trùng lặp thao tác).' 
      });
    }

    res.status(400).json({ message: 'Lỗi nhập kho: ' + error.message });
  } finally {
    session.endSession();
  }
};

// --- 3. XÓA PHIẾU NHẬP (Cập nhật: Transaction & Atomic) ---
const deleteImport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receipt = await ImportReceipt.findById(req.params.id).session(session);
    if (!receipt) throw new Error('Không tìm thấy phiếu');

    // 1. Trừ ngược tồn kho (Atomic Update)
    for (const item of receipt.details) {
      // Lưu ý: Có thể thêm kiểm tra nếu (current_stock - item.quantity < 0) nếu muốn ngăn xóa
      await Product.findByIdAndUpdate(
        item.product_id,
        { $inc: { current_stock: -item.quantity } },
        { session }
      );
    }

    // 2. Trừ ngược nợ nhà cung cấp (Atomic Update)
    await Partner.findByIdAndUpdate(
      receipt.supplier_id,
      { $inc: { current_debt: -receipt.total_amount } },
      { session }
    );

    // 3. Xóa hồ sơ nợ và Phiếu nhập
    await DebtRecord.deleteOne({ reference_code: receipt.code }).session(session);
    await ImportReceipt.deleteOne({ _id: receipt._id }).session(session);

    await session.commitTransaction();
    res.json({ message: 'Đã xóa phiếu nhập và hoàn tác dữ liệu thành công.' });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Lỗi xóa phiếu: ' + error.message });
  } finally {
    session.endSession();
  }
};

// --- CÁC HÀM CÒN LẠI (GIỮ NGUYÊN) ---
const getImports = async (req, res) => {
  try {
    const imports = await ImportReceipt.find({}).populate('supplier_id', 'name phone').sort({ createdAt: -1 });
    res.json(imports);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const getNewImportCode = async (req, res) => {
  try {
    const now = new Date();
    const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`;
    const counterId = `import_${dateStr}`;
    const counter = await Counter.findOneAndUpdate({ _id: counterId }, { $setOnInsert: { seq: 0 } }, { new: true, upsert: true });
    res.json({ code: `NK-${dateStr}-${String(counter.seq + 1).padStart(3, '0')}` });
  } catch (error) { res.status(500).json({ message: "Lỗi sinh mã" }); }
};

export { createImport, getImports, deleteImport, getNewImportCode };