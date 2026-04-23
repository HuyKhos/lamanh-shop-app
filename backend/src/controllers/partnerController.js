import Partner from '../models/partnerModel.js';

// --- TẠO ĐỐI TÁC ---
const createPartner = async (req, res) => {
  try {
    const { name, type, phone, address, is_wholesale, hide_price, brand_discounts } = req.body; 

    if (!name) return res.status(400).json({ message: 'Tên đối tác là bắt buộc!' });

    if (phone) {
      const partnerExists = await Partner.findOne({ phone });
      if (partnerExists) return res.status(400).json({ message: 'Số điện thoại này đã tồn tại!' });
    }

    const partner = new Partner({
      name, type, phone: phone || undefined, address,
      is_wholesale: is_wholesale || false,
      hide_price: hide_price || false,
      brand_discounts: brand_discounts || []
    });

    const savedPartner = await partner.save();
    res.status(201).json(savedPartner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- CẬP NHẬT ĐỐI TÁC ---
const updatePartner = async (req, res) => {
  try {
    const { name, type, phone, address, is_wholesale, hide_price, saved_points, brand_discounts } = req.body;
    const partner = await Partner.findById(req.params.id);

    if (partner) {
      partner.name = name || partner.name;
      partner.type = type || partner.type;
      partner.address = address || partner.address;
      
      if (is_wholesale !== undefined) partner.is_wholesale = is_wholesale;
      if (hide_price !== undefined) partner.hide_price = hide_price;
      if (brand_discounts !== undefined) partner.brand_discounts = brand_discounts; 
      if (saved_points !== undefined) partner.saved_points = saved_points;

      if (phone !== undefined) { 
        if (phone && phone !== partner.phone) {
           const phoneExists = await Partner.findOne({ phone });
           if (phoneExists) return res.status(400).json({ message: 'Số điện thoại mới bị trùng!' });
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

// --- XÓA ĐỐI TÁC ---
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

// --- LẤY DANH SÁCH (CÓ PHÂN TRANG SERVER-SIDE) ---
const getPartners = async (req, res) => {
  try {
    const isPaginated = req.query.page !== undefined;

    // Kịch bản gọi từ trang khác (không phân trang)
    if (!isPaginated) {
      const { type, keyword } = req.query;
      let query = {};
      if (type && type !== 'all') query.type = type;
      if (keyword) {
        query.$or = [
          { name: { $regex: keyword, $options: 'i' } }, 
          { phone: { $regex: keyword, $options: 'i' } }
        ];
      }
      const partners = await Partner.find(query).sort({ createdAt: -1 });
      return res.json(partners);
    }

    // Kịch bản gọi từ trang PartnerPage (có phân trang)
    const page = parseInt(req.query.page) || 1;
    let limit = 10;
    if (req.query.limit === 'all') {
        limit = 0; 
    } else if (req.query.limit) {
        limit = parseInt(req.query.limit) || 10;
    }

    const search = req.query.search || '';
    const type = req.query.type || 'all';
    const sortKey = req.query.sortKey || 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

    let query = {};

    if (type !== 'all') {
        query.type = type;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } }, 
        { phone: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    let sortObj = {};
    if (sortKey) sortObj[sortKey] = sortDir;

    const totalItems = await Partner.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

    const partners = await Partner.find(query)
      .sort(sortObj)
      .skip(limit > 0 ? (page - 1) * limit : 0)
      .limit(limit > 0 ? limit : 0);

    res.json({
      data: partners,
      pagination: {
        currentPage: page,
        totalPages: totalPages || 1,
        totalItems: totalItems,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { createPartner, getPartners, updatePartner, deletePartner };