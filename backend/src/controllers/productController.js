import Product from '../models/productModel.js';
import ImportReceipt from '../models/importModel.js';
import ExportReceipt from '../models/exportModel.js';

// @desc    Tạo sản phẩm mới
// @route   POST /api/products
const createProduct = async (req, res) => {
  try {
    const { 
      sku, name, unit, 
      import_price, export_price, 
      discount_percent, gift_points, 
      min_stock 
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tên sản phẩm là bắt buộc' });
    }

    const product = new Product({
      sku, name, unit,
      import_price, export_price,
      discount_percent, gift_points, min_stock
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
    
  } catch (error) {
    // 11000 là mã lỗi trùng lặp dữ liệu của MongoDB
    if (error.code === 11000) {
      // Kiểm tra xem trùng cái gì (ở đây là sku)
      if (error.keyPattern.sku) {
        return res.status(400).json({ message: `Mã sản phẩm "${req.body.sku}" đã tồn tại! Vui lòng chọn mã khác.` });
      }
    }
    res.status(500).json({ message: 'Lỗi Server: ' + error.message });
  }
};

// @desc    Cập nhật sản phẩm
// @route   PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const { 
      sku, name, unit, 
      import_price, export_price, 
      discount_percent, gift_points, 
      min_stock
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      product.sku = sku || product.sku;
      product.name = name || product.name;
      product.unit = unit || product.unit;
      product.import_price = import_price !== undefined ? import_price : product.import_price;
      product.export_price = export_price !== undefined ? export_price : product.export_price;
      product.discount_percent = discount_percent !== undefined ? discount_percent : product.discount_percent;
      product.gift_points = gift_points !== undefined ? gift_points : product.gift_points;
      product.min_stock = min_stock !== undefined ? min_stock : product.min_stock;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
  } catch (error) {
    // BẮT LỖI TRÙNG MÃ KHI SỬA
    if (error.code === 11000 && error.keyPattern.sku) {
      return res.status(400).json({ message: `Mã sản phẩm "${req.body.sku}" đã tồn tại ở một sản phẩm khác!` });
    }
    res.status(500).json({ message: 'Lỗi: ' + error.message });
  }
};

// @desc    Lấy danh sách sản phẩm
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi Server: ' + error.message });
  }
};

// @route   DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    // --- BƯỚC KIỂM TRA AN TOÀN (MỚI THÊM) ---
    
    // 1. Kiểm tra xem sản phẩm có nằm trong phiếu nhập nào không
    const inImport = await ImportReceipt.findOne({ "details.product_id": req.params.id });
    if (inImport) {
      return res.status(400).json({ 
        message: `Không thể xóa! Sản phẩm này đang nằm trong phiếu nhập ${inImport.code}.` 
      });
    }

    // 2. Kiểm tra xem sản phẩm có nằm trong phiếu xuất nào không
    const inExport = await ExportReceipt.findOne({ "details.product_id": req.params.id });
    if (inExport) {
      return res.status(400).json({ 
        message: `Không thể xóa! Sản phẩm này đang nằm trong phiếu xuất ${inExport.code}.` 
      });
    }

    // 3. Nếu sạch sẽ (chưa dùng bao giờ) thì mới cho xóa
    await product.deleteOne();
    res.json({ message: 'Đã xóa sản phẩm thành công' });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa: ' + error.message });
  }
};

export { createProduct, getProducts, updateProduct, deleteProduct };