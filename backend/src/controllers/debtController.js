import DebtRecord from '../models/debtModel.js';
import Partner from '../models/partnerModel.js';

// @desc    Lấy danh sách công nợ
// @route   GET /api/debts
const getDebts = async (req, res) => {
  try {
    const debts = await DebtRecord.find({})
      .populate('partner_id', 'name phone type')
      .sort({ createdAt: -1 });
    res.json(debts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cập nhật thanh toán (PUT) - Cộng dồn vào paid_amount
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params; // ID của dòng DebtRecord
    const { amount } = req.body; // Số tiền khách trả thêm lần này

    // 1. Tìm dòng nợ
    const debt = await DebtRecord.findById(id);
    if (!debt) return res.status(404).json({ message: 'Không tìm thấy phiếu nợ' });

    // 2. Tính toán lại số liệu
    const paymentAmount = Number(amount) || 0;
    
    // Cộng dồn vào số đã trả
    debt.paid_amount = (debt.paid_amount || 0) + paymentAmount;
    
    // Tính số còn nợ mới
    debt.remaining_amount = debt.amount - debt.paid_amount;

    // Cập nhật trạng thái
    if (debt.remaining_amount <= 0) {
        debt.remaining_amount = 0; // Không để âm
        debt.status = 'paid';      // Đã xong
    } else {
        debt.status = 'partially_paid'; // Trả một phần
    }

    await debt.save();

    // 3. Cập nhật Tổng nợ của Đối tác (Partner)
    const partner = await Partner.findById(debt.partner_id);
    if (partner) {
        // Khách trả tiền => Nợ tổng giảm đi
        partner.current_debt = (partner.current_debt || 0) - paymentAmount;
        await partner.save();
    }

    res.json({ message: 'Cập nhật thanh toán thành công', data: debt });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cập nhật thông tin dòng công nợ (Chỉ sửa Ghi chú)
// @route   PUT /api/debts/:id
const updateDebt = async (req, res) => {
  try {
    const { note } = req.body; 
    const debt = await DebtRecord.findById(req.params.id);

    if (debt) {
      debt.note = note !== undefined ? note : debt.note;
      const updatedDebt = await debt.save();
      res.json(updatedDebt);
    } else {
      res.status(404).json({ message: 'Không tìm thấy dữ liệu công nợ' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Đã xóa hàm createPayment

export { getDebts, updateDebt, updatePayment };