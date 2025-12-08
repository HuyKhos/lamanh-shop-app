import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  Users, Plus, Search, X, MapPin, Phone, User, 
  Trash2, Save, Menu, Pencil, Filter, ArrowUpDown, ArrowUp, ArrowDown, HandCoins,
  Crown, EyeOff, ChevronLeft, ChevronRight 
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';

const PartnerPage = () => {
  const { isExpanded, setIsExpanded } = useOutletContext();
  const { globalCache, refreshFlags, updateCache, triggerRefresh } = useOutletContext();

  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // --- STATE ANIMATION ĐÓNG ---
  const [isClosing, setIsClosing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); 
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  const [partners, setPartners] = useState(globalCache.partners || []); 
  const [loading, setLoading] = useState(!globalCache.partners);

  const [formData, setFormData] = useState({
    _id: null, name: '', phone: '', address: '', type: 'customer', current_debt: 0, is_wholesale: false, hide_price: false
  });

  const resetForm = () => {
    setFormData({ _id: null, name: '', phone: '', address: '', type: 'customer', current_debt: 0, is_wholesale: false, hide_price: false });
    setIsEditMode(false);
  };

  // --- HÀM ĐÓNG MODAL CÓ HIỆU ỨNG ---
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
        setShowModal(false);
        setIsClosing(false);
    }, 100); // 0.1s
  };

  useEffect(() => {
    const loadData = async () => {
      if (!globalCache.partners || refreshFlags.partners) {
        try {
          setLoading(true);
          const res = await axiosClient.get('/partners');
          setPartners(res);
          updateCache('partners', res);
        } catch (error) { console.error(error); } finally { setLoading(false); }
      }
    };
    loadData();
  }, [refreshFlags.partners]);

  useEffect(() => { if (!showModal) resetForm(); }, [showModal]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType]);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const data = await axiosClient.get('/partners');
      setPartners(data);
      updateCache('partners', data);
    } catch (error) { toast.error('Lỗi tải danh sách đối tác'); } finally { setLoading(false); }
  };

  const getProcessedPartners = () => {
    let result = [...partners];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(p => (p.name || '').toLowerCase().includes(lowerTerm) || (p.phone || '').includes(lowerTerm) || (p.address || '').includes(lowerTerm));
    }
    if (filterType !== 'all') result = result.filter(p => p.type === filterType);
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key]; let bValue = b[sortConfig.key];
        if (aValue === undefined || aValue === null) aValue = ''; if (bValue === undefined || bValue === null) bValue = '';
        if (typeof aValue === 'string') return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }
    return result;
  };

  const handleSort = (key) => { let direction = 'asc'; if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const renderSortIcon = (key) => { if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 ml-1" />; return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-1" /> : <ArrowDown size={14} className="text-blue-600 ml-1" />; };

  const processedPartners = getProcessedPartners();
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPartners = processedPartners.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(processedPartners.length / itemsPerPage);

  const paginate = (pageNumber) => { if (pageNumber > 0 && pageNumber <= totalPages) setCurrentPage(pageNumber); };

  const handleSavePartner = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode && formData._id) {
        await axiosClient.put(`/partners/${formData._id}`, formData);
        toast.success('Cập nhật thành công! ✏️');
        triggerRefresh(['exports', 'imports', 'dashboard', 'debts', 'partners']);
      } else {
        await axiosClient.post('/partners', formData);
        toast.success('Thêm đối tác thành công! 🎉');
        triggerRefresh(['exports', 'imports', 'partners']);
      }
      
      // ĐÓNG MODAL VỚI HIỆU ỨNG
      handleClose();
      
      fetchPartners();
    } catch (error) { toast.error('Lỗi: ' + (error.response?.data?.message || error.message)); }
  };

  const handleDeletePartner = async (e, id, name) => {
    e.stopPropagation();
    if (window.confirm(`Bạn có chắc muốn xóa đối tác "${name}" không?`)) {
      try { await axiosClient.delete(`/partners/${id}`); toast.success('Đã xóa đối tác'); fetchPartners(); } catch (error) { toast.error('Không thể xóa: ' + error.message); }
    }
  };

  const handleRowClick = (partner) => {
    setFormData({ ...partner, is_wholesale: partner.is_wholesale || false, hide_price: partner.hide_price || false });
    setIsEditMode(true); setShowModal(true);
  };

  const renderTypeBadge = (type) => {
    if (type === 'customer') return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold border border-orange-200">Khách hàng</span>;
    if (type === 'supplier') return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-200">Nhà cung cấp</span>;
    return type;
  };
  const getDebtColorClass = (partner) => { if (partner.type === 'customer') return 'text-orange-600'; if (partner.type === 'supplier') return 'text-blue-600'; return 'text-gray-800'; };

  return (
    <div className="p-2 pb-10">
      {/* --- ĐỊNH NGHĨA KEYFRAMES ANIMATION (FadeIn & FadeOut) --- */}
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
            <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap">Đối tác</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Tìm tên, số điện thoại..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none"><Filter size={16} /></div>
            <select className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm appearance-none bg-white cursor-pointer hover:bg-gray-50" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">Tất cả đối tác</option><option value="customer">Khách hàng</option><option value="supplier">Nhà cung cấp</option>
            </select>
          </div>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors whitespace-nowrap"><Plus size={20} /> <span className="hidden sm:inline">Thêm đối tác</span></button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
              <tr>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('name')}><div className="flex items-center">Tên đối tác {renderSortIcon('name')}</div></th>
                <th className="p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('type')}><div className="flex items-center justify-center">Loại {renderSortIcon('type')}</div></th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('phone')}><div className="flex items-center">Điện thoại {renderSortIcon('phone')}</div></th>
                <th className="p-4">Địa chỉ</th>
                <th className="p-4 text-center">Điểm gửi</th>
                <th className="p-4 text-right cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('current_debt')}><div className="flex items-center justify-end">Công nợ {renderSortIcon('current_debt')}</div></th>
                <th className="p-4 text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {currentPartners.length === 0 ? ( <tr><td colSpan="7" className="p-8 text-center text-gray-500">{loading ? 'Đang tải...' : 'Không tìm thấy đối tác nào.'}</td></tr> ) : (
                currentPartners.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-100 transition-colors cursor-pointer group" onClick={() => handleRowClick(p)}>
                    <td className="p-4 font-medium text-gray-800">{p.name}<div className="flex gap-1 mt-1">{p.is_wholesale && <span title="Khách sỉ (VIP)" className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] border border-yellow-200 flex items-center gap-1 w-fit"><Crown size={10} /> VIP</span>}{p.hide_price && <span title="Ẩn giá khi in" className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] border border-gray-200 flex items-center gap-1 w-fit"><EyeOff size={10} /> Ẩn giá</span>}</div></td>
                    <td className="p-4 text-center">{renderTypeBadge(p.type)}</td>
                    <td className="p-4 text-gray-600 font-mono text-sm">{p.phone}</td>
                    <td className="p-4 text-gray-600 truncate max-w-xs">{p.address}</td>
                    <td className="p-4 text-center font-bold">{p.saved_points || 0}</td>
                    <td className={`p-4 text-right font-bold ${getDebtColorClass(p)}`}>{p.current_debt?.toLocaleString()}₫</td>
                    <td className="p-4 text-center"><button onClick={(e) => handleDeletePartner(e, p._id, p.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" title="Xóa đối tác"><Trash2 size={18} /></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* THANH PHÂN TRANG UI */}
        {processedPartners.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">Hiển thị {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, processedPartners.length)} trong số {processedPartners.length} đối tác</div>
              <div className="flex items-center gap-2">
                <select className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value="10">10 dòng</option><option value="20">20 dòng</option><option value="50">50 dòng</option><option value="100">100 dòng</option>
                </select>
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className={`p-1 rounded-md border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}><ChevronLeft size={20} /></button>
                <div className="flex gap-1">{Array.from({ length: Math.min(5, totalPages) }, (_, i) => { let pageNum = i + 1; if (totalPages > 5) { if (currentPage > 3) pageNum = currentPage - 2 + i; if (pageNum > totalPages) pageNum = totalPages - 4 + i; } return (<button key={pageNum} onClick={() => paginate(pageNum)} className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${ currentPage === pageNum ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100' }`}>{pageNum}</button>) })}</div>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className={`p-1 rounded-md border ${currentPage === totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}><ChevronRight size={20} /></button>
              </div>
            </div>
        )}
      </div>

      {/* --- MODAL FORM --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg transform transition-all scale-100 max-h-[90vh] flex flex-col"
            style={{ 
               animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' 
            }} 
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b pb-3 shrink-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">{isEditMode ? <><Pencil size={24} className="text-black-600" /> Cập nhật đối tác</> : <><Plus size={24} className="text-black-600" /> Thêm đối tác mới</>}</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={handleSavePartner} id="partnerForm">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Users size={16} /> Loại đối tác</label>
                      <select className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none bg-white" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                        <option value="customer">Khách hàng</option><option value="supplier">Nhà cung cấp</option>
                      </select>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Phone size={16} /> Số điện thoại </label>
                      <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="VD: 0912..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                    </div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><User size={16} /> Tên đối tác <span className="text-red-500">*</span></label><input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="VD: Chị Lan, Kho Sữa..." value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={16} /> Địa chỉ</label><textarea className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-24" placeholder="VD: 123 Đường ABC..." value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})}></textarea></div>
                  {formData.type === 'customer' && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                      <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider">Cấu hình khách hàng</h3>
                      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Crown size={18} className="text-yellow-600" /><span className="text-sm font-medium text-gray-700">Khách sỉ (Hưởng chiết khấu)</span></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formData.is_wholesale} onChange={(e) => setFormData({...formData, is_wholesale: e.target.checked})} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div></label></div>
                      <div className="flex items-center justify-between border-t border-blue-200 pt-3"><div className="flex items-center gap-2"><EyeOff size={18} className="text-gray-500" /><span className="text-sm font-medium text-gray-700">Luôn ẩn giá khi in phiếu</span></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formData.hide_price} onChange={(e) => setFormData({...formData, hide_price: e.target.checked})} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div></label></div>
                    </div>
                  )}
                  {isEditMode && (<div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between"><span className="text-sm text-gray-600 flex items-center gap-1"><HandCoins size={16} /> Công nợ hiện tại:</span><span className={`font-bold text-lg ${getDebtColorClass(formData)}`}>{formData.current_debt?.toLocaleString()}₫</span></div>)}
                </div>
              </form>
            </div>
            {/* Footer */}
            <div className="flex gap-3 border-t p-6 pt-4 mt-auto shrink-0">
              <button type="button" onClick={handleClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">Hủy bỏ</button>
              <button type="submit" form="partnerForm" className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center justify-center gap-2 shadow-lg transition-colors"><Save size={20} /> {isEditMode ? 'Lưu thay đổi' : 'Lưu đối tác'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerPage;