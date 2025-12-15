import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  Search, Menu, Wallet, 
  ArrowUpDown, ArrowUp, ArrowDown, DollarSign, X, Edit3, Image as ImageIcon,
  ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';

const DebtPage = () => {
  const { isExpanded, setIsExpanded, globalCache, refreshFlags, updateCache, triggerRefresh } = useOutletContext();

  const [items, setItems] = useState(globalCache?.debts || []); 
  const [loading, setLoading] = useState(!globalCache?.debts);
  
  // Modal Payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({ item: null, amount: '', note: '' });
  
  // Modal Note
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteData, setNoteData] = useState({ item: null, note: '' });

  // --- STATE ANIMATION ĐÓNG ---
  const [isClosing, setIsClosing] = useState(false); 

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all'); 
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  // --- HÀM ĐÓNG MODAL CÓ HIỆU ỨNG ---
  const handleClosePayment = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowPaymentModal(false);
      setIsClosing(false);
    }, 100);
  };

  const handleCloseNote = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowNoteModal(false);
      setIsClosing(false);
    }, 100);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [debtRes, exportRes] = await Promise.all([
        axiosClient.get('/debts'),
        axiosClient.get('/exports')
      ]);

      const dueDateMap = {};
      exportRes.forEach(exp => {
        if (exp.code) dueDateMap[exp.code] = exp.payment_due_date;
      });
      
      const formattedData = debtRes.map(i => {
        const amount = i.amount || 0;
        const paid = i.paid_amount || 0;
        const remaining = i.remaining_amount !== undefined ? i.remaining_amount : (amount - paid);
        const refCode = i.reference_code;

        return {
          _id: i._id,           
          code: refCode,
          date: i.createdAt,
          partner_name: i.partner_id?.name || 'Khách lẻ',
          partner_id: i.partner_id?._id,
          type: i.type,
          amount: amount,     
          paid: paid, 
          remaining: remaining,
          dueDate: dueDateMap[refCode] || i.dueDate || null, 
          note: i.note || '' 
        };
      });

      setItems(formattedData);
      updateCache('debts', formattedData);
    } catch (error) {
      console.error(error);
      toast.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!globalCache?.debts || refreshFlags?.debts) {
        fetchData();
    }
  }, [refreshFlags?.debts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPaymentStatus, sortConfig]);

  const getProcessedItems = () => {
    let result = [...items];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(i => 
        (i.code && i.code.toLowerCase().includes(lower)) ||
        (i.partner_name && i.partner_name.toLowerCase().includes(lower)) ||
        (i.note && i.note.toLowerCase().includes(lower))
      );
    }
    if (filterPaymentStatus !== 'all') {
        if (filterPaymentStatus === 'has_paid') result = result.filter(i => i.paid > 0);
        else if (filterPaymentStatus === 'no_pay') result = result.filter(i => i.remaining > 0);
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        if (['date', 'dueDate'].includes(sortConfig.key)) {
            const tA = new Date(aValue || 0).getTime();
            const tB = new Date(bValue || 0).getTime();
            return sortConfig.direction === 'asc' ? tA - tB : tB - tA;
        }
        if (typeof aValue === 'string') return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }
    return result;
  };

  const processedData = getProcessedItems();
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = processedData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const totalRemainingDebt = currentItems.reduce((sum, item) => sum + (item.remaining || 0), 0);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) setCurrentPage(pageNumber);
  };

  const generateReportHTML = (data) => {
    const dateStr = new Date().toLocaleDateString('vi-VN');
    const rows = data.map((item, index) => `
        <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td style="text-align: center;">${new Date(item.date).toLocaleDateString('vi-VN')}</td>
            <td style="text-align: center;">${item.code}</td>
            <td style="text-align: left; padding-left: 8px;">${item.partner_name}</td>
            <td style="text-align: right; padding-right: 4px; color: #166534;">${formatCurrency(item.paid)}</td>
            <td style="text-align: right; padding-right: 4px; font-weight: bold; color: #dc2626;">${formatCurrency(item.remaining)}</td>
            <td style="text-align: center;">${item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : '-'}</td>
            <td style="text-align: left; padding-left: 8px; font-style: italic;">${item.note}</td>
        </tr>
    `).join('');
    return `
      <div style="font-family: 'Times New Roman', serif; color: #000; line-height: 1.3; background: white;">
        <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 5px; font-size: 20px; font-weight: bold;">BÁO CÁO CÔNG NỢ</h2>
        <p style="text-align: center; margin-bottom: 20px; font-style: italic; font-size: 15px;">Ngày xuất: ${dateStr}</p>
        <table style="width: 100%; border-right: 1px solid #000; font-size: 15px; padding-bottom: 23px !important; padding-top: none;">
            <thead>
                <tr style="background: #f3f4f6; font-weight: bold;">
                    <th style="border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000; padding-top: 0px !important; padding-bottom: 10px !important; text-align: center; width: 40px;">STT</th>
                    <th style="border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000; padding-top: 0px !important; padding-bottom: 10px !important; text-align: center;">Ngày</th>
                    <th style="border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000; padding-top: 0px !important; padding-bottom: 10px !important; text-align: center;">Mã phiếu</th>
                    <th style="border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000; padding-top: 0px !important; padding-bottom: 10px !important; text-align: center;">Đối tác</th>
                    <th style="border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000; padding-top: 0px !important; padding-bottom: 10px !important; text-align: center;">Đã thanh toán</th>
                    <th style="border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000; padding-top: 0px !important; padding-bottom: 10px !important; text-align: center;">Còn nợ</th>
                    <th style="border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000; padding-top: 0px !important; padding-bottom: 10px !important; text-align: center;">Hạn TT</th>
                    <th style="border-spacing: 0; border: 1px solid #000; border-bottom: none; padding-top: 0px !important; padding-bottom: 10px !important; text-align: center;">Ghi chú</th>
                </tr>
            </thead>
            <tbody>
                <style>td { font-size: 15px !important; border-collapse: separate; border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000; padding-top: 0px !important; padding-bottom: 12px !important; padding-left: 4px; padding-right: 4px; vertical-align: middle; }</style>
                ${rows}
            </tbody>
            <tfoot>
                <tr style="font-weight: bold; background: #f3f4f6;">
                    <td colspan="5" style="border: 1px solid #000; border-right: none; padding: 8px 4px; text-align: right; padding-right: 8px;">TỔNG CỘNG:</td>
                    <td style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 8px 4px; text-align: right; color: #dc2626;">${formatCurrency(totalRemainingDebt)}</td>
                    <td colspan="2" style="border: 1px solid #000; border-right: 1px solid #000; padding: 8px 4px;"></td>
                </tr>
            </tfoot>
        </table>
      </div>
    `;
  };

  const handleCaptureTable = async () => {
    try {
      toast.info('Đang tạo ảnh...', { autoClose: 1000 });
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute'; tempContainer.style.top = '0'; tempContainer.style.left = '-9999px'; tempContainer.style.width = '1000px'; tempContainer.style.backgroundColor = '#ffffff'; tempContainer.style.padding = '40px';
      tempContainer.innerHTML = generateReportHTML(currentItems); 
      document.body.appendChild(tempContainer);
      const canvas = await html2canvas(tempContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const link = document.createElement('a'); link.download = `CongNo_${new Date().toISOString().slice(0,10)}.png`; link.href = canvas.toDataURL('image/png'); link.click();
      document.body.removeChild(tempContainer);
      toast.success('Lưu ảnh thành công!');
    } catch (err) { console.error(err); toast.error('Lỗi khi tạo ảnh: ' + err.message); }
  };

  const openPaymentModal = (item) => {
    if (item.code?.startsWith('TT')) return;
    setPaymentData({ item: item, amount: item.remaining, note: 'Thanh toán' });
    setShowPaymentModal(true);
  };

  const submitPayment = async (item, amount) => {
    try {
        await axiosClient.put(`/debts/payment/${item._id}`, { amount: Number(amount) });
        toast.success('Thanh toán thành công!');
        handleClosePayment();
        const newItems = items.map(i => {
            if (i._id === item._id) {
                const newPaid = i.paid + Number(amount);
                const newRemaining = i.amount - newPaid;
                return { ...i, paid: newPaid, remaining: newRemaining };
            } return i;
        });
        setItems(newItems); updateCache('debts', newItems); triggerRefresh(['dashboard', 'partners', 'debts']);
    } catch (error) { toast.error('Lỗi: ' + (error.response?.data?.message || error.message)); fetchData(); }
  };

  const openNoteModal = (item) => {
    setNoteData({ item: item, note: item.note });
    setShowNoteModal(true);
  };

  const submitNote = async () => {
    try {
      const { item, note } = noteData;
      await axiosClient.put(`/debts/${item._id}`, { note });
      toast.success('Đã cập nhật ghi chú!');
      handleCloseNote();
      const newItems = items.map(i => {
          if (i._id === item._id) return { ...i, note: note }; return i;
      });
      setItems(newItems); updateCache('debts', newItems); 
    } catch (error) { toast.error('Lỗi cập nhật: ' + error.message); }
  };

  const handleSort = (key) => { let direction = 'asc'; if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const renderSortIcon = (key) => { if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 ml-1" />; return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-1" /> : <ArrowDown size={14} className="text-blue-600 ml-1" />; };
  const formatCurrency = (val) => val?.toLocaleString('vi-VN') + '₫';

  return (
    <div className="p-2 pb-10">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.95); }
        }
      `}</style>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3 self-start md:self-center">
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100 text-black-600 transition-colors"><Menu size={24} /></button>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">Công nợ</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Tìm mã, đối tác, ghi chú..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="relative">
             <select className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm bg-white cursor-pointer" value={filterPaymentStatus} onChange={(e) => setFilterPaymentStatus(e.target.value)}>
                <option value="all">Tất cả trạng thái </option>
                <option value="has_paid">Đã thanh toán</option>
                <option value="no_pay">Chưa thanh toán</option>
             </select>
          </div>
          <button onClick={handleCaptureTable} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors text-sm" title="Lưu ảnh bảng hiện tại"><ImageIcon size={18} /></button>
        </div>
      </div>

      {/* TABLE - ĐÃ SỬA THẺ THEAD */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
              <tr>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">Ngày{renderSortIcon('date')}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('code')}>
                    <div className="flex items-center gap-1">Mã phiếu{renderSortIcon('code')}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('partner_name')}>
                    <div className="flex items-center gap-1">Đối tác{renderSortIcon('partner_name')}</div>
                </th>
                <th className="p-4 text-right text-green-600 transition-colors">Đã thanh toán</th>
                <th className="p-4 text-right text-red-600 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('remaining')}>
                    <div className="flex items-center justify-end gap-1">Còn nợ{renderSortIcon('remaining')}</div>
                </th>
                <th className="p-4 text-center w-32 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('dueDate')}>
                    <div className="flex items-center justify-center gap-1">Hạn TT{renderSortIcon('dueDate')}</div>
                </th>
                <th className="p-4 transition-colors">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? ( <tr><td colSpan="7" className="p-8 text-center text-gray-500">Đang tải...</td></tr> ) : 
               currentItems.length === 0 ? ( <tr><td colSpan="7" className="p-8 text-center text-gray-500">Không có dữ liệu</td></tr> ) : 
               (currentItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4 text-gray-600 border-r-0 text-sm">{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                    <td className="p-4 font-mono text-blue-600 font-bold border-r-0 text-sm">{item.code}</td>
                    <td className="p-4 font-medium text-gray-800 border-r-0">{item.partner_name}</td>
                    <td className={`p-4 text-right border-r-0 font-medium ${item.code?.startsWith('TT') ? 'text-gray-400' : 'text-green-700 cursor-pointer hover:bg-blue-50 group/edit'}`} onClick={() => !item.code?.startsWith('TT') && openPaymentModal(item)} title={!item.code?.startsWith('TT') ? "Bấm để trả thêm" : ""}>
                        {formatCurrency(item.paid)} 
                        {!item.code?.startsWith('TT') && <span className="ml-1 text-gray-400 text-xs opacity-0 group-hover/edit:opacity-100">✎</span>}
                    </td>
                    <td className="p-4 text-right font-bold text-red-600 border-r-0">{item.remaining > 0 ? formatCurrency(item.remaining):'0₫'}</td>
                    <td className="p-4 text-center text-gray-600 border-r-0 text-sm">{item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : '-'}</td>
                    <td className="p-4 text-sm text-gray-500 italic cursor-pointer hover:bg-yellow-50 group/note relative" onClick={() => openNoteModal(item)} title="Bấm để sửa ghi chú">
                        <div className="max-w-[200px] truncate">{item.note || <span className="opacity-50">...</span>}</div>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover/note:opacity-100"><Edit3 size={14}/></span>
                    </td>
                  </tr>
                )))}
            </tbody>
            <tfoot className="bg-gray-100 font-bold border-t">
                <tr>
                    <td colSpan="4" className="p-4 text-right text-gray-700">TỔNG NỢ CÒN LẠI:</td>
                    <td className="p-4 text-right text-red-600 border-r-0">{formatCurrency(totalRemainingDebt)}</td>
                    <td colSpan="2"></td>
                </tr>
            </tfoot>
          </table>
        </div>

        {/* THANH PHÂN TRANG UI */}
        {processedData.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <div className="text-sm text-gray-500">Hiển thị {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, processedData.length)} trong số {processedData.length} hóa đơn</div>
              <div className="flex items-center gap-2">
                <select className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value="10">10 dòng</option><option value="20">20 dòng</option><option value="50">50 dòng</option><option value="100">100 dòng</option>
                </select>
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className={`p-1 rounded-md border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-white'}`}><ChevronLeft size={20} /></button>
                <div className="flex gap-1">{Array.from({ length: Math.min(5, totalPages) }, (_, i) => { let pageNum = i + 1; if (totalPages > 5) { if (currentPage > 3) pageNum = currentPage - 2 + i; if (pageNum > totalPages) pageNum = totalPages - 4 + i; } return (<button key={pageNum} onClick={() => paginate(pageNum)} className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${ currentPage === pageNum ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100' }`}>{pageNum}</button>) })}</div>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className={`p-1 rounded-md border ${currentPage === totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-white'}`}><ChevronRight size={20} /></button>
              </div>
            </div>
        )}
      </div>

      {/* MODAL THANH TOÁN */}
      {showPaymentModal && paymentData.item && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div 
             className="bg-white rounded-xl shadow-xl w-96 p-6"
             style={{ 
               animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' 
             }} 
           >
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800">Thanh toán</h3><button onClick={handleClosePayment}><X size={20} className="text-gray-400 hover:text-red-500"/></button></div>
              <div className="mb-4 bg-blue-50 p-3 rounded border"><p className="text-sm text-gray-600">Hóa đơn: <b>{paymentData.item.code}</b></p><p className="text-sm text-gray-600">Còn nợ: <b className="text-red-600">{formatCurrency(paymentData.item.remaining)}</b></p></div>
              <div className="space-y-4">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Số tiền trả lần này</label><div className="relative"><DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input type="number" className="w-full border border-blue-300 rounded-lg p-3 pl-10 text-xl font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-200 transition-all" autoFocus value={paymentData.amount} onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})} /></div></div>
              </div>
              <div className="flex gap-3 mt-6"><button onClick={handleClosePayment} className="flex-1 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors">Hủy</button><button onClick={() => submitPayment(paymentData.item, paymentData.amount)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md transition-colors">Xác nhận</button></div>
           </div>
        </div>
      )}

      {/* MODAL GHI CHÚ */}
      {showNoteModal && noteData.item && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div 
             className="bg-white rounded-xl shadow-xl w-96 p-6"
             style={{ 
               animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' 
             }} 
           >
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800">Cập nhật ghi chú</h3><button onClick={handleCloseNote}><X size={20} className="text-gray-400 hover:text-red-500"/></button></div>
              <div className="space-y-4">
                  <p className="text-sm text-gray-600">Phiếu: <b>{noteData.item.code}</b></p>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Nội dung ghi chú</label><textarea className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none" placeholder="Nhập ghi chú..." value={noteData.note} onChange={(e) => setNoteData({...noteData, note: e.target.value})} autoFocus /></div>
              </div>
              <div className="flex gap-3 mt-6"><button onClick={handleCloseNote} className="flex-1 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors">Hủy</button><button onClick={submitNote} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md transition-colors">Lưu lại</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DebtPage;