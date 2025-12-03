import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  ArrowDownToLine, Plus, Search, X, User, FileText, 
  Trash2, Save, Menu, Barcode, Package, DollarSign,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, FileSpreadsheet, Pencil, Eye, Loader2,
  ChevronLeft, ChevronRight, Upload, Download // <--- Thêm Upload, Download
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

const ImportPage = () => {
  const { isExpanded, setIsExpanded } = useOutletContext();
  const { globalCache, refreshFlags, updateCache, triggerRefresh } = useOutletContext();

  const [showModal, setShowModal] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false); 

  // --- STATE ANIMATION ĐÓNG ---
  const [isClosing, setIsClosing] = useState(false);

  const [suppliers, setSuppliers] = useState([]); 
  const [products, setProducts] = useState([]);   
  const [imports, setImports] = useState(globalCache.imports || []); 
  const [loading, setLoading] = useState(!globalCache.imports);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });

  // --- STATE PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  const [newImport, setNewImport] = useState({
    code: '', 
    supplier_id: '',
    note: '',
    details: [] 
  });

  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isSearchFocus, setIsSearchFocus] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchInputRef = useRef(null); 
  const listRef = useRef(null); 
  const fileInputRef = useRef(null); // <--- Ref cho input file Excel

  // --- HÀM ĐÓNG MODAL CÓ HIỆU ỨNG ---
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowModal(false);
      setIsClosing(false);
    }, 100);
  };

  // --- LOAD DATA ---
  useEffect(() => {
    const loadData = async () => {
      if (!globalCache.imports || refreshFlags.imports) {
        try {
          setLoading(true);
          const res = await axiosClient.get('/imports');
          setImports(res); 
          updateCache('imports', res);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadData();
  }, [refreshFlags.imports]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [importRes, supplierRes, productRes] = await Promise.all([
        axiosClient.get('/imports'),           
        axiosClient.get('/partners?type=supplier'), 
        axiosClient.get('/products')           
      ]);
      setImports(importRes);
      updateCache('imports', importRes);
      setSuppliers(supplierRes);
      setProducts(productRes);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig]);

  // --- LOGIC FORM & UI ---
  useEffect(() => {
    if (activeIndex !== -1 && listRef.current) {
      const listItems = listRef.current.children;
      if (listItems[activeIndex]) {
        listItems[activeIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeIndex]);

  useEffect(() => {
    if (newImport.details.length > 0) {
      const lastIndex = newImport.details.length - 1;
      const quantityInput = document.getElementById(`quantity-${lastIndex}`);
      if (quantityInput) {
        // Chỉ focus nếu không phải do import excel hàng loạt (tránh nhảy loạn xạ)
        // Tuy nhiên logic này đơn giản cứ focus dòng cuối
        // quantityInput.focus(); // Tạm tắt để tránh lỗi khi import nhiều dòng
      }
    }
  }, [newImport.details.length]);

  useEffect(() => {
    if (showModal && !isViewMode) {
      setNewImport({
        code: 'Đang tải mã...',
        supplier_id: '',
        note: '',
        details: []
      });
      setProductSearch('');
      setFilteredProducts([]);
      setActiveIndex(-1);
      setIsSubmitting(false);

      const fetchNewCode = async () => {
        try {
          const res = await axiosClient.get('/imports/new-code');
          setNewImport(prev => ({ ...prev, code: res.code }));
        } catch (error) {
          console.error("Lỗi lấy mã:", error);
        }
      };
      fetchNewCode();
    }
  }, [showModal, isViewMode]);

  // --- XỬ LÝ DỮ LIỆU & PHÂN TRANG ---
  const getProcessedImports = () => {
    let result = [...imports];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item => {
        const matchCode = item.code?.toLowerCase().includes(lowerTerm);
        const matchSupplier = item.supplier_id?.name?.toLowerCase().includes(lowerTerm);
        const matchProduct = item.details?.some(d => {
          const nameMatch = d.product_name_backup?.toLowerCase().includes(lowerTerm);
          const skuMatch = d.sku?.toLowerCase().includes(lowerTerm);
          return nameMatch || skuMatch;
        });
        return matchCode || matchSupplier || matchProduct;
      });
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'supplier') {
          aValue = a.supplier_id?.name || '';
          bValue = b.supplier_id?.name || '';
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }
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

  const processedImports = getProcessedImports();
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = processedImports.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(processedImports.length / itemsPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // --- SEARCH PRODUCT & ADD TO FORM ---
  useEffect(() => {
    if (!isSearchFocus && productSearch.trim() === '') {
      setFilteredProducts([]); 
      setActiveIndex(-1);
      return;
    }
    let results = [];
    if (isSearchFocus && productSearch.trim() === '') {
      results = products;
    } else {
      const lower = productSearch.toLowerCase();
      results = products.filter(p => 
        p.name.toLowerCase().includes(lower) || 
        (p.sku && p.sku.toLowerCase().includes(lower))
      );
    }
    setFilteredProducts(results);
    if (results.length > 0) setActiveIndex(0);
    else setActiveIndex(-1);
  }, [productSearch, products, isSearchFocus]);

  const handleKeyDown = (e) => {
    if (filteredProducts.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && filteredProducts[activeIndex]) {
        addProductToImport(filteredProducts[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocus(false);
    }
  };

  const handleQuantityKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  };

  const addProductToImport = (product) => {
    const newItem = {
      product_id: product._id,
      product_name_backup: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity: 1, 
      import_price: product.import_price || 0, 
      total: product.import_price || 0
    };
    setNewImport(prev => ({
      ...prev,
      details: [...prev.details, newItem]
    }));
    setProductSearch('');
    setFilteredProducts([]);
    setIsSearchFocus(true); 
    setActiveIndex(-1);
  };

  const updateDetail = (index, field, value) => {
    const updatedDetails = [...newImport.details];
    updatedDetails[index][field] = Number(value);
    updatedDetails[index].total = updatedDetails[index].quantity * updatedDetails[index].import_price;
    setNewImport({ ...newImport, details: updatedDetails });
  };

  const removeDetail = (index) => {
    const updatedDetails = newImport.details.filter((_, i) => i !== index);
    setNewImport({ ...newImport, details: updatedDetails });
  };

  const calculateTotalAmount = () => newImport.details.reduce((sum, item) => sum + item.total, 0);
  const calculateTotalQuantity = () => newImport.details.reduce((sum, item) => sum + item.quantity, 0);

  // --- XỬ LÝ IMPORT EXCEL (MỚI) ---
  const handleDownloadTemplate = () => {
    const templateData = [
      ['Tên sản phẩm', 'Số lượng'],
      ['Sữa Ông Thọ', 10],
      ['Bánh Mì', 5],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MauNhapKho");
    XLSX.writeFile(wb, "Mau_Nhap_Kho.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Đọc dữ liệu dạng mảng [ [col1, col2], [col1, col2] ]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const importedDetails = [];
        const notFoundProducts = [];

        // Bắt đầu duyệt từ dòng thứ 2 (index 1) vì dòng 0 là tiêu đề
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const productName = row[0] ? String(row[0]).trim() : '';
          const quantity = row[1] ? Number(row[1]) : 1;

          if (!productName) continue;

          // Tìm sản phẩm trong danh sách products đã tải
          const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());

          if (product) {
            importedDetails.push({
              product_id: product._id,
              product_name_backup: product.name,
              sku: product.sku,
              unit: product.unit,
              quantity: quantity > 0 ? quantity : 1,
              import_price: product.import_price || 0,
              total: (quantity > 0 ? quantity : 1) * (product.import_price || 0)
            });
          } else {
            notFoundProducts.push(productName);
          }
        }

        if (importedDetails.length > 0) {
          setNewImport(prev => ({
            ...prev,
            details: [...prev.details, ...importedDetails]
          }));
          toast.success(`Đã thêm ${importedDetails.length} sản phẩm từ file!`);
        }

        if (notFoundProducts.length > 0) {
          toast.warn(`Không tìm thấy ${notFoundProducts.length} sản phẩm: ${notFoundProducts.slice(0, 3).join(', ')}...`);
        }

      } catch (error) {
        console.error(error);
        toast.error('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng.');
      } finally {
        // Reset input file để chọn lại cùng file nếu muốn
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- API ACTIONS ---
  const handleSaveImport = async () => {
    if (!newImport.supplier_id) return toast.warning('Chọn Nhà cung cấp');
    if (newImport.details.length === 0) return toast.warning('Chưa có sản phẩm');
    if (isSubmitting) return; 

    try {
      setIsSubmitting(true);
      const payload = {
        ...newImport,
        total_amount: calculateTotalAmount(),
        total_quantity: calculateTotalQuantity()
      };
      await axiosClient.post('/imports', payload);
      toast.success('Nhập kho thành công! 🎉');
      triggerRefresh(['exports', 'products', 'debts', 'dashboard', 'partners']);
      handleCloseModal();
      fetchData(); 
    } catch (error) {
      toast.error('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteImport = async (e, id, code) => {
    e.stopPropagation();
    if (window.confirm(`CẢNH BÁO: Xóa phiếu ${code} sẽ TRỪ NGƯỢC lại tồn kho và công nợ.\nBạn có chắc chắn không?`)) {
      try {
        await axiosClient.delete(`/imports/${id}`);
        toast.success('Đã xóa phiếu nhập');
        fetchData();
      } catch (error) {
        toast.error('Lỗi xóa: ' + error.message);
      }
    }
  };

  const handleRowClick = (item) => {
    setNewImport({
      _id: item._id,
      code: item.code,
      supplier_id: item.supplier_id?._id || '',
      note: item.note || '',
      details: item.details || []
    });
    setIsViewMode(true);
    setShowModal(true);
  };

  const handleExportSingleExcel = (e, item) => {
    e.stopPropagation();
    const dataToExport = item.details.map((d, index) => ({
      'STT': index + 1,
      'Mã SP': d.sku,
      'Tên sản phẩm': d.product_name_backup,
      'Đơn vị': d.unit,
      'Số lượng': d.quantity,
      'Giá nhập': d.import_price,
      'Thành tiền': d.total
    }));
    dataToExport.push({
      'STT': '', 'Mã SP': '', 'Tên sản phẩm': 'TỔNG CỘNG', 'Đơn vị': '',
      'Số lượng': item.total_quantity,
      'Giá nhập': '',
      'Thành tiền': item.total_amount
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ChiTiet");
    XLSX.writeFile(wb, `Phieu_Nhap_${item.code}.xlsx`);
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

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3 self-start md:self-center">
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100 text-black-600 transition-colors">
                <Menu size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap">Nhập kho</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="Tìm mã phiếu, NCC, tên hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>

          <button 
            onClick={() => { setIsViewMode(false); setShowModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors"
          >
            <Plus size={20} /> <span className="hidden sm:inline">Tạo phiếu nhập</span>
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
              <tr>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('code')}>
                  <div className="flex items-center">Mã phiếu {renderSortIcon('code')}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center">Ngày nhập {renderSortIcon('date')}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('supplier')}>
                  <div className="flex items-center">Nhà cung cấp {renderSortIcon('supplier')}</div>
                </th>
                <th className="p-4 text-right cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('total_amount')}>
                  <div className="flex items-center justify-end">Tổng tiền {renderSortIcon('total_amount')}</div>
                </th>
                <th className="p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('total_quantity')}>
                  <div className="flex items-center justify-center">Tổng SL {renderSortIcon('total_quantity')}</div>
                </th>
                <th className="p-4">Ghi chú</th>
                <th className="p-4 text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {currentItems.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">{loading ? 'Đang tải...' : 'Chưa có phiếu nhập nào.'}</td></tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-100 transition-colors cursor-pointer group" onClick={() => handleRowClick(item)}>
                    <td className="p-4 font-bold text-blue-600 text-sm font-mono">{item.code}</td>
                    <td className="p-4 text-gray-800">{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                    <td className="p-4 font-medium text-gray-800">{item.supplier_id?.name || <span className="text-red-400 italic">NCC đã xóa</span>}</td>
                    <td className="p-4 text-right font-bold text-gray-800">{item.total_amount?.toLocaleString()}₫</td>
                    <td className="p-4 text-center"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{item.total_quantity}</span></td>
                    <td className="p-4 text-gray-500 text-sm italic">{item.note || '-'}</td>
                    
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button onClick={(e) => handleExportSingleExcel(e, item)} className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-all" title="Xuất Excel">
                        <FileSpreadsheet size={18} />
                      </button>
                      <button onClick={(e) => handleDeleteImport(e, item._id, item.code)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" title="Xóa phiếu">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- THANH PHÂN TRANG UI --- */}
        {processedImports.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">
                Hiển thị {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, processedImports.length)} trong số {processedImports.length} phiếu
              </div>
              
              <div className="flex items-center gap-2">
                <select 
                  className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
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

                <button 
                  onClick={() => paginate(currentPage - 1)} 
                  disabled={currentPage === 1}
                  className={`p-1 rounded-md border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  <ChevronLeft size={20} />
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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

      {/* --- MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col transform scale-100"
            style={{ 
               animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' 
            }}
          >
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {isViewMode ? <><Eye size={24} className="text-blue-600" /> Chi tiết phiếu nhập</> : <><Plus size={24} className="text-blue-600" /> Tạo phiếu nhập kho mới</>}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-5 grid grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Barcode size={16} /> Mã phiếu</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-100 text-gray-500 font-mono font-bold focus:ring-0 outline-none cursor-not-allowed" value={newImport.code} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><User size={16} /> Nhà cung cấp <span className="text-red-500">*</span></label>
                  <select className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-800" value={newImport.supplier_id} onChange={(e) => setNewImport({...newImport, supplier_id: e.target.value})} disabled={isViewMode}>
                    <option value="">-- Chọn nhà cung cấp --</option>
                    {suppliers.map(s => (<option key={s._id} value={s._id}>{s.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><FileText size={16} /> Ghi chú</label>
                  <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-gray-800" placeholder="VD: Nhập hàng đợt 1..." value={newImport.note} onChange={(e) => setNewImport({...newImport, note: e.target.value})} disabled={isViewMode} />
                </div>
              </div>

              {!isViewMode && (
                <div className="sticky top-0 z-20 bg-gray-50 pt-2 pb-4 mb-2 shadow-sm border-b border-gray-200">
                  <div className="flex flex-col gap-3">
                    {/* HÀNG 1: SEARCH & NÚT NHẬP EXCEL */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Search size={18} className="text-blue-600" /><label className="font-bold text-gray-800 text-sm uppercase">Thêm sản phẩm vào phiếu</label></div>
                        <div className="flex gap-2">
                            <button onClick={handleDownloadTemplate} className="text-xs bg-gray-100 text-gray-700 px-2 py-1.5 rounded flex items-center gap-1 hover:bg-gray-200"><Download size={14}/> Tải file mẫu</button>
                            <label className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1.5 rounded flex items-center gap-1 hover:bg-green-100 cursor-pointer">
                                <Upload size={14}/> Nhập từ Excel
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    className="hidden" 
                                    onChange={handleImportExcel}
                                />
                            </label>
                        </div>
                    </div>

                    {/* HÀNG 2: INPUT SEARCH */}
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        className="w-full border border-blue-300 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                        placeholder="Gõ tên hoặc mã sản phẩm để tìm..." 
                        value={productSearch} 
                        onChange={(e) => setProductSearch(e.target.value)} 
                        onFocus={() => setIsSearchFocus(true)} 
                        onBlur={() => setTimeout(() => setIsSearchFocus(false), 200)}
                        onKeyDown={handleKeyDown} 
                    />
                  </div>
                  
                  {filteredProducts.length > 0 && (productSearch || isSearchFocus) && (
                    <div 
                      ref={listRef}
                      className="absolute top-full left-0 right-0 bg-white shadow-xl border rounded-lg mt-1 z-10 max-h-60 overflow-y-auto"
                    >
                      {filteredProducts.map((p, index) => (
                        <div 
                          key={p._id} 
                          className={`p-3 cursor-pointer border-b flex justify-between items-center transition-colors ${
                            index === activeIndex ? 'bg-blue-100 border-l-4 border-l-blue-600' : 'hover:bg-blue-50'
                          }`}
                          onClick={() => addProductToImport(p)}
                        >
                          <div>
                            <div className="font-bold text-gray-800">{p.name}</div>
                            <div className="text-xs text-gray-500 flex gap-2 mt-1">
                              <span className="bg-gray-100 px-1 rounded border">Mã: {p.sku || '---'}</span>
                              <span className="bg-purple-50 text-purple-700 px-1 rounded border border-purple-200">Điểm: {p.gift_points || 0}</span>
                            </div>
                          </div>
                          <div className="text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100">Tồn: {p.current_stock}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-3">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 text-gray-700 text-sm uppercase font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">Tên sản phẩm</th>
                      <th className="p-3 w-24">Đơn vị</th>
                      <th className="p-3 w-32 text-right">Số lượng</th>
                      <th className="p-3 w-40 text-right">Giá nhập</th>
                      <th className="p-3 w-40 text-right">Thành tiền</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {newImport.details.length === 0 ? (
                      <tr><td colSpan="7" className="p-10 text-center text-gray-400 italic">Chưa có sản phẩm nào.</td></tr>
                    ) : (
                      newImport.details.map((item, index) => (
                        <tr key={index} className="hover:bg-blue-50 transition-colors">
                          <td className="p-3 text-center text-gray-500">{index + 1}</td>
                          <td className="p-3 font-medium text-gray-800">{item.product_name_backup}<div className="text-xs text-gray-400 font-mono mt-0.5">{item.sku}</div></td>
                          <td className="p-3 text-gray-600">{item.unit}</td>
                          <td className="p-3 text-right">
                            <input 
                               id={`quantity-${index}`} 
                               onKeyDown={handleQuantityKeyDown} 
                               type="number" min="1" className="w-20 border border-gray-300 rounded p-1.5 text-right focus:ring-1 focus:ring-blue-500 outline-none font-bold text-gray-800" value={item.quantity} onChange={(e) => updateDetail(index, 'quantity', e.target.value)} disabled={isViewMode} />
                          </td>
                          <td className="p-3 text-right">
                            <input type="number" className="w-32 border border-gray-300 rounded p-1.5 text-right focus:ring-1 focus:ring-blue-500 outline-none" value={item.import_price} onChange={(e) => updateDetail(index, 'import_price', e.target.value)} disabled={isViewMode} />
                          </td>
                          <td className="p-3 text-right font-bold text-blue-600">{item.total.toLocaleString()}₫</td>
                          <td className="p-3 text-center">
                            {!isViewMode && (
                              <button onClick={() => removeDetail(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={18} /></button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 border-t bg-white flex justify-between items-center rounded-b-xl">
              <div className="flex gap-6">
                <div className="text-gray-600 font-medium flex items-center gap-2"><DollarSign className="text-blue-600" /> Tổng tiền: <span className="text-2xl font-bold text-red-600 ml-1">{calculateTotalAmount().toLocaleString()}₫</span></div>
                <div className="text-gray-600 font-medium flex items-center gap-2 border-l pl-6"><Package className="text-blue-600" /> Tổng SL: <span className="text-2xl font-bold text-blue-600 ml-1">{calculateTotalQuantity()}</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleCloseModal} className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">Đóng</button>
                {!isViewMode && (
                  <button onClick={handleSaveImport} disabled={isSubmitting} className={`px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 shadow-lg transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} {isSubmitting ? 'Đang lưu...' : 'Lưu phiếu'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPage;