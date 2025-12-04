import ExportReceipt from '../models/exportModel.js';
import Product from '../models/productModel.js';
import DebtRecord from '../models/debtModel.js';
import Partner from '../models/partnerModel.js';
import Counter from '../models/counterModel.js';

// Sinh mã phiếu Xuất: XK-251128-001
export const generateExportCode = async () => {
  // 1. Lấy ngày giờ hiện tại theo múi giờ Việt Nam
  const now = new Date();
  const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  
  // 2. Tạo chuỗi YYMMDD (Ví dụ: 251129)
  const year = dateInVietnam.getFullYear().toString().slice(-2);
  const month = String(dateInVietnam.getMonth() + 1).padStart(2, '0');
  const day = String(dateInVietnam.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`; // 251129
  
  const counterId = `export_${dateStr}`; // ID: export_251129

  // 3. Tìm và update (Tự tạo mới nếu chưa có nhờ upsert: true)
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequence = counter ? counter.seq : 1;
  // Mã phiếu: XK-251129-001
  return `XK-${dateStr}-${String(sequence).padStart(3, '0')}`;
};

// API lấy mã mới cho Frontend (Preview)
const getNewExportCode = async (req, res) => {
  try {
    // 1. Lấy ngày giờ chuẩn Việt Nam
    const now = new Date();
    const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    const year = dateInVietnam.getFullYear().toString().slice(-2);
    const month = String(dateInVietnam.getMonth() + 1).padStart(2, '0');
    const day = String(dateInVietnam.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`; // Ví dụ: 251129
    
    const counterId = `export_${dateStr}`;
    
    // 2. Tìm counter hiện tại (Chỉ khởi tạo nếu chưa có, KHÔNG TĂNG SỐ)
    const counter = await Counter.findByIdAndUpdate(
      counterId,
      { $setOnInsert: { seq: 0 } }, // Nếu chưa có thì set seq = 0
      { new: true, upsert: true }   // Trả về document
    );
    
    // 3. Dự đoán mã tiếp theo (Seq hiện tại + 1)
    const nextSeq = counter.seq + 1;
    const newCode = `XK-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
    
    res.json({ code: newCode });
  } catch (error) {
    res.status(500).json({ message: "Lỗi sinh mã: " + error.message });
  }
};

// @desc    Tạo phiếu xuất
// @desc    Tạo phiếu xuất (Bán hàng & Đổi quà)
const createExport = async (req, res) => {
  try {
    // Bỏ trường added_points nhập tay, thay bằng logic tự động
    const { customer_id, details, total_amount, note, payment_due_date} = req.body;

    if (!details || details.length === 0) return res.status(400).json({ message: 'Giỏ hàng rỗng' });

    // 1. Tính tổng điểm phát sinh trong phiếu này
    // (Mua hàng thì dương, Đổi quà thì âm)
    let totalPointsChange = 0;
    
    // 2. Kiểm tra tồn kho và Tính điểm
    for (const item of details) {
      const product = await Product.findById(item.product_id);
      if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
      
      if (product.current_stock < item.quantity) {
        return res.status(400).json({ message: `Sản phẩm ${product.name} không đủ hàng (Tồn: ${product.current_stock})` });
      }
      
      // Cộng dồn điểm: (Điểm SP * Số lượng)
      // Lưu ý: item.gift_points có thể là số âm nếu nhân viên nhập tay để đổi quà
      totalPointsChange += (item.gift_points || 0) * item.quantity;
    }

    // 3. Kiểm tra điểm khách hàng (Nếu đổi quà quá tay)
    const customer = await Partner.findById(customer_id);
    if (!customer) return res.status(404).json({ message: 'Khách hàng không tồn tại' });

    // Điểm dự kiến sau khi xong đơn
    const newCustomerPoints = (customer.saved_points || 0) + totalPointsChange;

    if (newCustomerPoints < 0) {
      return res.status(400).json({ 
        message: `Khách không đủ điểm đổi quà! Hiện có: ${customer.saved_points}, Cần trừ: ${Math.abs(totalPointsChange)}` 
      });
    }

    // 4. Sinh mã và Lưu phiếu
    const code = await generateExportCode();
    const exportReceipt = new ExportReceipt({
      code, 
      customer_id, 
      total_amount, 
      note,
      details,
      payment_due_date,
      // LƯU LẠI ĐIỂM CUỐI CÙNG CỦA KHÁCH VÀO ĐÂY
      partner_points_snapshot: newCustomerPoints 
    });
    const savedExport = await exportReceipt.save();

    // 5. Trừ kho
    for (const item of details) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.current_stock = product.current_stock - item.quantity;
        await product.save();
      }
    }

    // 6. Ghi nợ & Cập nhật điểm khách hàng
    const debt = new DebtRecord({
      partner_id: customer_id,
      reference_code: code,
      amount: total_amount,
      dueDate: payment_due_date,
      remaining_amount: total_amount,
    });
    await debt.save();

    // Cập nhật tiền nợ VÀ điểm tích lũy mới
    customer.current_debt = customer.current_debt + total_amount;
    customer.saved_points = newCustomerPoints; // Lưu điểm mới
    await customer.save();

    res.status(201).json({ receipt: savedExport, message: 'Xuất kho & Cập nhật điểm thành công!' });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi: ' + error.message });
  }
};

// @desc    Lấy danh sách phiếu xuất
const getExports = async (req, res) => {
  try {
    const exports = await ExportReceipt.find({})
      .populate('customer_id', 'name phone address')
      .sort({ createdAt: -1 });
    res.json(exports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cập nhật thông tin phiếu (Chỉ cho sửa Ghi chú & Cấu hình in)
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

// @desc    Xóa phiếu xuất (Hoàn lại kho, Trừ nợ khách)
const deleteExport = async (req, res) => {
  try {
    const receipt = await ExportReceipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ message: 'Không tìm thấy phiếu' });

    // Hoàn lại kho (Cộng lại)
    for (const item of receipt.details) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.current_stock = product.current_stock + item.quantity;
        await product.save();
      }
    }

    // Trừ nợ khách
    const customer = await Partner.findById(receipt.customer_id);
    if (customer) {
      customer.current_debt = customer.current_debt - receipt.total_amount;
      await customer.save();
    }

    await DebtRecord.deleteOne({ reference_code: receipt.code });
    await receipt.deleteOne();

    res.json({ message: 'Đã xóa phiếu xuất và hoàn kho.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { createExport, getExports, updateExport, deleteExport, getNewExportCode };