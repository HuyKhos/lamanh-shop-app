import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  Plus, Search, X, Barcode, Tag, Gift, FileText, Trash2, Menu, Pencil, 
  AlertTriangle, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  Download, FileSpreadsheet, Image as ImageIcon, ChevronDown, 
  ChevronLeft, ChevronRight 
} from 'lucide-react'; 
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx'; 
import html2canvas from 'html2canvas'; 

const ProductPage = () => {
  const { globalCache, refreshFlags, updateCache } = useOutletContext();
  const { isExpanded, setIsExpanded } = useOutletContext();
  const reportRef = useRef(null); 
  
  const [products, setProducts] = useState(globalCache.products || []);
  const [loading, setLoading] = useState(!globalCache.products);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // --- STATE ANIMATION ĐÓNG (MỚI) ---
  const [isClosing, setIsClosing] = useState(false);

  // --- STATE TÌM KIẾM & LỌC ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });

  // --- STATE PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  const [formData, setFormData] = useState({
    _id: null, sku: '', name: '', unit: '', import_price: '', export_price: '', discount_percent: '', gift_points: '', min_stock: 10
  });

  const resetForm = () => {
    setFormData({
      _id: null, sku: '', name: '', unit: '', import_price: '', export_price: '', discount_percent: '', gift_points: '', min_stock: 10
    });
    setIsEditMode(false);
  };

  // --- HÀM ĐÓNG MODAL CÓ HIỆU ỨNG (MỚI) ---
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowModal(false);
      setIsClosing(false);
    }, 100); // Chờ 0.1s cho animation fadeOut chạy xong
  };

  // --- USE EFFECTS ---
  useEffect(() => {
    const loadData = async () => {
      if (!globalCache.products || refreshFlags.products) {
        try {
          setLoading(true);
          const res = await axiosClient.get('/products');
          setProducts(res);
          updateCache('products', res);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadData();
  }, [refreshFlags.products]);

  useEffect(() => {
    if (!showModal) resetForm();
  }, [showModal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await axiosClient.get('/products');
      setProducts(data);
      updateCache('products', data);
    } catch (error) {
      toast.error('Lỗi tải danh sách');
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIC XỬ LÝ DỮ LIỆU ---
  const getProcessedProducts = () => {
    let result = [...products];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(lowerTerm) || 
        (p.sku && p.sku.toLowerCase().includes(lowerTerm))
      );
    }

    if (filterStatus !== 'all') {
      result = result.filter(p => {
        if (filterStatus === 'out_of_stock') return p.current_stock <= 0;
        if (filterStatus === 'in_stock') return p.current_stock > 0;
        return true;
      });
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';
        if (typeof aValue === 'string') {
          return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }
    return result;
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 ml-1" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-1" /> : <ArrowDown size={14} className="text-blue-600 ml-1" />;
  };

  // --- XỬ LÝ PHÂN TRANG ---
  const filteredProducts = getProcessedProducts();
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    return `Ngày: ${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}`;
  };

  // --- CÁC HÀM XUẤT FILE ---
  const handleExportExcel = () => {
    const dataToExport = filteredProducts.map(p => ({
      'Tên sản phẩm': p.name,
      'Đơn vị': p.unit,
      'Điểm': p.gift_points || 0,
      'Tồn cuối': p.current_stock
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wscols = [{ wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    ws['!cols'] = wscols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BaoCaoTonKho");
    XLSX.writeFile(wb, `Bao_Cao_Ton_Kho_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
    setShowExportMenu(false);
  };

  const handleExportImage = async () => {
    if (reportRef.current) {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, 
        useCORS: true,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('report-template');
          if (el) {
            el.style.left = '0px'; el.style.top = '0px'; el.style.position = 'absolute'; el.style.opacity = '1'; el.style.zIndex = '9999';
          }
        }
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `Bao_Cao_Ton_Kho_${new Date().getTime()}.png`;
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
        discount_percent: Number(formData.discount_percent),
        gift_points: Number(formData.gift_points),
        min_stock: Number(formData.min_stock),
      };

      if (isEditMode && formData._id) {
        await axiosClient.put(`/products/${formData._id}`, payload);
        toast.success('Cập nhật thành công! ✏️');
      } else {
        await axiosClient.post('/products', payload);
        toast.success('Thêm sản phẩm thành công! 🎉');
      }
      
      // ĐÓNG MODAL VỚI HIỆU ỨNG
      handleCloseModal();
      
      fetchProducts();
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      toast.error(`Lỗi: ${message}`);
    }
  };

  const handleDeleteProduct = async (e, id, name) => {
    e.stopPropagation(); 
    if (window.confirm(`Bạn có chắc muốn xóa sản phẩm "${name}" không?`)) {
      try {
        await axiosClient.delete(`/products/${id}`);
        toast.success('Đã xóa sản phẩm');
        fetchProducts();
      } catch (error) {
        const msg = error.response?.data?.message || error.message;
        toast.error('Lỗi: ' + msg);
      }
    }
  };

  const handleRowClick = (product) => {
    setFormData({
      _id: product._id,
      sku: product.sku || '',
      name: product.name,
      unit: product.unit || '',
      import_price: product.import_price?.toLocaleString('en-US') || '',
      export_price: product.export_price?.toLocaleString('en-US') || '',
      discount_percent: product.discount_percent || '',
      gift_points: product.gift_points || '',
      min_stock: product.min_stock || 10
    });
    setIsEditMode(true);
    setShowModal(true);
  };

  const handlePriceChange = (field, value) => {
    const rawValue = value.replace(/[^0-9]/g, '');
    const formattedValue = rawValue ? Number(rawValue).toLocaleString('en-US') : '';
    setFormData({ ...formData, [field]: formattedValue });
  };

  const getStockBadgeColor = (current, min) => {
    if (current <= 0) return 'bg-red-50 text-red-500';
    if (current <= min) return 'bg-yellow-50 text-yellow-500';
    return 'bg-blue-50 text-blue-500';
  };

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

      {/* ----------------- GIAO DIỆN WEB ----------------- */}
      <div className="print:hidden"> 
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3 self-start md:self-center">
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100 text-black-600 transition-colors">
                  <Menu size={24} />
              </button>
              <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap">Sản phẩm</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Tìm tên hoặc mã SP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>)}
            </div>

            {/* Filter */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none"><Filter size={16} /></div>
              <select className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm appearance-none bg-white cursor-pointer hover:bg-gray-50" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">Tất cả kho</option>
                <option value="in_stock">✅ Còn hàng</option>
                <option value="out_of_stock">⛔ Hết hàng</option>
              </select>
            </div>

            {/* Export Menu */}
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors text-sm">
                <Download size={18} /><span className="hidden sm:inline">Xuất file</span><ChevronDown size={14} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  <button onClick={handleExportExcel} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"><FileSpreadsheet size={16} className="text-green-600" /> Xuất Excel</button>
                  <button onClick={handleExportImage} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 border-t border-gray-100"><ImageIcon size={16} className="text-blue-600" /> Lưu ảnh (PNG)</button>
                </div>
              )}
              {showExportMenu && (<div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>)}
            </div>

            {/* Add Button */}
            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors whitespace-nowrap">
              <Plus size={20} /> <span className="hidden sm:inline">Thêm mới</span>
            </button>
          </div>
        </div>

        {/* TABLE WEB */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
                <tr>
                  <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('sku')}><div className="flex items-center">Mã SP {renderSortIcon('sku')}</div></th>
                  <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('name')}><div className="flex items-center">Tên sản phẩm {renderSortIcon('name')}</div></th>
                  <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('unit')}><div className="flex items-center">Đơn vị {renderSortIcon('unit')}</div></th>
                  <th className="p-4 text-right cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('import_price')}><div className="flex items-center justify-end">Giá nhập {renderSortIcon('import_price')}</div></th>
                  <th className="p-4 text-right cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('export_price')}><div className="flex items-center justify-end">Giá bán {renderSortIcon('export_price')}</div></th>
                  <th className="p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('discount_percent')}><div className="flex items-center justify-center">CK(%) {renderSortIcon('discount_percent')}</div></th>
                  <th className="p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('gift_points')}><div className="flex items-center justify-center">Điểm {renderSortIcon('gift_points')}</div></th>
                  <th className="p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('current_stock')}><div className="flex items-center justify-center">Tồn kho {renderSortIcon('current_stock')}</div></th>
                  <th className="p-4 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentItems.length === 0 ? (
                  <tr><td colSpan="9" className="p-8 text-center text-gray-500">{loading ? 'Đang tải...' : 'Không tìm thấy sản phẩm.'}</td></tr>
                ) : (
                  currentItems.map((p) => {
                    const minStock = p.min_stock || 10;
                    const badgeClass = getStockBadgeColor(p.current_stock, minStock);
                    return (
                      <tr key={p._id} className="hover:bg-gray-100 transition-colors cursor-pointer group" onClick={() => handleRowClick(p)}>
                        <td className="p-4 text-gray-800 font-Arial text-sm">{p.sku || '---'}</td>
                        <td className="p-4 font-medium text-gray-800">{p.name}</td>
                        <td className="p-4 text-gray-800">{p.unit || '-'}</td>
                        <td className="p-4 text-right text-gray-800">{p.import_price?.toLocaleString()}₫</td>
                        <td className="p-4 text-right text-gray-800">{p.export_price?.toLocaleString()}₫</td>
                        <td className="p-4 text-center text-gray-800"><span className="text-black-600 px-2 py-1">{p.discount_percent}%</span></td>
                        <td className="p-4 text-center text-gray-800"><span className="px-2 py-1">{p.gift_points}</span></td>
                        <td className="p-4 text-center"><div className={`block w-[40px] h-8 leading-8 text-center mx-auto rounded-full text-sm font-bold shadow-sm ${badgeClass}`}>{p.current_stock}</div></td>
                        <td className="p-4 text-center"><button onClick={(e) => handleDeleteProduct(e, p._id, p.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"><Trash2 size={18} /></button></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* --- THANH PHÂN TRANG UI --- */}
          {filteredProducts.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">
                Hiển thị {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredProducts.length)} trong số {filteredProducts.length} sản phẩm
              </div>
              
              <div className="flex items-center gap-2">
                {/* Nút chọn số lượng mỗi trang */}
                <select 
                  className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value="10">10 dòng</option>
                  <option value="20">20 dòng</option>
                  <option value="50">50 dòng</option>
                  <option value="100">100 dòng</option>
                </select>

                {/* Các nút chuyển trang */}
                <button 
                  onClick={() => paginate(currentPage - 1)} 
                  disabled={currentPage === 1}
                  className={`p-1 rounded-md border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  <ChevronLeft size={20} />
                </button>
                
                {/* Hiển thị số trang */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Logic hiển thị trang thông minh
                    let pageNum = i + 1;
                    if (totalPages > 5) {
                        if (currentPage > 3) pageNum = currentPage - 2 + i;
                        if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => paginate(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                          currentPage === pageNum 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button 
                  onClick={() => paginate(currentPage + 1)} 
                  disabled={currentPage === totalPages}
                  className={`p-1 rounded-md border ${currentPage === totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ----------------- MẪU BÁO CÁO ----------------- */}
      <div 
        id="report-template" 
        ref={reportRef}
        className="fixed top-0 left-[-9999px] w-[650px] bg-white p-10 print:static print:left-0 print:w-full z-[-50]"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold uppercase mb-2 text-black">BÁO CÁO TỒN KHO</h1>
          <p className="text-sm text-gray-600 italic">{getCurrentDateTime()}</p>
        </div>

        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-left font-bold text-black">Tên sản phẩm</th>
              <th className="border border-black p-2 text-center font-bold text-black w-24">Đơn vị</th>
              <th className="border border-black p-2 text-center font-bold text-black w-16">Điểm</th>
              <th className="border border-black p-2 text-center font-bold text-black w-20">Tồn cuối</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              return (
                <tr key={p._id}>
                  <td className="border border-black p-2 text-left text-black">{p.name}</td>
                  <td className="border border-black p-2 text-center text-black">{p.unit}</td>
                  <td className="border border-black p-2 text-center text-black">{p.gift_points || 0}</td>
                  <td className="border border-black p-2 text-center text-black font-medium">{p.current_stock}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL FORM - ĐÃ THÊM ANIMATION */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm">
           <div 
             className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 transform scale-100"
             style={{ 
               animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' 
             }} 
           >
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {isEditMode ? <><Pencil size={23} className="text-black-600" /> Cập nhật sản phẩm</> : <><Plus size={23} className="text-black-600" /> Thêm sản phẩm mới</>}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="grid grid-cols-2 gap-6 mb-4">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-500 text-sm uppercase tracking-wider border-b pb-1">Thông tin chung</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Barcode size={16} /> Mã sản phẩm</label>
                      <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="VD: SP001" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium
                       text-gray-700 mb-1">Tên sản phẩm <span className="text-red-500">*</span></label>
                      <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-500 text-sm uppercase tracking-wider border-b pb-1">Giá & Chính sách</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Giá nhập</label><input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" value={formData.import_price} onChange={(e) => handlePriceChange('import_price', e.target.value)} /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Giá bán</label><input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" value={formData.export_price} onChange={(e) => handlePriceChange('export_price', e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Tag size={16} /> Chiết khấu (%)</label><input type="number" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" value={formData.discount_percent} onChange={(e) => setFormData({...formData, discount_percent: e.target.value})} /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Gift size={16} /> Điểm</label><input type="number" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" value={formData.gift_points} onChange={(e) => setFormData({...formData, gift_points: e.target.value})} /></div>
                    </div>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính</label><input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><AlertTriangle size={16} className="text-black-500" /> Ngưỡng cảnh báo</label><input type="number" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="VD: 5" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: e.target.value})} /></div>
              </div>
              <div className="flex gap-3 border-t pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">Hủy bỏ</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-colors">{isEditMode ? 'Lưu thay đổi' : 'Lưu sản phẩm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;