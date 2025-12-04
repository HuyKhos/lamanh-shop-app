import ExportReceipt from '../models/exportModel.js';
import Product from '../models/productModel.js';
import Partner from '../models/partnerModel.js';
import Config from '../models/configModel.js'; // <--- Import model mới

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
    // PHẦN 2: TÍNH TOÁN LỢI NHUẬN (PROFIT) - (MỚI THÊM)
    // ======================================================

    // Helper: Pipeline tính lợi nhuận (Dùng chung)
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

    // 2.1 Lợi nhuận Tháng này
    const profitThisMonthData = await ExportReceipt.aggregate(profitPipeline({ date: { $gte: startOfMonth } }));
    const profitThisMonth = profitThisMonthData[0]?.total || 0;

    // 2.2 Lợi nhuận Tháng trước (MỚI)
    const profitLastMonthData = await ExportReceipt.aggregate(profitPipeline({ date: { $gte: startOfLastMonth, $lte: endOfLastMonth } }));
    const profitLastMonth = profitLastMonthData[0]?.total || 0;

    // 2.3 % Tăng trưởng Lợi nhuận (MỚI)
    let profitGrowth = 0;
    if (profitLastMonth > 0) {
        profitGrowth = ((profitThisMonth - profitLastMonth) / profitLastMonth) * 100;
    } else if (profitThisMonth > 0) {
        profitGrowth = 100;
    }

    // ======================================================
    // PHẦN 3: CÁC CHỈ SỐ KHÁC
    // ======================================================
    const [ordersToday, inventoryData] = await Promise.all([
      // Số đơn hôm nay
      ExportReceipt.countDocuments({ date: { $gte: startOfToday } }),
      // Giá trị tồn kho
      Product.aggregate([
        { $project: { value: { $multiply: ["$current_stock", "$import_price"] } } },
        { $group: { _id: null, total: { $sum: "$value" } } }
      ])
    ]);

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

    // Nhắc nợ
    const debtReminder = await ExportReceipt.find({
        $expr: { $gt: ["$total_amount", "$paid_amount"] }
    })
    .select('code customer_id total_amount paid_amount payment_due_date')
    .populate('customer_id', 'name phone')
    .sort({ payment_due_date: 1 }) 
    .limit(5);

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
        profitGrowth: profitGrowth.toFixed(1), // <--- Đã thêm trường này
        
        orders: ordersToday,
        stockValue: inventoryData[0]?.total || 0
      },
      trend: revenueTrend,
      debt: debtReminder.map(d => ({
        customer: d.customer_id?.name || 'Khách lẻ',
        remaining: d.total_amount - (d.paid_amount || 0),
        dueDate: d.payment_due_date
      })),
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