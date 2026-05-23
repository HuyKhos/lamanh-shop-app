import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  Plus, Search, X, Barcode, Tag, Gift, FileText, Trash2, Menu, Pencil, 
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
  const { refreshFlags } = useOutletContext();
  const { isExpanded, setIsExpanded } = useOutletContext();
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

  // --- STATE TÌM KIẾM, LỌC & SERVER-SIDE PAGINATION ---
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

  const resetForm = () => {
    setFormData({ _id: null, sku: '', name: '', brand: '', unit: '', import_price: '', export_price: '', gift_points: '', min_stock: 10 });
    setIsEditMode(false);
  };

  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowModal(false);
      setShowHistoryModal(false);
      setIsClosing(false);
      setSelectedProduct(null);
      setHistoryData([]);
    }, 100); 
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); 
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // --- HÀM GỌI API ---
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm, 
        status: filterStatus,
        sortKey: sortConfig.key || 'createdAt',
        sortDir: sortConfig.direction === 'asc' ? 'asc' : 'desc'
      });

      const res = await axiosClient.get(`/products?${params.toString()}`);
      
      // Hỗ trợ cả trường hợp res trả về trực tiếp hoặc bọc trong res.data
      const result = res?.pagination ? res : res?.data;

      if (result && result.pagination) {
          setProducts(result.data || []);
          setTotalItems(result.pagination.totalItems);
          setTotalPages(result.pagination.totalPages);
      } else if (Array.isArray(res)) {
          setProducts(res);
          setTotalPages(1);
      }
    } catch (error) {
      toast.error('Lỗi tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearchTerm, filterStatus, sortConfig]);

  // Quan trọng: useEffect phải lắng nghe sự thay đổi của trang và limit
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts, refreshFlags.products, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!showModal && !showHistoryModal) resetForm();
  }, [showModal, showHistoryModal]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setCurrentPage(1); 
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 ml-1" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-1" /> : <ArrowDown size={14} className="text-blue-600 ml-1" />;
  };

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) setCurrentPage(pageNumber);
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    return `Ngày: ${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}`;
  };

  // --- CÁC HÀM XUẤT FILE ---
  const handleExportExcel = async () => {
    try {
      toast.info("Đang xử lý dữ liệu xuất Excel...");
      const params = new URLSearchParams({ limit: 'all', search: debouncedSearchTerm, status: filterStatus });
      const res = await axiosClient.get(`/products?${params.toString()}`);
      const exportList = res.data || res;

      const dataToExport = exportList.map(p => ({
        'Tên sản phẩm': p.name,
        'Nhãn hàng': p.brand || '',
        'Đơn vị': p.unit,
        'Điểm': p.gift_points || 0,
        'Tồn cuối': p.current_stock
      }));
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
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

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        import_price: Number(String(formData.import_price).replace(/[^0-9]/g, '')),
        export_price: Number(String(formData.export_price).replace(/[^0-9]/g, '')),
        gift_points: Number(formData.gift_points),
        min_stock: Number(formData.min_stock),
      };
      if (isEditMode) { await axiosClient.put(`/products/${formData._id}`, payload); toast.success('Cập nhật thành công!'); }
      else { await axiosClient.post('/products', payload); toast.success('Thêm thành công!'); }
      handleCloseModal(); fetchProducts(); 
    } catch (error) { toast.error(`Lỗi: ${error.response?.data?.message || error.message}`); }
  };

  const handleDeleteProduct = async (e, id, name) => {
    e.stopPropagation(); 
    if (window.confirm(`Xóa sản phẩm "${name}"?`)) {
      try { await axiosClient.delete(`/products/${id}`); toast.success('Đã xóa'); fetchProducts(); }
      catch (error) { toast.error('Lỗi: ' + (error.response?.data?.message || error.message)); }
    }
  };

  // --- HÀM MỞ THẺ KHO (ĐÃ SỬA LỖI S.MAP) ---
  const handleViewHistory = async (e, product) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await axiosClient.get(`/products/${product._id}/history`);
      // Dò tìm mảng dữ liệu trong res
      const actualData = res?.data?.data || res?.data || res || [];
      setHistoryData(Array.isArray(actualData) ? actualData : []);
    } catch (error) {
      toast.error('Không tải được lịch sử');
      setHistoryData([]);
    } finally { setLoadingHistory(false); }
  };

  const getHistoryTypeLabel = (type) => {
    switch (type) {
      case 'IMPORT': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Nhập kho</span>;
      case 'EXPORT': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Xuất kho</span>;
      case 'DELETE_IMPORT': 
      case 'DELETE_EXPORT': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Xóa phiếu</span>;
      case 'UPDATE_MANUAL': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">Sửa thủ công</span>;
      default: return type;
    }
  };

  const handleRowClick = (product) => {
    setFormData({ ...product, import_price: product.import_price?.toLocaleString(), export_price: product.export_price?.toLocaleString() });
    setIsEditMode(true); setShowModal(true);
  };

  const handlePriceChange = (field, value) => {
    const rawValue = value.replace(/[^0-9]/g, '');
    setFormData({ ...formData, [field]: rawValue ? Number(rawValue).toLocaleString() : '' });
  };

  const getStockBadgeColor = (current, min) => {
    if (current <= 0) return 'bg-red-50 text-red-500';
    if (current <= min) return 'bg-yellow-50 text-yellow-500';
    return 'bg-blue-50 text-blue-500';
  };

  return (
    <div className="p-2 pb-10">
      <style>{`@keyframes fadeIn {from {opacity: 0; transform: scale(0.95);} to {opacity: 1; transform: scale(1);}} @keyframes fadeOut {from {opacity: 1; transform: scale(1);} to {opacity: 0; transform: scale(0.95);}}`}</style>

      <div className="print:hidden"> 
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3 self-start md:self-center">
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100 text-black-600 transition-colors"><Menu size={24} /></button>
              <h1 className="text-2xl font-bold text-gray-800">Sản phẩm</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Tìm kiếm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">Tất cả kho</option>
                <option value="in_stock">Còn hàng</option>
                <option value="out_of_stock">Hết hàng</option>
            </select>
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="bg-white border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"><Download size={18} /> Xuất file <ChevronDown size={14} /></button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-lg z-20">
                  <button onClick={handleExportExcel} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm"><FileSpreadsheet size={16} className="text-green-600" /> Excel</button>
                  <button onClick={handleExportImage} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm border-t"><ImageIcon size={16} className="text-blue-600" /> Ảnh (PNG)</button>
                </div>
              )}
            </div>
            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><Plus size={20} /> Thêm mới</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden relative min-h-[400px]">
          {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
                <tr>
                  <th className="p-4 cursor-pointer" onClick={() => handleSort('sku')}>Mã SP {renderSortIcon('sku')}</th>
                  <th className="p-4 cursor-pointer" onClick={() => handleSort('name')}>Tên sản phẩm {renderSortIcon('name')}</th>
                  <th className="p-4">Nhãn hàng</th>
                  <th className="p-4">Đơn vị</th>
                  <th className="p-4 text-right">Giá bán</th>
                  <th className="p-4 text-center">Tồn kho</th>
                  <th className="p-4 text-center w-32">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.length === 0 ? <tr><td colSpan="7" className="p-8 text-center text-gray-500">Không có dữ liệu.</td></tr> : products.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-100 cursor-pointer" onClick={() => handleRowClick(p)}>
                    <td className="p-4 text-sm font-mono">{p.sku || '---'}</td>
                    <td className="p-4 font-medium">{p.name}</td>
                    <td className="p-4"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs border">{p.brand || '-'}</span></td>
                    <td className="p-4">{p.unit}</td>
                    <td className="p-4 text-right">{p.export_price?.toLocaleString()}₫</td>
                    <td className="p-4 text-center"><div className={`w-10 h-8 flex items-center justify-center mx-auto rounded-full font-bold text-sm ${getStockBadgeColor(p.current_stock, p.min_stock)}`}>{p.current_stock}</div></td>
                    <td className="p-4 text-center flex justify-center gap-1">
                      <button onClick={(e) => handleViewHistory(e, p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-all" title="Xem thẻ kho"><Clock size={18} /></button>
                      <button onClick={(e) => handleDeleteProduct(e, p._id, p.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalItems > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">Hiển thị {((currentPage-1)*itemsPerPage)+1}-{Math.min(currentPage*itemsPerPage, totalItems)} / {totalItems}</div>
              <div className="flex items-center gap-2">
                <select className="border rounded text-sm px-2 py-1" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v} dòng</option>)}
                </select>
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-1 disabled:opacity-30"><ChevronLeft/></button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p = totalPages > 5 && currentPage > 3 ? currentPage - 2 + i : i + 1;
                    if (p > totalPages) p = totalPages - (4-i);
                    return <button key={p} onClick={() => paginate(p)} className={`w-8 h-8 rounded text-sm ${currentPage === p ? 'bg-blue-600 text-white' : 'border'}`}>{p}</button>
                  })}
                </div>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 disabled:opacity-30"><ChevronRight/></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MẪU BÁO CÁO (ẨN) --- */}
      <div id="report-template" ref={reportRef} className="fixed left-[-9999px] w-[650px] bg-white p-10">
        <div className="text-center mb-6"><h1 className="text-2xl font-bold">BÁO CÁO TỒN KHO</h1><p className="text-sm italic">{getCurrentDateTime()}</p></div>
        <table className="w-full border-collapse border border-black text-sm">
          <thead><tr className="bg-gray-100"><th className="border border-black p-2">Tên</th><th className="border border-black p-2">ĐVT</th><th className="border border-black p-2">Tồn</th></tr></thead>
          <tbody>{products.map(p => <tr key={p._id}><td className="border border-black p-2">{p.name}</td><td className="border border-black p-2 text-center">{p.unit}</td><td className="border border-black p-2 text-center">{p.current_stock}</td></tr>)}</tbody>
        </table>
      </div>

      {/* MODAL THẺ KHO */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <div><h2 className="font-bold text-gray-800 flex items-center gap-2"><Clock size={20} className="text-blue-600"/> Thẻ Kho</h2><p className="text-xs text-gray-500">{selectedProduct?.name}</p></div>
              <button onClick={handleCloseModal} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingHistory ? <div className="p-10 text-center animate-pulse">Đang tải lịch sử...</div> : 
              <table className="w-full text-sm">
                <thead className="bg-white sticky top-0 border-b">
                  <tr><th className="p-3 text-left">Ngày</th><th className="p-3 text-left">Thao tác</th><th className="p-3 text-left">Mã phiếu</th><th className="p-3 text-right">Đầu</th><th className="p-3 text-right">Biến động</th><th className="p-3 text-right">Cuối</th></tr>
                </thead>
                <tbody className="divide-y">
                  {Array.isArray(historyData) && historyData.length > 0 ? historyData.map(item => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-600 text-xs">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="p-3">{getHistoryTypeLabel(item.type)}</td>
                      <td className="p-3 font-mono text-blue-600 text-xs">{item.reference_code || '---'}</td>
                      <td className="p-3 text-right text-gray-400">{item.previous_stock}</td>
                      <td className={`p-3 text-right font-bold ${item.change_quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.change_quantity > 0 ? `+${item.change_quantity}` : item.change_quantity}</td>
                      <td className="p-3 text-right font-bold bg-blue-50/30">{item.new_stock}</td>
                    </tr>
                  )) : <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Không có dữ liệu biến động.</td></tr>}
                </tbody>
              </table>}
            </div>
            <div className="p-3 border-t bg-gray-50 text-center text-xs text-gray-500">Hiển thị lịch sử biến động kho gần nhất.</div>
          </div>
        </div>
      )}

      {/* MODAL FORM THÊM/SỬA */}
      {showModal && !showHistoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 transform scale-100" style={{ animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' }}>
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">{isEditMode ? <Pencil className="text-blue-600" /> : <Plus className="text-blue-600" />} {isEditMode ? 'Cập nhật' : 'Thêm mới'}</h2>
              <button onClick={handleCloseModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div className="space-y-4">
                    <div><label className="block text-sm font-medium mb-1">Mã sản phẩm</label><input type="text" className="w-full border rounded-lg p-2.5" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} /></div>
                    <div><label className="block text-sm font-medium mb-1">Tên sản phẩm *</label><input type="text" className="w-full border rounded-lg p-2.5" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required /></div>
                    <div><label className="block text-sm font-medium mb-1">Nhãn hàng</label><CreatableSelect isClearable options={Array.from(new Set(products.map(p => p.brand).filter(Boolean))).map(b => ({ value: b, label: b }))} value={formData.brand ? { label: formData.brand, value: formData.brand } : null} onChange={(s) => setFormData({ ...formData, brand: s ? s.value : '' })} styles={{ control: (b) => ({ ...b, borderRadius: '0.5rem', minHeight: '42px' }) }} /></div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium mb-1">Giá nhập</label><input type="text" className="w-full border rounded-lg p-2.5" value={formData.import_price} onChange={(e) => handlePriceChange('import_price', e.target.value)} /></div>
                      <div><label className="block text-sm font-medium mb-1">Giá bán</label><input type="text" className="w-full border rounded-lg p-2.5" value={formData.export_price} onChange={(e) => handlePriceChange('export_price', e.target.value)} /></div>
                    </div>
                    <div><label className="block text-sm font-medium mb-1">Điểm quà</label><input type="number" className="w-full border rounded-lg p-2.5" value={formData.gift_points} onChange={(e) => setFormData({...formData, gift_points: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium mb-1">Đơn vị</label><input type="text" className="w-full border rounded-lg p-2.5" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} /></div>
                      <div><label className="block text-sm font-medium mb-1">Cảnh báo tồn</label><input type="number" className="w-full border rounded-lg p-2.5" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: e.target.value})} /></div>
                    </div>
                  </div>
              </div>
              <div className="flex gap-3 border-t pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-3 border rounded-lg font-medium">Hủy bỏ</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-md">Lưu dữ liệu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;