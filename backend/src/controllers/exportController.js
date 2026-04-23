import mongoose from 'mongoose';
import ExportReceipt from '../models/exportModel.js';
import Product from '../models/productModel.js';
import Partner from '../models/partnerModel.js';
import Counter from '../models/counterModel.js';

// --- HÀM SINH MÃ ---
export const generateExportCode = async (session = null) => {
  const now = new Date();
  const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`;
  const counterId = `export_${dateStr}`;
  
  const options = { new: true, upsert: true, setDefaultsOnInsert: true };
  if (session) options.session = session;

  const counter = await Counter.findByIdAndUpdate(counterId, { $inc: { seq: 1 } }, options);
  return `XK-${dateStr}-${String(counter.seq).padStart(3, '0')}`;
};

// --- TẠO PHIẾU XUẤT ---
const createExport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, details, note, payment_due_date, idempotency_key } = req.body;

    if (!idempotency_key) throw new Error("Thiếu khóa bảo mật (idempotency_key)");
    if (!details || details.length === 0) throw new Error('Giỏ hàng rỗng');

    const customer = await Partner.findById(customer_id).session(session);
    if (!customer) throw new Error('Khách hàng không tồn tại');

    let totalPointsChange = 0;
    let finalTotalAmount = 0;
    const enrichedDetails = [];

    for (const item of details) {
      const product = await Product.findById(item.product_id).session(session);
      if (!product) throw new Error(`Sản phẩm ID ${item.product_id} không tồn tại.`);

      // Logic Chiết khấu nhãn hàng
      const brandConfig = customer.brand_discounts?.find(d => d.brand === product.brand);
      const discountPercent = brandConfig ? brandConfig.discount_percent : (customer.is_wholesale ? (product.discount_percent || 0) : 0);
      
      const basePrice = item.export_price || product.export_price;
      const appliedPrice = basePrice * (1 - discountPercent / 100);
      const lineTotal = Math.round(appliedPrice * item.quantity);

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
        export_price: basePrice, 
        discount: discountPercent,
        total: lineTotal,
        import_price: product.import_price || 0,
        profit: lineTotal - ((product.import_price || 0) * item.quantity)
      });
    }

    // Cộng thẳng điểm cho khách (không ghi History nữa)
    let updatedCustomer = customer;
    if (totalPointsChange !== 0) {
      updatedCustomer = await Partner.findByIdAndUpdate(
        customer_id,
        { $inc: { saved_points: totalPointsChange } }, 
        { session, new: true }
      );
    }

    const code = await generateExportCode(session);
    const exportReceipt = new ExportReceipt({
      code, customer_id, total_amount: finalTotalAmount, note, 
      details: enrichedDetails, payment_due_date,
      partner_points_snapshot: updatedCustomer.saved_points,
      idempotency_key
    });
    const savedReceipt = await exportReceipt.save({ session });

    await session.commitTransaction();
    res.status(201).json({ receipt: savedReceipt, message: 'Xuất kho thành công!' });

  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) return res.status(409).json({ message: 'Đơn hàng đã được xử lý trước đó.' });
    res.status(400).json({ message: 'Lỗi: ' + error.message });
  } finally {
    session.endSession();
  }
};

// --- CẬP NHẬT PHIẾU XUẤT ---
const updateExport = async (req, res) => {
    try {
        const { note, hide_price } = req.body;
        const updatedExport = await ExportReceipt.findByIdAndUpdate(
            req.params.id, { note, hide_price }, { new: true }
        );
        res.json(updatedExport);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- XÓA PHIẾU XUẤT ---
const deleteExport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receipt = await ExportReceipt.findById(req.params.id).session(session);
    if (!receipt) throw new Error('Không tìm thấy phiếu');

    // 1. Hoàn lại số lượng tồn kho cho sản phẩm
    for (const item of receipt.details) {
      await Product.findByIdAndUpdate(
        item.product_id, { $inc: { current_stock: item.quantity } }, { session }
      );
    }

    // 2. Tính toán tổng điểm cần hoàn tác (Bao gồm cả điểm âm và dương)
    let pointsToRevert = 0;
    receipt.details.forEach(item => {
      pointsToRevert += (item.gift_points || 0) * item.quantity;
    });

    // 3. Hoàn điểm (SỬA LỖI TẠI ĐÂY: Dùng !== 0 thay vì > 0)
    if (pointsToRevert !== 0) {
      await Partner.findByIdAndUpdate(
        receipt.customer_id, 
        { $inc: { saved_points: -pointsToRevert } }, 
        { session }
      );
    }

    // 4. Xóa phiếu xuất khỏi cơ sở dữ liệu
    await ExportReceipt.deleteOne({ _id: receipt._id }).session(session);
    
    await session.commitTransaction();
    res.json({ message: 'Đã xóa phiếu xuất và hoàn tác dữ liệu thành công.' });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Lỗi xóa phiếu: ' + error.message });
  } finally {
    session.endSession();
  }
};

const getNewExportCode = async (req, res) => {
  try {
    const now = new Date();
    const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`;
    const counterId = `export_${dateStr}`;
    const counter = await Counter.findOneAndUpdate({ _id: counterId }, { $setOnInsert: { seq: 0 } }, { new: true, upsert: true });
    res.json({ code: `XK-${dateStr}-${String(counter.seq + 1).padStart(3, '0')}` });
  } catch (error) { res.status(500).json({ message: "Lỗi sinh mã" }); }
};

// --- HÀM LẤY DANH SÁCH (CÓ PHÂN TRANG SERVER-SIDE) ---
const getExports = async (req, res) => {
  try {
    const isPaginated = req.query.page !== undefined;

    if (!isPaginated) {
      const exportsList = await ExportReceipt.find({}).populate('customer_id', 'name phone address saved_points').sort({ createdAt: -1 });
      return res.json(exportsList);
    }

    const page = parseInt(req.query.page) || 1;
    let limit = 10;
    if (req.query.limit === 'all') {
        limit = 0; 
    } else if (req.query.limit) {
        limit = parseInt(req.query.limit) || 10;
    }

    const search = req.query.search || '';
    const sortKey = req.query.sortKey || 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

    let query = {};

    if (search) {
      const matchingCustomers = await Partner.find({
          name: { $regex: search, $options: 'i' },
          type: 'customer'
      }).select('_id');
      const customerIds = matchingCustomers.map(c => c._id);

      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { note: { $regex: search, $options: 'i' } },
        { customer_id: { $in: customerIds } },
        { "details.product_name_backup": { $regex: search, $options: 'i' } },
        { "details.sku": { $regex: search, $options: 'i' } }
      ];
    }

    let sortObj = {};
    if (sortKey) {
        if (sortKey === 'customer_id' || sortKey === 'customer') {
             sortObj['createdAt'] = sortDir;
        } else {
             sortObj[sortKey] = sortDir;
        }
    }

    const totalItems = await ExportReceipt.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

    const exportsList = await ExportReceipt.find(query)
      .populate('customer_id', 'name phone address saved_points is_wholesale brand_discounts hide_price')
      .sort(sortObj)
      .skip(limit > 0 ? (page - 1) * limit : 0)
      .limit(limit > 0 ? limit : 0);

    res.json({
      data: exportsList,
      pagination: {
        currentPage: page,
        totalPages: totalPages || 1,
        totalItems: totalItems,
        itemsPerPage: limit
      }
    });

  } catch (error) { res.status(500).json({ message: error.message }); }
};

export { createExport, getExports, updateExport, deleteExport, getNewExportCode };