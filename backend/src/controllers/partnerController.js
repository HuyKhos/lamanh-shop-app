import Partner from '../models/partnerModel.js';

// @desc    Tạo đối tác mới
// @route   POST /api/partners
const createPartner = async (req, res) => {
  try {
    const { name, type, phone, address, is_wholesale, hide_price } = req.body;

    // Chỉ còn bắt buộc Tên
    if (!name) {
      return res.status(400).json({ message: 'Tên đối tác là bắt buộc!' });
    }

    // Chỉ check trùng nếu có nhập số điện thoại
    if (phone) {
      const partnerExists = await Partner.findOne({ phone });
      if (partnerExists) {
        return res.status(400).json({ message: 'Số điện thoại này đã tồn tại!' });
      }
    }

    const partner = new Partner({
      name,
      type,
      phone: phone || undefined, // Nếu rỗng thì lưu là undefined để tránh lỗi unique index với chuỗi rỗng ""
      address,
      is_wholesale: is_wholesale || false,
      hide_price: hide_price || false
    });

    const savedPartner = await partner.save();
    res.status(201).json(savedPartner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Lấy danh sách đối tác (Đã nâng cấp: Phân trang Server-side & Tìm kiếm)
// @route   GET /api/partners
const getPartners = async (req, res) => {
  try {
    // 1. Nhận tham số từ Frontend (Mặc định trang 1, mỗi trang 10 dòng)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { type, keyword } = req.query;

    let query = {};

    // 2. Lọc theo loại (Khách hàng / NCC)
    if (type && type !== 'all') {
      query.type = type;
    }

    // 3. Tìm kiếm thông minh (Regex)
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword, $options: 'i' } }
      ];
    }

    // 4. Tính toán vị trí bắt đầu cắt dữ liệu (Skip)
    const skip = (page - 1) * limit;

    // 5. Chạy song song 2 việc: Lấy dữ liệu 1 trang & Đếm tổng số lượng
    // Dùng Promise.all giúp truy vấn nhanh hơn gấp đôi so với chạy tuần tự
    const [partners, totalItems] = await Promise.all([
      Partner.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Partner.countDocuments(query)
    ]);

    // 6. Trả về format mới: Gồm mảng Data và thông tin Phân trang (Pagination)
    res.json({
      data: partners,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems: totalItems,
        limit: limit
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cập nhật đối tác
// @route   PUT /api/partners/:id
const updatePartner = async (req, res) => {
  try {
    const { name, type, phone, address, is_wholesale, hide_price, saved_points } = req.body;
    const partner = await Partner.findById(req.params.id);

    if (partner) {
      partner.name = name || partner.name;
      partner.type = type || partner.type;
      partner.address = address || partner.address;
      
      if (is_wholesale !== undefined) partner.is_wholesale = is_wholesale;
      if (hide_price !== undefined) partner.hide_price = hide_price;
      
      // CẬP NHẬT ĐIỂM GỬI
      if (saved_points !== undefined) partner.saved_points = saved_points;

      // Logic cập nhật số điện thoại
      if (phone !== undefined) { // Nếu có gửi trường phone lên (kể cả chuỗi rỗng)
        if (phone && phone !== partner.phone) {
           // Nếu có số và khác số cũ -> Check trùng
           const phoneExists = await Partner.findOne({ phone });
           if (phoneExists) {
             return res.status(400).json({ message: 'Số điện thoại mới bị trùng!' });
           }
           partner.phone = phone;
        } else if (!phone) {
           // Nếu gửi lên chuỗi rỗng -> Xóa số điện thoại
           partner.phone = undefined;
        }
      }

      const updatedPartner = await partner.save();
      res.json(updatedPartner);
    } else {
      res.status(404).json({ message: 'Không tìm thấy đối tác' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Xóa đối tác
// @route   DELETE /api/partners/:id
const deletePartner = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);

    if (partner) {
      // Logic mở rộng: Kiểm tra xem đối tác này có đang nợ tiền hoặc có đơn hàng không trước khi xóa
      // Nhưng tạm thời cứ cho xóa thoải mái để test
      await partner.deleteOne();
      res.json({ message: 'Đã xóa đối tác thành công' });
    } else {
      res.status(404).json({ message: 'Không tìm thấy đối tác' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



export { createPartner, getPartners, updatePartner, deletePartner };