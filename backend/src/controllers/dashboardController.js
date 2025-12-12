import ExportReceipt from '../models/exportModel.js';
import Product from '../models/productModel.js';
import Partner from '../models/partnerModel.js';
import Config from '../models/configModel.js';
import ImportReceipt from '../models/importModel.js';
import DebtRecord from '../models/debtModel.js';

const getDashboardData = async (req, res) => {
  try {
    const now = new Date();
    
    // --- 1. KHAI BÁO CÁC MỐC THỜI GIAN ---
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); // Đầu tháng này
    
    // Mốc thời gian tháng trước
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // ======================================================
    // PHẦN 1: TÍNH TOÁN DOANH THU (REVENUE)
    // ======================================================
    
    // 1.1 Doanh thu Tháng này
    const revenueThisMonthData = await ExportReceipt.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$total_amount" } } }
    ]);
    const revenueThisMonth = revenueThisMonthData[0]?.total || 0;

    // 1.2 Doanh thu Tháng trước
    const revenueLastMonthData = await ExportReceipt.aggregate([
      { $match: { date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      { $group: { _id: null, total: { $sum: "$total_amount" } } }
    ]);
    const revenueLastMonth = revenueLastMonthData[0]?.total || 0;

    // 1.3 % Tăng trưởng Doanh thu
    let revenueGrowth = 0;
    if (revenueLastMonth > 0) {
        revenueGrowth = ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;
    } else if (revenueThisMonth > 0) {
        revenueGrowth = 100; 
    }

    // ======================================================
    // PHẦN 2: TÍNH TOÁN LỢI NHUẬN (PROFIT)
    // ======================================================

    const profitPipeline = (matchStage) => [
      { $match: matchStage },
      { $unwind: "$details" },
      {
        $lookup: {
          from: "products",
          localField: "details.product_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $project: {
          profit: { 
            $multiply: [
              { $subtract: ["$details.export_price", "$product.import_price"] },
              "$details.quantity"
            ] 
          }
        }
      },
      { $group: { _id: null, total: { $sum: "$profit" } } }
    ];

    const profitThisMonthData = await ExportReceipt.aggregate(profitPipeline({ date: { $gte: startOfMonth } }));
    const profitThisMonth = profitThisMonthData[0]?.total || 0;

    const profitLastMonthData = await ExportReceipt.aggregate(profitPipeline({ date: { $gte: startOfLastMonth, $lte: endOfLastMonth } }));
    const profitLastMonth = profitLastMonthData[0]?.total || 0;

    let profitGrowth = 0;
    if (profitLastMonth > 0) {
        profitGrowth = ((profitThisMonth - profitLastMonth) / profitLastMonth) * 100;
    } else if (profitThisMonth > 0) {
        profitGrowth = 100;
    }

    // ======================================================
    // PHẦN 3: CÁC CHỈ SỐ KHÁC VÀ TĂNG TRƯỞNG
    // ======================================================
    const [ 
        ordersThisMonth, 
        ordersLastMonth, 
        inventoryData, 
        importsThisMonthData 
    ] = await Promise.all([
      // Số đơn tháng này
      ExportReceipt.countDocuments({ date: { $gte: startOfMonth } }),
      // Số đơn tháng trước
      ExportReceipt.countDocuments({ date: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      // Giá trị tồn kho hiện tại
      Product.aggregate([
        { $project: { value: { $multiply: ["$current_stock", "$import_price"] } } },
        { $group: { _id: null, total: { $sum: "$value" } } }
      ]),
      // Tổng giá trị nhập kho tháng này
      ImportReceipt.aggregate([
          { $match: { date: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: "$total_amount" } } }
      ])
    ]);
    
    const stockValueThisMonth = inventoryData[0]?.total || 0;

    // --- Tính toán tăng trưởng Đơn hàng ---
    let ordersGrowth = 0;
    if (ordersLastMonth > 0) {
        ordersGrowth = ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100;
    } else if (ordersThisMonth > 0) {
        ordersGrowth = 100;
    }

    // --- Tính toán tăng trưởng Giá trị kho ---
    const cogsThisMonth = revenueThisMonth - profitThisMonth;
    const importsThisMonthValue = importsThisMonthData[0]?.total || 0;
    const stockValueLastMonth = stockValueThisMonth - importsThisMonthValue + cogsThisMonth;

    let stockValueGrowth = 0;
    if (stockValueLastMonth > 0) {
        stockValueGrowth = ((stockValueThisMonth - stockValueLastMonth) / stockValueLastMonth) * 100;
    } else if (stockValueThisMonth > 0) {
        stockValueGrowth = 100;
    }

    // ======================================================
    // PHẦN 4: DỮ LIỆU BIỂU ĐỒ & DANH SÁCH
    // ======================================================

    // Xu hướng doanh thu 10 ngày
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const revenueTrend = await ExportReceipt.aggregate([
      { $match: { date: { $gte: tenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%d/%m", date: "$date" } },
          revenue: { $sum: "$total_amount" }
        }
      },
      { $sort: { _id: 1 } } 
    ]);

    // --- 5. Lấy danh sách Công nợ (ĐÃ TỐI ƯU) ---
    // Chỉ lấy nợ dương (> 0), sắp xếp hạn thanh toán tăng dần (ai hết hạn trước hiện trước)
    // Giới hạn 20 dòng để Dashboard nhẹ
    const debtList = await DebtRecord.find({
      // Chỉ lấy những bản ghi có amount tồn tại
      amount: { $exists: true } 
   })
   .populate('partner_id', 'name phone')
   .sort({ dueDate: 1 }); // Sắp xếp hạn

   // Bước 2: Map và Lọc bằng Javascript (Chính xác tuyệt đối)
   const formattedDebts = debtList
     .map(d => {
       // Tính toán số còn lại: Nếu không có paid_amount thì coi như bằng 0
       const paid = d.paid_amount || 0;
       const remainingCalc = d.amount - paid;
       
       return {
         _id: d._id,
         customer: d.partner_id ? d.partner_id.name : 'Khách lẻ',
         phone: d.partner_id ? d.partner_id.phone : '',
         remaining: remainingCalc, 
         dueDate: d.dueDate
       };
     })
     // [QUAN TRỌNG] Lọc bỏ những dòng <= 0 hoặc sai số nhỏ (< 1000đ)
     .filter(item => item.remaining > 0)
     // Lấy 20 dòng đầu tiên sau khi đã lọc sạch
     .slice(0, 20);

    // Top sản phẩm
    const topProducts = await ExportReceipt.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $unwind: "$details" },
      { $group: { _id: "$details.product_name_backup", value: { $sum: "$details.quantity" } } },
      { $sort: { value: -1 } },
      { $limit: 5 }
    ]);

    // Top khách hàng
    const topCustomers = await ExportReceipt.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: "$customer_id", value: { $sum: "$total_amount" } } },
      { $sort: { value: -1 } },
      { $limit: 5 },
      { $lookup: { from: "partners", localField: "_id", foreignField: "_id", as: "customer" } },
      { $unwind: "$customer" },
      { $project: { name: "$customer.name", value: 1 } }
    ]);

    // TRẢ VỀ JSON
    res.json({
      summary: {
        revenue: revenueThisMonth,
        revenueGrowth: revenueGrowth.toFixed(1),
        
        profit: profitThisMonth,
        profitGrowth: profitGrowth.toFixed(1),
        
        orders: ordersThisMonth,
        ordersLastMonth: ordersLastMonth,
        ordersGrowth: ordersGrowth.toFixed(1),

        stockValue: stockValueThisMonth,
        stockValueGrowth: stockValueGrowth.toFixed(1)
      },
      trend: revenueTrend,
      debt: formattedDebts,
      topProducts: topProducts.map(p => ({ name: p._id, value: p.value })),
      topCustomers
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// --- API MỚI: LẤY GHI CHÚ ---
const getDashboardNote = async (req, res) => {
  try {
    let noteConfig = await Config.findOne({ key: 'dashboard_note' });
    if (!noteConfig) {
      // Nếu chưa có thì tạo mới rỗng
      noteConfig = await Config.create({ key: 'dashboard_note', value: '' });
    }
    res.json({ note: noteConfig.value });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- API MỚI: LƯU GHI CHÚ ---
const saveDashboardNote = async (req, res) => {
  try {
    const { note } = req.body;
    const updatedConfig = await Config.findOneAndUpdate(
      { key: 'dashboard_note' },
      { value: note },
      { new: true, upsert: true } // upsert: nếu chưa có thì tạo mới
    );
    res.json({ success: true, note: updatedConfig.value });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { getDashboardData, getDashboardNote, saveDashboardNote };
