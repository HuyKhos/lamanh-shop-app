import ExportReceipt from '../models/exportModel.js';
import Product from '../models/productModel.js';
import DebtRecord from '../models/debtModel.js';
import Partner from '../models/partnerModel.js';
import Counter from '../models/counterModel.js';

// --- 1. HÀM SINH MÃ TỰ ĐỘNG (GIỮ NGUYÊN) ---
export const generateExportCode = async () => {
  const now = new Date();
  const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  
  const year = dateInVietnam.getFullYear().toString().slice(-2);
  const month = String(dateInVietnam.getMonth() + 1).padStart(2, '0');
  const day = String(dateInVietnam.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`; 
  
  const counterId = `export_${dateStr}`;

  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequence = counter ? counter.seq : 1;
  return `XK-${dateStr}-${String(sequence).padStart(3, '0')}`;
};

// --- 2. API LẤY MÃ MỚI CHO FRONTEND (GIỮ NGUYÊN) ---
const getNewExportCode = async (req, res) => {
  try {
    const now = new Date();
    const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    const year = dateInVietnam.getFullYear().toString().slice(-2);
    const month = String(dateInVietnam.getMonth() + 1).padStart(2, '0');
    const day = String(dateInVietnam.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    const counterId = `export_${dateStr}`;
    
    const counter = await Counter.findByIdAndUpdate(
      counterId,
      { $setOnInsert: { seq: 0 } },
      { new: true, upsert: true }
    );
    
    const nextSeq = counter.seq + 1;
    const newCode = `XK-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
    
    res.json({ code: newCode });
  } catch (error) {
    res.status(500).json({ message: "Lỗi sinh mã: " + error.message });
  }
};

// --- 3. TẠO PHIẾU XUẤT (GIỮ NGUYÊN) ---
const createExport = async (req, res) => {
  try {
    const { customer_id, details, total_amount, note, payment_due_date} = req.body;

    if (!details || details.length === 0) return res.status(400).json({ message: 'Giỏ hàng rỗng' });

    // Tính tổng điểm phát sinh
    let totalPointsChange = 0;
    
    // Kiểm tra tồn kho và Tính điểm
    for (const item of details) {
      const product = await Product.findById(item.product_id);
      if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
      
      if (product.current_stock < item.quantity) {
        return res.status(400).json({ message: `Sản phẩm ${product.name} không đủ hàng (Tồn: ${product.current_stock})` });
      }
      
      totalPointsChange += (item.gift_points || 0) * item.quantity;
    }

    // Kiểm tra khách hàng
    const customer = await Partner.findById(customer_id);
    if (!customer) return res.status(404).json({ message: 'Khách hàng không tồn tại' });

    const newCustomerPoints = (customer.saved_points || 0) + totalPointsChange;

    // Lưu phiếu
    const code = await generateExportCode();
    const exportReceipt = new ExportReceipt({
      code, 
      customer_id, 
      total_amount, 
      note,
      details,
      payment_due_date,
      partner_points_snapshot: newCustomerPoints 
    });
    const savedExport = await exportReceipt.save();

    // Trừ kho
    for (const item of details) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.current_stock = product.current_stock - item.quantity;
        await product.save();
      }
    }

    // Ghi nợ
    const debt = new DebtRecord({
      partner_id: customer_id,
      reference_code: code,
      amount: total_amount,
      remaining_amount: total_amount,
      dueDate: payment_due_date,
    });
    await debt.save();

    // Cập nhật Nợ và Điểm cho khách
    customer.current_debt = customer.current_debt + total_amount;
    customer.saved_points = newCustomerPoints;
    await customer.save();

    res.status(201).json({ receipt: savedExport, message: 'Xuất kho thành công!' });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi: ' + error.message });
  }
};

// --- 4. LẤY DANH SÁCH (GIỮ NGUYÊN) ---
const getExports = async (req, res) => {
  try {
    const exports = await ExportReceipt.find({})
      .populate('customer_id', 'name phone address saved_points') // Populate thêm saved_points để frontend dùng nếu cần
      .sort({ createdAt: -1 });
    res.json(exports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 5. CẬP NHẬT GHI CHÚ (GIỮ NGUYÊN) ---
const updateExport = async (req, res) => {
  try {
    const { note, hide_price } = req.body;
    const receipt = await ExportReceipt.findById(req.params.id);

    if (receipt) {
      receipt.note = note !== undefined ? note : receipt.note;
      receipt.hide_price = hide_price !== undefined ? hide_price : receipt.hide_price;
      
      const updatedReceipt = await receipt.save();
      res.json(updatedReceipt);
    } else {
      res.status(404).json({ message: 'Không tìm thấy phiếu' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 6. XÓA PHIẾU (ĐÃ CẬP NHẬT LOGIC HOÀN ĐIỂM) ---
const deleteExport = async (req, res) => {
  try {
    const receipt = await ExportReceipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ message: 'Không tìm thấy phiếu' });

    // A. Hoàn lại kho (Cộng lại số lượng)
    for (const item of receipt.details) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.current_stock = product.current_stock + item.quantity;
        await product.save();
      }
    }

    // B. Xử lý Khách hàng (Trừ nợ & Hoàn điểm)
    const customer = await Partner.findById(receipt.customer_id);
    if (customer) {
      // 1. Trừ nợ
      customer.current_debt = customer.current_debt - receipt.total_amount;

      // 2. Hoàn điểm (Logic mới thêm vào)
      // Tính tổng điểm của phiếu này
      let pointsToRevert = 0;
      for (const item of receipt.details) {
          pointsToRevert += (item.gift_points || 0) * item.quantity;
      }
      
      // Lúc tạo phiếu ta CỘNG điểm, thì giờ xóa phiếu ta phải TRỪ điểm
      // (Nếu là phiếu đổi quà có điểm âm, thì trừ số âm sẽ thành cộng lại => Logic vẫn đúng)
      customer.saved_points = (customer.saved_points || 0) - pointsToRevert;

      await customer.save();
    }

    // C. Xóa ghi nợ và Xóa phiếu
    await DebtRecord.deleteOne({ reference_code: receipt.code });
    await receipt.deleteOne();

    res.json({ message: 'Đã xóa phiếu, hoàn kho và cập nhật lại điểm.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { createExport, getExports, updateExport, deleteExport, getNewExportCode };