import mongoose from 'mongoose';
import ImportReceipt from '../models/importModel.js';
import Product from '../models/productModel.js';
import DebtRecord from '../models/debtModel.js';
import Partner from '../models/partnerModel.js';
import Counter from '../models/counterModel.js';

// --- 1. HÀM SINH MÃ TỰ ĐỘNG (Đã sửa: Nhận session để rollback nếu lỗi) ---
export const generateImportCode = async (session = null) => {
  const now = new Date();
  const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`; 
  
  const counterId = `import_${dateStr}`;
  
  // Tùy chọn options cho mongoose query
  const options = { new: true, upsert: true, setDefaultsOnInsert: true };
  if (session) {
      options.session = session; // Quan trọng: Gắn session vào đây
  }

  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    options 
  );
  return `NK-${dateStr}-${String(counter.seq).padStart(3, '0')}`;
};

// --- 2. TẠO PHIẾU NHẬP (Đã sửa: Fix lỗi savedImport & Rollback Counter) ---
const createImport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Nhận dữ liệu
    const { supplier_id, details, total_amount, total_quantity, note, idempotency_key } = req.body;

    if (!idempotency_key) throw new Error("Thiếu khóa bảo mật (idempotency_key).");
    if (!details || details.length === 0) throw new Error('Giỏ hàng rỗng');

    // --- SINH MÃ (Truyền session vào để nếu lỗi thì không tăng số) ---
    const code = await generateImportCode(session);

    // --- CẬP NHẬT KHO ---
    for (const item of details) {
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product_id,
        { $inc: { current_stock: item.quantity } },
        { session, new: true }
      );
      if (!updatedProduct) throw new Error(`Sản phẩm ID ${item.product_id} lỗi.`);
    }

    // --- CẬP NHẬT CÔNG NỢ ---
    const supplier = await Partner.findByIdAndUpdate(
      supplier_id,
      { $inc: { current_debt: total_amount } },
      { session, new: true }
    );
    if (!supplier) throw new Error('Nhà cung cấp không tồn tại');

    // --- TẠO PHIẾU NHẬP (Instance) ---
    const importReceipt = new ImportReceipt({
      code, 
      supplier_id, 
      total_amount, 
      total_quantity, 
      note, 
      details,
      idempotency_key
    });

    // --- LƯU PHIẾU ---
    // Sửa lỗi: Không cần gán vào biến savedImport, dùng importReceipt._id trực tiếp
    await importReceipt.save({ session }); 

    // --- GHI NỢ ---
    const debt = new DebtRecord({
      partner_id: supplier_id,
      reference_code: code,
      reference_id: importReceipt._id, // Dùng ID trực tiếp từ đối tượng đã khởi tạo
      amount: total_amount, 
      paid_amount: 0,
      remaining_amount: total_amount,
    });
    await debt.save({ session });

    await session.commitTransaction();
    res.status(201).json({ receipt: importReceipt, message: 'Nhập kho thành công!' });

  } catch (error) {
    await session.abortTransaction(); // Mọi thay đổi (kể cả Counter) sẽ bị hủy

    // --- BẮT LỖI TRÙNG LẶP ---
    if (error.code === 11000 && error.keyPattern && error.keyPattern.idempotency_key) {
      return res.status(409).json({ 
        message: 'Phiếu nhập này đã được tạo thành công rồi (Trùng lặp thao tác).' 
      });
    }

    console.error("Lỗi Import:", error); // Log ra server để debug dễ hơn
    res.status(400).json({ message: 'Lỗi nhập kho: ' + error.message });
  } finally {
    session.endSession();
  }
};

// --- 3. XÓA PHIẾU NHẬP (Giữ nguyên) ---
const deleteImport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receipt = await ImportReceipt.findById(req.params.id).session(session);
    if (!receipt) throw new Error('Không tìm thấy phiếu');

    // 1. Trừ ngược tồn kho
    for (const item of receipt.details) {
      await Product.findByIdAndUpdate(
        item.product_id,
        { $inc: { current_stock: -item.quantity } },
        { session }
      );
    }

    // 2. Trừ ngược nợ nhà cung cấp
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

// --- CÁC HÀM CÒN LẠI (GET) ---
const getImports = async (req, res) => {
  try {
    const imports = await ImportReceipt.find({}).populate('supplier_id', 'name phone').sort({ createdAt: -1 });
    res.json(imports);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const getNewImportCode = async (req, res) => {
  try {
    // Hàm này chỉ để hiển thị mã dự kiến (preview), không cần transaction
    const now = new Date();
    const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`;
    const counterId = `import_${dateStr}`;
    const counter = await Counter.findOneAndUpdate({ _id: counterId }, { $setOnInsert: { seq: 0 } }, { new: true, upsert: true });
    res.json({ code: `NK-${dateStr}-${String(counter.seq + 1).padStart(3, '0')}` });
  } catch (error) { res.status(500).json({ message: "Lỗi sinh mã" }); }
};

export { createImport, getImports, deleteImport, getNewImportCode };