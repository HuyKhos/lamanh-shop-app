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
export const createExport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, details, note, payment_due_date, idempotency_key } = req.body;

    // 1. Lấy thông tin khách hàng kèm cấu hình chiết khấu
    const customer = await Partner.findById(customer_id).session(session);
    if (!customer) throw new Error('Khách hàng không tồn tại');

    let totalPointsChange = 0;
    let finalTotalAmount = 0; 
    const enrichedDetails = [];

    for (const item of details) {
      // 2. Lấy thông tin SP từ DB để đảm bảo nhãn hàng và giá niêm yết chính xác
      const product = await Product.findById(item.product_id).session(session);
      if (!product) throw new Error(`Sản phẩm ${item.product_id} không tồn tại.`);

      // 3. LOGIC CHIẾT KHẤU THEO NHÃN HÀNG
      // Tìm xem khách này có mức CK riêng cho nhãn hàng của SP này không
      const brandConfig = customer.brand_discounts.find(d => d.brand === product.brand);
      const discountPercent = brandConfig ? brandConfig.discount_percent : 0;
      
      // Tính giá xuất kho sau khi đã trừ chiết khấu nhãn hàng
      const appliedPrice = product.export_price * (1 - discountPercent / 100);
      const lineTotal = appliedPrice * item.quantity;
      const lineProfit = lineTotal - (product.import_price * item.quantity);

      // 4. Trừ kho (Atomic update)
      const productUpdate = await Product.findOneAndUpdate(
        { _id: item.product_id, current_stock: { $gte: item.quantity } },
        { $inc: { current_stock: -item.quantity } },
        { session, new: true }
      );
      if (!productUpdate) throw new Error(`Sản phẩm ${product.name} không đủ hàng.`);

      totalPointsChange += (product.gift_points || 0) * item.quantity;
      finalTotalAmount += lineTotal;

      enrichedDetails.push({
        ...item,
        brand: product.brand,
        export_price: appliedPrice,
        discount: discountPercent, // Lưu lại % chiết khấu để hiển thị trên hóa đơn
        import_price: product.import_price,
        total: lineTotal,
        profit: lineProfit
      });
    }

    // Cập nhật tích điểm cho khách
    customer.saved_points += totalPointsChange;
    await customer.save({ session });

    // 5. Lưu phiếu xuất
    const code = await generateExportCode();
    const exportReceipt = new ExportReceipt({
      code, customer_id, 
      total_amount: finalTotalAmount, 
      details: enrichedDetails,
      partner_points_snapshot: customer.saved_points,
      idempotency_key, note, payment_due_date
    });
    
    await exportReceipt.save({ session });

    await session.commitTransaction();
    res.status(201).json({ receipt: exportReceipt, message: 'Tạo đơn thành công với chiết khấu nhãn hàng!' });

  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
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