import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  Plus, Search, X, Barcode, Tag, Gift, Trash2, Menu, Pencil, 
  AlertTriangle, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  Download, FileSpreadsheet, Image as ImageIcon, ChevronDown, 
  ChevronLeft, ChevronRight, Clock 
} from 'lucide-react'; 
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx'; 
import html2canvas from 'html2canvas'; 
import CreatableSelect from 'react-select/creatable';

const ProductPage = () => {
  const { refreshFlags, isExpanded, setIsExpanded } = useOutletContext();
  const reportRef = useRef(null); 
  
  // --- STATE DỮ LIỆU ---
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // --- THẺ KHO (HISTORY) STATES ---
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Thêm State để quản lý phân trang riêng cho Thẻ Kho
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  // --- PAGINATION & FILTER STATES (SẢN PHẨM) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); 
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    _id: null, sku: '', name: '', brand: '', unit: '', import_price: '', export_price: '', gift_points: '', min_stock: 10
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- HÀM FETCH SẢN PHẨM CHÍNH ---
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        status: filterStatus,
        sortKey: sortConfig.key,
        sortDir: sortConfig.direction
      };

      const res = await axiosClient.get('/products', { params });
      const result = res.pagination ? res : (res.data?.pagination ? res.data : res);

      if (result && result.pagination) {
        setProducts(result.data || []);
        setTotalItems(result.pagination.totalItems || 0);
        setTotalPages(result.pagination.totalPages || 1);
      } else {
        setProducts(Array.isArray(res) ? res : (res.data || []));
        setTotalPages(1);
      }
    } catch (error) {
      toast.error('Lỗi tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, filterStatus, sortConfig, refreshFlags?.products]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  };

  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowModal(false);
      setShowHistoryModal(false);
      setIsClosing(false);
      setSelectedProduct(null);
      setHistoryData([]);
      setHistoryPage(1); // Reset lại trang lịch sử khi đóng Modal
    }, 100);
  };

  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    return `Ngày: ${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}`;
  };

  // --- HÀM TẢI LỊCH SỬ THẺ KHO THEO TRANG ---
  const loadHistoryData = async (productId, page) => {
    setLoadingHistory(true);
    try {
      const res = await axiosClient.get(`/products/${productId}/history?page=${page}`);
      const payload = res.data || res;
      const actualData = payload.data || payload; 
      
      setHistoryData(Array.isArray(actualData) ? actualData : []);
      setHistoryTotalPages(payload.totalPages || 1);
      setHistoryPage(page);
    } catch (error) {
      setHistoryData([]);
      toast.error("Không tải được thẻ kho");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewHistory = async (e, product) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setShowHistoryModal(true);
    await loadHistoryData(product._id, 1); // Bấm vào luôn load trang 1
  };

  const getHistoryTypeLabel = (type) => {
    switch (type) {
      case 'IMPORT': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Nhập kho</span>;
      case 'EXPORT': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Xuất bán</span>;
      case 'DELETE_IMPORT': 
      case 'DELETE_EXPORT': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Xóa phiếu</span>;
      case 'UPDATE_MANUAL': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">Sửa thủ công</span>;
      default: return type;
    }
  };

  const handlePriceChange = (field, value) => {
    const raw = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ ...prev, [field]: raw ? Number(raw).toLocaleString() : '' }));
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        import_price: Number(String(formData.import_price).replace(/[^0-9]/g, '')),
        export_price: Number(String(formData.export_price).replace(/[^0-9]/g, '')),
      };
      if (isEditMode) await axiosClient.put(`/products/${formData._id}`, payload);
      else await axiosClient.post('/products', payload);
      toast.success('Thành công!');
      handleCloseModal();
      fetchProducts();
    } catch (error) { toast.error('Lỗi lưu dữ liệu'); }
  };

  const handleExportExcel = async () => {
    try {
      toast.info("Đang xử lý dữ liệu xuất Excel...");
      const params = new URLSearchParams({ limit: 'all', search: debouncedSearchTerm, status: filterStatus });
      const res = await axiosClient.get(`/products?${params.toString()}`);
      const exportList = res.data || res;
      const dataToExport = (Array.isArray(exportList) ? exportList : exportList.data || []).map(p => ({
        'Tên sản phẩm': p.name,
        'Nhãn hàng': p.brand || '',
        'Đơn vị': p.unit,
        'Điểm': p.gift_points || 0,
        'Tồn cuối': p.current_stock
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BaoCaoTonKho");
      XLSX.writeFile(wb, `Ton_Kho_${new Date().getTime()}.xlsx`);
    } catch(err) { toast.error("Lỗi xuất Excel"); } finally { setShowExportMenu(false); }
  };

  const handleExportImage = async () => {
    if (reportRef.current) {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Bao_Cao_Ton_Kho.png`;
      link.click();
      setShowExportMenu(false);
    }
  };

  return (
    <div className="p-2 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-3 self-start">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100"><Menu size={24} /></button>
          <h1 className="text-2xl font-bold text-gray-800">Sản phẩm</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Tìm kiếm sản phẩm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="pl-3 pr-8 py-2 border rounded-lg text-sm bg-white outline-none" value={filterStatus} onChange={(e) => {setFilterStatus(e.target.value); setCurrentPage(1);}}>
            <option value="all">Tất cả kho</option>
            <option value="in_stock">Còn hàng</option>
            <option value="out_of_stock">Hết hàng</option>
          </select>
          <button onClick={() => { setIsEditMode(false); setFormData({sku:'', name:'', brand:'', unit:'', import_price:'', export_price:'', gift_points:'', min_stock:10}); setShowModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-blue-700">
            <Plus size={20} /> Thêm mới
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden relative">
        {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
              <tr>
                <th className="p-4 cursor-pointer" onClick={() => handleSort('sku')}>Mã SP {sortConfig.key === 'sku' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="p-4 cursor-pointer" onClick={() => handleSort('name')}>Tên sản phẩm {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="p-4">Nhãn hàng</th>
                <th className="p-4 text-right">Giá bán</th>
                <th className="p-4 text-center">Tồn kho</th>
                <th className="p-4 text-center w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setFormData({...p, import_price: p.import_price?.toLocaleString(), export_price: p.export_price?.toLocaleString()}); setIsEditMode(true); setShowModal(true); }}>
                  <td className="p-4 font-mono">{p.sku || '---'}</td>
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{p.brand || '-'}</span></td>
                  <td className="p-4 text-right font-semibold">{p.export_price?.toLocaleString()}₫</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded font-bold ${p.current_stock <= p.min_stock ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {p.current_stock}
                    </span>
                  </td>
                  <td className="p-4 text-center flex justify-center gap-2">
                    <button onClick={(e) => handleViewHistory(e, p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full" title="Thẻ kho"><Clock size={18}/></button>
                    <button onClick={async (e) => { e.stopPropagation(); if(window.confirm('Xóa?')) { await axiosClient.delete(`/products/${p._id}`); fetchProducts(); } }} className="p-2 text-red-400 hover:bg-red-50 rounded-full"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
            <div className="text-sm text-gray-500">Hiển thị {((currentPage-1)*itemsPerPage)+1}-{Math.min(currentPage*itemsPerPage, totalItems)} / {totalItems}</div>
            <div className="flex items-center gap-2">
              <select className="border rounded px-2 py-1 text-sm bg-white" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v} dòng</option>)}
              </select>
              <div className="flex items-center border rounded-md overflow-hidden ml-2">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 hover:bg-gray-50 disabled:opacity-30 border-r"><ChevronLeft size={18}/></button>
                {getPageNumbers().map(p => (
                  <button key={p} onClick={() => setCurrentPage(p)} className={`px-3.5 py-1.5 text-sm font-bold border-r last:border-r-0 ${currentPage === p ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>{p}</button>
                ))}
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 hover:bg-gray-50 disabled:opacity-30"><ChevronRight size={18}/></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div id="report-template" ref={reportRef} className="fixed left-[-9999px] w-[800px] bg-white p-10">
        <div className="text-center mb-8"><h1 className="text-3xl font-bold uppercase tracking-widest text-black">BÁO CÁO TỒN KHO</h1><p className="text-sm italic text-gray-600 mt-2">{getCurrentDateTime()}</p></div>
        <table className="w-full border-collapse border-2 border-black text-sm">
          <thead><tr className="bg-gray-200"><th className="border-2 border-black p-3 font-bold">Tên sản phẩm</th><th className="border-2 border-black p-3 font-bold">Nhãn hàng</th><th className="border-2 border-black p-3 font-bold">ĐVT</th><th className="border-2 border-black p-3 font-bold">Tồn cuối</th></tr></thead>
          <tbody>{products.map(p => <tr key={p._id}><td className="border border-black p-3 font-medium">{p.name}</td><td className="border border-black p-3">{p.brand || '-'}</td><td className="border border-black p-3 text-center">{p.unit}</td><td className="border border-black p-3 text-center font-bold">{p.current_stock}</td></tr>)}</tbody>
        </table>
      </div>

      {/* MODAL THẺ KHO CÓ PHÂN TRANG */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2"><Clock size={24} className="text-blue-600"/> Lịch sử: {selectedProduct?.name}</h2>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-200 rounded-full bg-white border shadow-sm"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto relative">
              {loadingHistory && <div className="absolute inset-0 bg-white/70 flex justify-center items-center z-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}
              <table className="w-full text-sm">
                <thead className="bg-white sticky top-0 border-b z-10">
                  <tr className="text-gray-500 font-bold uppercase text-[11px]">
                    <th className="p-4 text-left">Thời gian</th><th className="p-4 text-left">Thao tác</th><th className="p-4 text-left">Mã phiếu</th><th className="p-4 text-right">Đầu</th><th className="p-4 text-right">+/-</th><th className="p-4 text-right">Cuối</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyData.map(item => (
                    <tr key={item._id} className="hover:bg-blue-50/50">
                      <td className="p-4 text-gray-600 font-medium">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="p-4">{getHistoryTypeLabel(item.type)}</td>
                      <td className="p-4 font-mono text-blue-600 text-xs">{item.reference_code || '---'}</td>
                      <td className="p-4 text-right text-gray-400 font-medium">{item.previous_stock}</td>
                      <td className={`p-4 text-right font-black text-base ${item.change_quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.change_quantity > 0 ? `+${item.change_quantity}` : item.change_quantity}</td>
                      <td className="p-4 text-right font-black bg-gray-50">{item.new_stock}</td>
                    </tr>
                  ))}
                  {historyData.length === 0 && !loadingHistory && (
                    <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic font-medium">Không tìm thấy dữ liệu.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* THANH ĐIỀU HƯỚNG PHÂN TRANG THẺ KHO */}
            {historyTotalPages > 1 ? (
              <div className="p-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
                <span className="text-sm font-medium text-gray-500">Trang {historyPage} / {historyTotalPages}</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => loadHistoryData(selectedProduct._id, historyPage - 1)} 
                    disabled={historyPage === 1} 
                    className="p-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={18}/>
                  </button>
                  <button 
                    onClick={() => loadHistoryData(selectedProduct._id, historyPage + 1)} 
                    disabled={historyPage === historyTotalPages} 
                    className="p-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={18}/>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 border-t bg-gray-50 text-center text-xs text-gray-500 shrink-0">
                Chỉ hiển thị trang lịch sử đầu tiên.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FORM THÊM/SỬA SẢN PHẨM */}
      {showModal && !showHistoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h2 className="text-xl font-bold text-gray-800">{isEditMode ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}</h2>
              <button onClick={handleCloseModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div><label className="block text-sm font-bold mb-1">Tên sản phẩm *</label><input type="text" className="w-full border rounded-lg p-2" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required /></div>
                <div><label className="block text-sm font-bold mb-1">Mã SKU</label><input type="text" className="w-full border rounded-lg p-2" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} /></div>
                <div><label className="block text-sm font-bold mb-1">Nhãn hàng</label><CreatableSelect isClearable options={[]} value={formData.brand ? {label:formData.brand, value:formData.brand} : null} onChange={(s) => setFormData({...formData, brand: s?s.value:''})} /></div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-1">Giá nhập</label><input type="text" className="w-full border rounded-lg p-2" value={formData.import_price} onChange={(e) => handlePriceChange('import_price', e.target.value)} /></div>
                  <div><label className="block text-sm font-bold mb-1">Giá bán</label><input type="text" className="w-full border rounded-lg p-2" value={formData.export_price} onChange={(e) => handlePriceChange('export_price', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-1">Đơn vị</label><input type="text" className="w-full border rounded-lg p-2" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} /></div>
                  <div><label className="block text-sm font-bold mb-1">Cảnh báo tồn</label><input type="number" className="w-full border rounded-lg p-2" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: e.target.value})} /></div>
                </div>
              </div>
              <div className="col-span-full flex gap-3 border-t pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Lưu dữ liệu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;