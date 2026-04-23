import Partner from '../models/partnerModel.js';

// @desc    Tạo đối tác mới
// @route   POST /api/partners
const createPartner = async (req, res) => {
  try {
    // --- ĐÃ THÊM brand_discounts VÀO ĐÂY ---
    const { name, type, phone, address, is_wholesale, hide_price, brand_discounts } = req.body; 

    if (!name) {
      return res.status(400).json({ message: 'Tên đối tác là bắt buộc!' });
    }

    if (phone) {
      const partnerExists = await Partner.findOne({ phone });
      if (partnerExists) {
        return res.status(400).json({ message: 'Số điện thoại này đã tồn tại!' });
      }
    }

    const partner = new Partner({
      name,
      type,
      phone: phone || undefined,
      address,
      is_wholesale: is_wholesale || false,
      hide_price: hide_price || false,
      brand_discounts: brand_discounts || [] // <-- ĐÃ THÊM DÒNG NÀY ĐỂ LƯU VÀO DB
    });

    const savedPartner = await partner.save();
    res.status(201).json(savedPartner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Lấy danh sách đối tác
// @route   GET /api/partners
const getPartners = async (req, res) => {
  try {
    const { type, keyword } = req.query;
    let query = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } }, 
        { phone: { $regex: keyword, $options: 'i' } }
      ];
    }

    const partners = await Partner.find(query).sort({ createdAt: -1 });
    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cập nhật đối tác
// @route   PUT /api/partners/:id
const updatePartner = async (req, res) => {
  try {
    // --- ĐÃ THÊM brand_discounts VÀO ĐÂY ---
    const { name, type, phone, address, is_wholesale, hide_price, saved_points, brand_discounts } = req.body;
    const partner = await Partner.findById(req.params.id);

    if (partner) {
      partner.name = name || partner.name;
      partner.type = type || partner.type;
      partner.address = address || partner.address;
      
      if (is_wholesale !== undefined) partner.is_wholesale = is_wholesale;
      if (hide_price !== undefined) partner.hide_price = hide_price;
      
      // --- ĐÃ THÊM DÒNG NÀY ĐỂ CẬP NHẬT VÀO DB ---
      if (brand_discounts !== undefined) partner.brand_discounts = brand_discounts; 
      
      if (saved_points !== undefined) partner.saved_points = saved_points;

      if (phone !== undefined) { 
        if (phone && phone !== partner.phone) {
           const phoneExists = await Partner.findOne({ phone });
           if (phoneExists) {
             return res.status(400).json({ message: 'Số điện thoại mới bị trùng!' });
           }
           partner.phone = phone;
        } else if (!phone) {
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