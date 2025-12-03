import ImportReceipt from '../models/importModel.js';
import Product from '../models/productModel.js';
import DebtRecord from '../models/debtModel.js';
import Partner from '../models/partnerModel.js';
import Counter from '../models/counterModel.js'; // <--- Import mới

// HÀM SINH MÃ "CHỐNG GIAN LẬN"
export const generateImportCode = async () => {
    // Lấy ngày giờ chuẩn Việt Nam (Tránh lỗi server giờ UTC)
    const now = new Date();
    const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    const year = dateInVietnam.getFullYear().toString().slice(-2);
    const month = String(dateInVietnam.getMonth() + 1).padStart(2, '0');
    const day = String(dateInVietnam.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`; // Ví dụ: 250112
    
    const counterId = `import_${dateStr}`;

    // Tìm và tăng seq lên 1. Nếu chưa có thì tự tạo mới (upsert: true)
    const counter = await Counter.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true } 
    );

    // Mã phiếu: NK-250112-001
    return `NK-${dateStr}-${String(counter.seq).padStart(3, '0')}`;
};

const getNewImportCode = async (req, res) => {
  try {
    // Lấy ngày giờ chuẩn Việt Nam
    const now = new Date();
    const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    const year = dateInVietnam.getFullYear().toString().slice(-2);
    const month = String(dateInVietnam.getMonth() + 1).padStart(2, '0');
    const day = String(dateInVietnam.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    const counterId = `import_${dateStr}`;

    // Tìm bộ đếm hiện tại (Chỉ xem, KHÔNG TĂNG)
    // Dùng upsert để nếu chưa có thì tạo sẵn seq=0
    const counter = await Counter.findByIdAndUpdate(
      counterId,
      { $setOnInsert: { seq: 0 } }, 
      { new: true, upsert: true }
    );
    
    // Dự đoán mã tiếp theo = seq hiện tại + 1
    const nextSeq = counter.seq + 1;
    const newCode = `NK-${dateStr}-${String(nextSeq).padStart(3, '0')}`;

    res.json({ code: newCode });
  } catch (error) {
    console.error("Lỗi lấy mã gợi ý:", error);
    res.status(500).json({ message: "Lỗi sinh mã" });
  }
};

// @desc    Tạo phiếu nhập kho
const createImport = async (req, res) => {
  try {
    const { supplier_id, details, total_amount, total_quantity, note } = req.body;

    if (!details || details.length === 0) return res.status(400).json({ message: 'Giỏ hàng rỗng' });

    // 1. Sinh mã từ bộ đếm riêng (Không bao giờ trùng lại số cũ)
    const code = await generateImportCode();

    const importReceipt = new ImportReceipt({
      code, supplier_id, total_amount, total_quantity, note, details
    });
    const savedImport = await importReceipt.save();

    // 2. Cộng kho
    for (const item of details) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.current_stock = product.current_stock + item.quantity;
        await product.save();
      }
    }

    // 3. Ghi nợ
    const debt = new DebtRecord({
      partner_id: supplier_id,
      reference_code: code,
      reference_id: savedImport._id,
      amount: total_amount, 
      paid_amount: 0,
      remaining_amount: total_amount,
    });
    await debt.save();

    const supplier = await Partner.findById(supplier_id);
    if (supplier) {
      supplier.current_debt = supplier.current_debt + total_amount;
      await supplier.save();
    }

    res.status(201).json({ receipt: savedImport, message: 'Nhập kho thành công!' });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi: ' + error.message });
  }
};

// @desc    Lấy danh sách
const getImports = async (req, res) => {
  try {
    const imports = await ImportReceipt.find({})
      .populate('supplier_id', 'name phone')
      .sort({ createdAt: -1 });
    res.json(imports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Xóa phiếu (Giữ nguyên logic trừ ngược kho/nợ)
const deleteImport = async (req, res) => {
  try {
    const receipt = await ImportReceipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ message: 'Không tìm thấy phiếu' });

    // Trừ kho
    for (const item of receipt.details) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.current_stock = product.current_stock - item.quantity;
        await product.save();
      }
    }
    // Trừ nợ
    const supplier = await Partner.findById(receipt.supplier_id);
    if (supplier) {
      supplier.current_debt = supplier.current_debt - receipt.total_amount;
      await supplier.save();
    }
    // Xóa công nợ
    await DebtRecord.deleteOne({ reference_code: receipt.code });
    // Xóa phiếu
    await receipt.deleteOne();

    res.json({ message: 'Đã xóa phiếu nhập. (Lưu ý: Mã phiếu này sẽ không được cấp lại)' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- BỎ HÀM updateImport ---

export { createImport, getImports, deleteImport, getNewImportCode, };