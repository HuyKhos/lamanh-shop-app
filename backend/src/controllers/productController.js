import Product from '../models/productModel.js';
import ImportReceipt from '../models/importModel.js';
import ExportReceipt from '../models/exportModel.js';

// @desc    Tạo sản phẩm mới
const createProduct = async (req, res) => {
  try {
    const { 
      sku, name, brand, unit,
      import_price, export_price, 
      discount_percent, gift_points, min_stock 
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tên sản phẩm là bắt buộc' });
    }

    const product = new Product({
      sku, name, brand, unit,
      import_price, export_price,
      discount_percent, gift_points, min_stock
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
    
  } catch (error) {
    if (error.code === 11000 && error.keyPattern.sku) {
      return res.status(400).json({ message: `Mã sản phẩm "${req.body.sku}" đã tồn tại! Vui lòng chọn mã khác.` });
    }
    res.status(500).json({ message: 'Lỗi Server: ' + error.message });
  }
};

// @desc    Cập nhật sản phẩm
const updateProduct = async (req, res) => {
  try {
    const { 
      sku, name, brand, unit,
      import_price, export_price, 
      discount_percent, gift_points, min_stock
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      product.sku = sku || product.sku;
      product.name = name || product.name;
      product.brand = brand !== undefined ? brand : product.brand;
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
    if (error.code === 11000 && error.keyPattern.sku) {
      return res.status(400).json({ message: `Mã sản phẩm "${req.body.sku}" đã tồn tại ở một sản phẩm khác!` });
    }
    res.status(500).json({ message: 'Lỗi: ' + error.message });
  }
};

// @desc    Lấy danh sách sản phẩm (Phân trang Server)
const getProducts = async (req, res) => {
  try {
    const isPaginated = req.query.page !== undefined;

    // NẾU GỌI TỪ TRANG KHÁC (KHÔNG PHÂN TRANG)
    if (!isPaginated) {
      const products = await Product.find({}).sort({ createdAt: -1 });
      return res.json(products);
    }

    // NẾU GỌI TỪ TRANG SẢN PHẨM (CÓ PHÂN TRANG)
    const page = parseInt(req.query.page) || 1;
    
    // Fix lỗi xuất Excel (limit = all)
    let limit = 10;
    if (req.query.limit === 'all') {
        limit = 0; // 0 trong Mongoose có nghĩa là lấy tất cả
    } else if (req.query.limit) {
        limit = parseInt(req.query.limit) || 10;
    }

    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const sortKey = req.query.sortKey || 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

    let query = {};

    if (search) {
      const searchKeywords = search.toLowerCase().split(/\s+/).filter(word => word.length > 0);
      if (searchKeywords.length > 0) {
        query.$and = searchKeywords.map(keyword => ({
          $or: [
            { name: { $regex: keyword, $options: 'i' } },
            { sku: { $regex: keyword, $options: 'i' } },
            { brand: { $regex: keyword, $options: 'i' } }
          ]
        }));
      }
    }

    if (status === 'in_stock') query.current_stock = { $gt: 0 };
    if (status === 'out_of_stock') query.current_stock = { $lte: 0 };

    let sortObj = {};
    if (sortKey) sortObj[sortKey] = sortDir;

    const totalItems = await Product.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

    const products = await Product.find(query)
      .sort(sortObj)
      .skip(limit > 0 ? (page - 1) * limit : 0)
      .limit(limit > 0 ? limit : 0);

    res.json({
      data: products,
      pagination: {
        currentPage: page,
        totalPages: totalPages || 1,
        totalItems: totalItems,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi Server: ' + error.message });
  }
};

// @desc    Xóa sản phẩm
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    const inImport = await ImportReceipt.findOne({ "details.product_id": req.params.id });
    if (inImport) {
      return res.status(400).json({ 
        message: `Không thể xóa! Sản phẩm này đang nằm trong phiếu nhập ${inImport.code}.` 
      });
    }

    const inExport = await ExportReceipt.findOne({ "details.product_id": req.params.id });
    if (inExport) {
      return res.status(400).json({ 
        message: `Không thể xóa! Sản phẩm này đang nằm trong phiếu xuất ${inExport.code}.` 
      });
    }

    await product.deleteOne();
    res.json({ message: 'Đã xóa sản phẩm thành công' });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa: ' + error.message });
  }
};

export { createProduct, getProducts, updateProduct, deleteProduct };