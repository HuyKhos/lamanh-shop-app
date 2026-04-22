import React, { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  Users, Plus, Search, X, MapPin, Phone, User, 
  Trash2, Save, Menu, Pencil, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  Crown, EyeOff, ChevronLeft, ChevronRight 
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import _ from 'lodash'; // Nếu chưa có, hãy chạy: npm install lodash

const PartnerPage = () => {
  const { isExpanded, setIsExpanded } = useOutletContext();
  const { globalCache, refreshFlags, updateCache, triggerRefresh } = useOutletContext();

  // --- STATE DỮ LIỆU & PHÂN TRANG ---
  const [partners, setPartners] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    limit: 10
  });

  // --- STATE BỘ LỌC ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- STATE MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [formData, setFormData] = useState({
    _id: null, name: '', phone: '', address: '', type: 'customer', is_wholesale: false, hide_price: false
  });

  // --- HÀM GỌI API (ĐÃ GIA CỐ CHỐNG CRASH) ---
  const fetchPartners = async (page = currentPage, limit = itemsPerPage, type = filterType, search = searchTerm) => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/partners', {
        params: {
          page,
          limit,
          type: type === 'all' ? undefined : type,
          keyword: search || undefined
        }
      });
      
      // BẢO VỆ FRONTEND: Đảm bảo dữ liệu luôn là Mảng (Array)
      let validPartners = [];
      let validPagination = { currentPage: 1, totalPages: 0, totalItems: 0, limit: 10 };

      if (res && res.data && Array.isArray(res.data)) {
        validPartners = res.data; // Format mới của Backend
        validPagination = res.pagination || validPagination;
      } else if (Array.isArray(res)) {
        validPartners = res; // Fallback: Nếu Backend cũ (trả về mảng trực tiếp) vẫn đang chạy
      } else if (res && res.data && Array.isArray(res.data.data)) {
        validPartners = res.data.data; // Fallback: Nếu API vô tình bọc 2 lớp data
      }

      setPartners(validPartners);
      setPagination(validPagination);
      updateCache('partners', validPartners);
      
    } catch (error) {
      toast.error('Lỗi tải danh sách đối tác');
      console.error(error);
      setPartners([]); // Đưa về mảng rỗng nếu gọi API thất bại
    } finally {
      setLoading(false);
    }
  };

  // --- DEBOUNCE TÌM KIẾM ---
  // Tránh việc gọi API mỗi khi gõ 1 ký tự
  const debouncedSearch = useCallback(
    _.debounce((value) => {
      setCurrentPage(1); // Reset về trang 1 khi tìm kiếm
      fetchPartners(1, itemsPerPage, filterType, value);
    }, 500),
    [itemsPerPage, filterType]
  );

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // --- THEO DÕI THAY ĐỔI TRANG & BỘ LỌC ---
  useEffect(() => {
    fetchPartners();
  }, [currentPage, itemsPerPage, filterType, refreshFlags.partners]);

  // --- XỬ LÝ MODAL ---
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
        setShowModal(false);
        setIsClosing(false);
        resetForm();
    }, 100); 
  };

  const resetForm = () => {
    setFormData({ _id: null, name: '', phone: '', address: '', type: 'customer', is_wholesale: false, hide_price: false });
    setIsEditMode(false);
  };

  const handleSavePartner = async (e) => {
    e.preventDefault();
    try {
      if (isEditMode && formData._id) {
        await axiosClient.put(`/partners/${formData._id}`, formData);
        toast.success('Cập nhật thành công! ✏️');
        triggerRefresh(['exports', 'imports', 'dashboard', 'partners']);
      } else {
        await axiosClient.post('/partners', formData);
        toast.success('Thêm đối tác thành công! 🎉');
        triggerRefresh(['exports', 'imports', 'partners']);
      }
      handleClose();
    } catch (error) {
      toast.error('Lỗi: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeletePartner = async (e, id, name) => {
    e.stopPropagation();
    if (window.confirm(`Bạn có chắc muốn xóa đối tác "${name}" không?`)) {
      try {
        await axiosClient.delete(`/partners/${id}`);
        toast.success('Đã xóa đối tác');
        triggerRefresh('partners');
      } catch (error) {
        toast.error('Không thể xóa: ' + error.message);
      }
    }
  };

  const handleRowClick = (partner) => {
    setFormData({ ...partner });
    setIsEditMode(true);
    setShowModal(true);
  };

  const renderTypeBadge = (type) => {
    if (type === 'customer') return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold border border-orange-200">Khách hàng</span>;
    if (type === 'supplier') return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-200">Nhà cung cấp</span>;
    return type;
  };

  return (
    <div className="p-2 pb-10">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
      `}</style>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3 self-start md:self-center">
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><Menu size={24} /></button>
            <h1 className="text-2xl font-bold text-gray-800">Đối tác</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" 
              placeholder="Tìm tên, số điện thoại..." 
              value={searchTerm} 
              onChange={handleSearchChange} 
            />
            {searchTerm && <button onClick={() => { setSearchTerm(''); fetchPartners(1, itemsPerPage, filterType, ''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm bg-white cursor-pointer" 
            value={filterType} 
            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">Tất cả đối tác</option>
            <option value="customer">Khách hàng</option>
            <option value="supplier">Nhà cung cấp</option>
          </select>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors">
            <Plus size={20} /> <span className="hidden sm:inline">Thêm đối tác</span>
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
              <tr>
                <th className="p-4">Tên đối tác</th>
                <th className="p-4 text-center">Loại</th>
                <th className="p-4">Điện thoại</th>
                <th className="p-4">Địa chỉ</th>
                <th className="p-4 text-center">Điểm gửi</th>
                <th className="p-4 text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
              ) : !Array.isArray(partners) || partners.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Không tìm thấy đối tác nào.</td></tr>
              ) : (
                partners.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-100 transition-colors cursor-pointer group" onClick={() => handleRowClick(p)}>
                    <td className="p-4 font-medium text-gray-800">
                      {p.name}
                      <div className="flex gap-1 mt-1">
                        {p.is_wholesale && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] border border-yellow-200 flex items-center gap-1"><Crown size={10} /> VIP</span>}
                        {p.hide_price && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] border border-gray-200 flex items-center gap-1"><EyeOff size={10} /> Ẩn giá</span>}
                      </div>
                    </td>
                    <td className="p-4 text-center">{renderTypeBadge(p.type)}</td>
                    <td className="p-4 text-gray-600 font-mono text-sm">{p.phone}</td>
                    <td className="p-4 text-gray-600 truncate max-w-xs">{p.address}</td>
                    <td className="p-4 text-center font-bold">{p.saved_points || 0}</td>
                    <td className="p-4 text-center">
                      <button onClick={(e) => handleDeletePartner(e, p._id, p.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PHÂN TRANG UI */}
        {!loading && pagination.totalPages > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">
                Hiển thị {(pagination.currentPage - 1) * pagination.limit + 1} - {Math.min(pagination.currentPage * pagination.limit, pagination.totalItems)} trong số {pagination.totalItems} đối tác
              </div>
              <div className="flex items-center gap-2">
                <select 
                  className="border border-gray-300 rounded-md text-sm px-2 py-1 outline-none" 
                  value={itemsPerPage} 
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value="10">10 dòng</option>
                  <option value="20">20 dòng</option>
                  <option value="50">50 dòng</option>
                </select>
                
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                  disabled={currentPage === 1}
                  className={`p-1 rounded-md border ${currentPage === 1 ? 'text-gray-300 border-gray-200' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="flex gap-1">
                  {[...Array(pagination.totalPages)].map((_, i) => {
                    const page = i + 1;
                    // Hiển thị tối đa 5 nút trang xung quanh trang hiện tại
                    if (page === 1 || page === pagination.totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                      return (
                        <button 
                          key={page} 
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${ currentPage === page ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100' }`}
                        >
                          {page}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages))} 
                  disabled={currentPage === pagination.totalPages}
                  className={`p-1 rounded-md border ${currentPage === pagination.totalPages ? 'text-gray-300 border-gray-200' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
        )}
      </div>

      {/* --- MODAL FORM (Giữ nguyên logic form của bạn) --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
            style={{ animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' }} 
          >
            <div className="flex justify-between items-center p-6 border-b shrink-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {isEditMode ? <><Pencil size={24} /> Cập nhật đối tác</> : <><Plus size={24} /> Thêm đối tác mới</>}
              </h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-red-500"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={handleSavePartner} id="partnerForm" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại đối tác</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                      <option value="customer">Khách hàng</option>
                      <option value="supplier">Nhà cung cấp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" placeholder="0912..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên đối tác <span className="text-red-500">*</span></label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none" placeholder="Chị Lan, Kho Sữa..." value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                  <textarea className="w-full border border-gray-300 rounded-lg p-2.5 outline-none resize-none h-24" placeholder="123 Đường ABC..." value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})}></textarea>
                </div>
                {formData.type === 'customer' && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                    <h3 className="text-sm font-bold text-blue-800 uppercase">Cấu hình khách hàng</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2"><Crown size={18} className="text-yellow-600" /> Khách sỉ</span>
                      <input type="checkbox" className="w-5 h-5 cursor-pointer" checked={formData.is_wholesale} onChange={(e) => setFormData({...formData, is_wholesale: e.target.checked})} />
                    </div>
                    <div className="flex items-center justify-between border-t border-blue-200 pt-3">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2"><EyeOff size={18} className="text-gray-500" /> Luôn ẩn giá khi in</span>
                      <input type="checkbox" className="w-5 h-5 cursor-pointer" checked={formData.hide_price} onChange={(e) => setFormData({...formData, hide_price: e.target.checked})} />
                    </div>
                  </div>
                )}
              </form>
            </div>
            <div className="flex gap-3 border-t p-6 shrink-0">
              <button type="button" onClick={handleClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 transition-colors">Hủy bỏ</button>
              <button type="submit" form="partnerForm" className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <Save size={20} /> {isEditMode ? 'Lưu thay đổi' : 'Lưu đối tác'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerPage;