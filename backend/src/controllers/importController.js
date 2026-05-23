import mongoose from 'mongoose';
import ImportReceipt from '../models/importModel.js';
import Product from '../models/productModel.js';
import Partner from '../models/partnerModel.js';
import Counter from '../models/counterModel.js';
import InventoryHistory from '../models/inventoryHistoryModel.js'; // Đã thêm Thẻ Kho

// --- 1. HÀM SINH MÃ TỰ ĐỘNG ---
export const generateImportCode = async (session = null) => {
  const now = new Date();
  const dateInVietnam = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const dateStr = `${dateInVietnam.getFullYear().toString().slice(-2)}${String(dateInVietnam.getMonth() + 1).padStart(2, '0')}${String(dateInVietnam.getDate()).padStart(2, '0')}`; 
  
  const counterId = `import_${dateStr}`;
  
  const options = { new: true, upsert: true, setDefaultsOnInsert: true };
  if (session) options.session = session;

  const counter = await Counter.findByIdAndUpdate(counterId, { $inc: { seq: 1 } }, options);
  return `NK-${dateStr}-${String(counter.seq).padStart(3, '0')}`;
};

// --- 2. TẠO PHIẾU NHẬP ---
const createImport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { supplier_id, details, total_amount, total_quantity, note, idempotency_key } = req.body;

    if (!idempotency_key) throw new Error("Thiếu khóa bảo mật (idempotency_key).");
    if (!details || details.length === 0) throw new Error('Giỏ hàng rỗng');

    const code = await generateImportCode(session);

    for (const item of details) {
      // 1. Cập nhật tồn kho
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product_id,
        { $inc: { current_stock: item.quantity } },
        { session, new: true } // new: true để lấy ra số tồn mới nhất
      );
      if (!updatedProduct) throw new Error(`Sản phẩm ID ${item.product_id} lỗi.`);

      // 2. GHI LỊCH SỬ THẺ KHO (Tự động tính tồn cũ từ tồn mới để đảm bảo tính Atomic)
      await InventoryHistory.create([{
        product_id: item.product_id,
        type: 'IMPORT',
        reference_code: code,
        change_quantity: item.quantity, // Nhập kho là số Dương
        previous_stock: updatedProduct.current_stock - item.quantity, // Tồn cũ = Tồn mới - Lượng vừa nhập
        new_stock: updatedProduct.current_stock,
        note: `Nhập kho (Phiếu: ${code})`
      }], { session });
    }

    const importReceipt = new ImportReceipt({
      code, supplier_id, total_amount, total_quantity, note, details, idempotency_key
    });

    await importReceipt.save({ session }); 

    await session.commitTransaction();
    res.status(201).json({ receipt: importReceipt, message: 'Nhập kho thành công!' });

  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000 && error.keyPattern && error.keyPattern.idempotency_key) {
      return res.status(409).json({ message: 'Phiếu nhập này đã được tạo thành công rồi (Trùng lặp thao tác).' });
    }
    console.error("Lỗi Import:", error);
    res.status(400).json({ message: 'Lỗi nhập kho: ' + error.message });
  } finally {
    session.endSession();
  }
};

// --- 3. XÓA PHIẾU NHẬP ---
const deleteImport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. DÙNG KỸ THUẬT XÓA NGUYÊN TỬ (Chống lỗi click đúp gây trừ tồn kho nhiều lần)
    const receipt = await ImportReceipt.findByIdAndDelete(req.params.id).session(session);
    if (!receipt) throw new Error('Không tìm thấy phiếu hoặc phiếu đã bị xóa');

    for (const item of receipt.details) {
      if (item.product_id) {
        // Cập nhật lại tồn kho (Xóa phiếu nhập -> Trừ đi số lượng đã nhập)
        const productAfter = await Product.findByIdAndUpdate(
          item.product_id,
          { $inc: { current_stock: -item.quantity } },
          { session, new: true }
        );

        if (productAfter) {
          // GHI LỊCH SỬ THẺ KHO KHI RÚT LẠI HÀNG
          await InventoryHistory.create([{
            product_id: item.product_id,
            type: 'DELETE_IMPORT',
            reference_code: receipt.code,
            change_quantity: -item.quantity, // Rút lại hàng là số Âm
            previous_stock: productAfter.current_stock + item.quantity,
            new_stock: productAfter.current_stock,
            note: `Hủy nhập kho do xóa phiếu ${receipt.code}`
          }], { session });
        }
      }
    }

    await session.commitTransaction();
    res.json({ message: 'Đã xóa phiếu nhập và hoàn tác dữ liệu thành công.' });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Lỗi xóa phiếu: ' + error.message });
  } finally {
    session.endSession();
  }
};

// --- 4. LẤY DANH SÁCH (CÓ PHÂN TRANG SERVER-SIDE) ---
const getImports = async (req, res) => {
  try {
    const isPaginated = req.query.page !== undefined;

    if (!isPaginated) {
      const imports = await ImportReceipt.find({}).populate('supplier_id', 'name phone').sort({ createdAt: -1 });
      return res.json(imports);
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
      // 1. Nếu tìm kiếm, trước tiên lấy ID của các nhà cung cấp có tên khớp
      const matchingSuppliers = await Partner.find({
          name: { $regex: search, $options: 'i' },
          type: 'supplier'
      }).select('_id');
      const supplierIds = matchingSuppliers.map(s => s._id);

      // 2. Tìm phiếu nhập thỏa mãn 1 trong các điều kiện
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { note: { $regex: search, $options: 'i' } },
        { supplier_id: { $in: supplierIds } }, // Tìm theo list ID nhà cung cấp
        { "details.product_name_backup": { $regex: search, $options: 'i' } },
        { "details.sku": { $regex: search, $options: 'i' } }
      ];
    }

    let sortObj = {};
    if (sortKey) {
        if (sortKey === 'supplier') {
             sortObj['createdAt'] = sortDir; // Sắp xếp theo supplier phức tạp hơn vì là khóa ngoại, ta fallback về createdAt
        } else {
             sortObj[sortKey] = sortDir;
        }
    }

    const totalItems = await ImportReceipt.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

    const imports = await ImportReceipt.find(query)
      .populate('supplier_id', 'name phone')
      .sort(sortObj)
      .skip(limit > 0 ? (page - 1) * limit : 0)
      .limit(limit > 0 ? limit : 0);

    res.json({
      data: imports,
      pagination: {
        currentPage: page,
        totalPages: totalPages || 1,
        totalItems: totalItems,
        itemsPerPage: limit
      }
    });

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