import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import _ from 'lodash';
import { 
  ArrowDownToLine, Plus, Search, X, User, FileText, 
  Trash2, Save, Menu, Barcode, Package, DollarSign,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, FileSpreadsheet, Pencil, Eye, Loader2,
  ChevronLeft, ChevronRight, Upload, Download, RefreshCw
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import Select from 'react-select';
import { v4 as uuidv4 } from 'uuid';

const ImportPage = () => {
  const { isExpanded, setIsExpanded } = useOutletContext();
  const { globalCache, refreshFlags, updateCache, triggerRefresh } = useOutletContext();

  const INITIAL_IMPORT_STATE = { code: '', supplier_id: '', note: '', details: [] };

  const [showModal, setShowModal] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isClosing, setIsClosing] = useState(false);

  const [partners, setPartners] = useState([]);
  const [suppliers, setSuppliers] = useState([]); 
  const [products, setProducts] = useState([]);   
  const [imports, setImports] = useState(globalCache.imports || []); 
  const [loading, setLoading] = useState(!globalCache.imports);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  // --- BỌC AN TOÀN CHO TẤT CẢ CÁC MẢNG (CHỐNG CRASH _.map) ---
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : (suppliers?.data || []);
  const safeProducts = Array.isArray(products) ? products : (products?.data || []);
  const safeImports = Array.isArray(imports) ? imports : (imports?.data || []);

  const [newImport, setNewImport] = useState(INITIAL_IMPORT_STATE);
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isSearchFocus, setIsSearchFocus] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [idempotencyKey, setIdempotencyKey] = useState(uuidv4());

  useEffect(() => { if (showModal && !isViewMode) { setIdempotencyKey(uuidv4()); } }, [showModal, isViewMode]);

  const searchInputRef = useRef(null); const listRef = useRef(null); const fileInputRef = useRef(null); 

  const formatCurrency = (amount) => { if (amount === undefined || amount === null) return '0'; return Number(amount).toLocaleString('vi-VN', { maximumFractionDigits: 0 }); };

  const handleCloseModal = () => { setIsClosing(true); setTimeout(() => { setShowModal(false); setIsClosing(false); }, 100); };

  useEffect(() => {
    const loadData = async () => { if (!globalCache.imports || refreshFlags.imports) { try { setLoading(true); const res = await axiosClient.get('/imports'); setImports(res?.data || res || []); updateCache('imports', res); } catch (error) { console.error(error); } finally { setLoading(false); } } };
    loadData();
  }, [refreshFlags.imports]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [importRes, supplierRes, productRes] = await Promise.all([ axiosClient.get('/imports'), axiosClient.get('/partners?type=supplier'), axiosClient.get('/products') ]);
      setImports(importRes?.data || importRes || []); updateCache('imports', importRes);
      setSuppliers(supplierRes?.data || supplierRes || []);
      setProducts(productRes?.data || productRes || []);
    } catch (error) { toast.error('Lỗi tải dữ liệu'); } finally { setLoading(false); }
  };

  const supplierOptions = safeSuppliers.map(s => ({ value: s._id, label: s.name }));

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortConfig]);

  useEffect(() => { if (activeIndex !== -1 && listRef.current) { const listItems = listRef.current.children; if (listItems[activeIndex]) { listItems[activeIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } } }, [activeIndex]);

  useEffect(() => { if (newImport.details.length > 0) { const lastIndex = newImport.details.length - 1; const quantityInput = document.getElementById(`quantity-${lastIndex}`); if (quantityInput) { quantityInput.focus(); quantityInput.select(); } } }, [newImport.details.length]);

  const DRAFT_KEY = 'import_draft_data';

  useEffect(() => { if (showModal && !isViewMode) { if (newImport.details.length > 0) { localStorage.setItem(DRAFT_KEY, JSON.stringify({ details: newImport.details })); } } }, [newImport.details, showModal, isViewMode]);

  useEffect(() => {
    if (showModal && !isViewMode) {
      setNewImport(prev => ({ ...INITIAL_IMPORT_STATE, code: 'Đang tải...' })); setProductSearch(''); setFilteredProducts([]); setIsSubmitting(false);
      const initForm = async () => {
         try {
             const res = await axiosClient.get('/imports/new-code');
             let nextState = { ...INITIAL_IMPORT_STATE, code: res.code };
             const savedDraft = localStorage.getItem(DRAFT_KEY);
             if (savedDraft) { try { const parsedDraft = JSON.parse(savedDraft); if (parsedDraft.details && parsedDraft.details.length > 0) { nextState.details = parsedDraft.details; toast.info('Đã khôi phục danh sách sản phẩm nháp', { autoClose: 2000 }); } } catch (e) { localStorage.removeItem(DRAFT_KEY); } }
             setNewImport(nextState);
         } catch (error) { console.error(error); }
      };
      initForm();
    }
  }, [showModal, isViewMode]);

  const handleResetForm = () => {
    if (window.confirm('Xóa hết dữ liệu đang nhập để tạo phiếu mới?')) {
        localStorage.removeItem(DRAFT_KEY); setIdempotencyKey(uuidv4()); setNewImport(prev => ({ ...INITIAL_IMPORT_STATE, code: 'Đang tải...' }));
        const fetchNewCode = async () => { try { const res = await axiosClient.get('/imports/new-code'); setNewImport(prev => ({ ...prev, code: res.code })); } catch (error) { console.error(error); } };
        fetchNewCode(); toast.info('Đã làm mới form');
    }
  };

  const getProcessedImports = () => {
    let result = [...safeImports];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item => {
        const matchCode = item.code?.toLowerCase().includes(lowerTerm); const matchSupplier = item.supplier_id?.name?.toLowerCase().includes(lowerTerm);
        const matchProduct = item.details?.some(d => { const nameMatch = d.product_name_backup?.toLowerCase().includes(lowerTerm); const skuMatch = d.sku?.toLowerCase().includes(lowerTerm); return nameMatch || skuMatch; });
        return matchCode || matchSupplier || matchProduct;
      });
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'supplier') { aValue = a.supplier_id?.name || ''; bValue = b.supplier_id?.name || ''; } else { aValue = a[sortConfig.key]; bValue = b[sortConfig.key]; }
        if (aValue === undefined || aValue === null) aValue = ''; if (bValue === undefined || bValue === null) bValue = '';
        if (typeof aValue === 'string') { return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue); }
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }
    return result;
  };

  const handleSort = (key) => { let direction = 'asc'; if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const renderSortIcon = (key) => { if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 ml-1" />; return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-1" /> : <ArrowDown size={14} className="text-blue-600 ml-1" />; };

  const processedImports = getProcessedImports();
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = processedImports.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(processedImports.length / itemsPerPage);

  const paginate = (pageNumber) => { if (pageNumber > 0 && pageNumber <= totalPages) setCurrentPage(pageNumber); };

  useEffect(() => {
    if (!isSearchFocus && productSearch.trim() === '') { setFilteredProducts([]); setActiveIndex(-1); return; }
    let results = [];
    if (isSearchFocus && productSearch.trim() === '') { results = safeProducts; } else {
      const searchKeywords = productSearch.toLowerCase().split(/\s+/).filter(word => word.length > 0);
      results = safeProducts.filter(p => {
        const productName = p.name.toLowerCase(); const productSku = (p.sku || '').toLowerCase();
        return searchKeywords.every(keyword => productName.includes(keyword) || productSku.includes(keyword));
      });
    }
    setFilteredProducts(results); if (results.length > 0) setActiveIndex(0); else setActiveIndex(-1);
  }, [productSearch, products, isSearchFocus]);

  const handleKeyDown = (e) => {
    if (filteredProducts.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'Tab') { e.preventDefault(); setActiveIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev)); } 
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => (prev > 0 ? prev - 1 : 0)); } 
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0 && filteredProducts[activeIndex]) { addProductToImport(filteredProducts[activeIndex]); } else if (filteredProducts.length > 0) { addProductToImport(filteredProducts[0]); } } 
    else if (e.key === 'Escape') { setIsSearchFocus(false); }
  };

  const handleQuantityKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); if (searchInputRef.current) { searchInputRef.current.focus(); } } };

  const addProductToImport = (product) => {
    const finalPrice = Math.round(product.import_price || 0); 
    const newItem = { product_id: product._id, product_name_backup: product.name, sku: product.sku, unit: product.unit, quantity: 1, import_price: finalPrice, total: Math.round(finalPrice) };
    setNewImport(prev => ({ ...prev, details: [...prev.details, newItem] }));
    setProductSearch(''); setFilteredProducts([]); setIsSearchFocus(true); setActiveIndex(-1);
  };
  
  const preventNumberInputScroll = (e) => { if (e.type === 'wheel') e.target.blur(); };

  const updateDetail = (index, field, value) => {
    const updatedDetails = [...newImport.details];
    const val = value === '' ? '' : Number(value); updatedDetails[index][field] = val;
    const qty = field === 'quantity' ? (val === '' ? 0 : val) : (updatedDetails[index].quantity === '' ? 0 : updatedDetails[index].quantity);
    const price = field === 'import_price' ? (val === '' ? 0 : val) : (updatedDetails[index].import_price === '' ? 0 : updatedDetails[index].import_price);
    updatedDetails[index].total = Math.round(qty * price);
    setNewImport({ ...newImport, details: updatedDetails });
  };

  const handleBlur = (index, field) => {
    const detailItem = newImport.details[index];
    if (detailItem[field] === '') {
        const updatedDetails = [...newImport.details]; updatedDetails[index][field] = 0;
        const qty = updatedDetails[index].quantity; const price = updatedDetails[index].import_price;
        updatedDetails[index].total = Math.round(qty * price); setNewImport({ ...newImport, details: updatedDetails });
    }
    if (field === 'import_price' && typeof detailItem[field] === 'number') {
         const updatedDetails = [...newImport.details]; updatedDetails[index][field] = Math.round(detailItem[field]);
         const qty = updatedDetails[index].quantity; const price = updatedDetails[index][field];
         updatedDetails[index].total = Math.round(qty * price); setNewImport({ ...newImport, details: updatedDetails });
    }
  };

  const removeDetail = (index) => { const updatedDetails = newImport.details.filter((_, i) => i !== index); setNewImport({ ...newImport, details: updatedDetails }); };
  const calculateTotalAmount = () => Math.round(newImport.details.reduce((sum, item) => sum + item.total, 0));
  const calculateTotalQuantity = () => newImport.details.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const handleDownloadTemplate = () => { const templateData = [ ['Tên sản phẩm', 'Số lượng'], ['Sữa Ông Thọ', 10], ['Bánh Mì', 5] ]; const ws = XLSX.utils.aoa_to_sheet(templateData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "MauNhapKho"); XLSX.writeFile(wb, "Mau_Nhap_Kho.xlsx"); };

  const handleImportExcel = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result; const wb = XLSX.read(bstr, { type: 'binary' }); const wsname = wb.SheetNames[0]; const ws = wb.Sheets[wsname]; const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const importedDetails = []; const notFoundProducts = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i]; if (!row || row.length === 0) continue;
          const productName = row[0] ? String(row[0]).trim() : ''; const quantity = row[1] ? Number(row[1]) : 1;
          if (!productName) continue;
          const product = safeProducts.find(p => p.name.toLowerCase() === productName.toLowerCase());
          if (product) {
            const finalPrice = Math.round(product.import_price || 0);
            importedDetails.push({ product_id: product._id, product_name_backup: product.name, sku: product.sku, unit: product.unit, quantity: quantity > 0 ? quantity : 1, import_price: finalPrice, total: Math.round((quantity > 0 ? quantity : 1) * finalPrice) });
          } else { notFoundProducts.push(productName); }
        }
        if (importedDetails.length > 0) { setNewImport(prev => ({ ...prev, details: [...prev.details, ...importedDetails] })); toast.success(`Đã thêm ${importedDetails.length} sản phẩm từ file!`); }
        if (notFoundProducts.length > 0) { toast.warn(`Không tìm thấy ${notFoundProducts.length} sản phẩm: ${notFoundProducts.slice(0, 3).join(', ')}...`); }
      } catch (error) { toast.error('Lỗi đọc file Excel.'); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveImport = async () => {
    if (!newImport.supplier_id) return toast.warning('Chọn Nhà cung cấp');
    if (newImport.details.length === 0) return toast.warning('Chưa có sản phẩm');
    if (isSubmitting) return; 
    try {
      setIsSubmitting(true);
      const payload = { ...newImport, total_amount: calculateTotalAmount(), total_quantity: calculateTotalQuantity(), idempotency_key: idempotencyKey };
      await axiosClient.post('/imports', payload);
      localStorage.removeItem(DRAFT_KEY);
      toast.success('Nhập kho thành công! 🎉'); triggerRefresh(['exports', 'products', 'debts', 'dashboard', 'partners']); setNewImport(INITIAL_IMPORT_STATE);
      setIdempotencyKey(uuidv4()); handleCloseModal(); fetchData();
    } catch (error) { toast.error('Lỗi: ' + (error.response?.data?.message || error.message)); } finally { setIsSubmitting(false); }
  };

  const handleDeleteImport = async (e, id, code) => {
    e.stopPropagation();
    if (window.confirm(`CẢNH BÁO: Xóa phiếu ${code} sẽ TRỪ NGƯỢC lại tồn kho và công nợ.\nBạn có chắc chắn không?`)) {
      try { await axiosClient.delete(`/imports/${id}`); toast.success('Đã xóa phiếu nhập'); triggerRefresh(['exports', 'products', 'debts', 'dashboard', 'partners']); fetchData(); } catch (error) { toast.error('Lỗi xóa: ' + error.message); }
    }
  };

  const handleRowClick = (item) => { setNewImport({ _id: item._id, code: item.code, supplier_id: item.supplier_id?._id || '', note: item.note || '', details: item.details || [] }); setIsViewMode(true); setShowModal(true); };

  const handleExportSingleExcel = (e, item) => {
    e.stopPropagation();
    const dataToExport = item.details.map((d, index) => ({ 'STT': index + 1, 'Mã SP': d.sku, 'Tên sản phẩm': d.product_name_backup, 'Đơn vị': d.unit, 'Số lượng': d.quantity, 'Giá nhập': d.import_price, 'Thành tiền': d.total }));
    dataToExport.push({ 'STT': '', 'Mã SP': '', 'Tên sản phẩm': 'TỔNG CỘNG', 'Đơn vị': '', 'Số lượng': item.total_quantity, 'Giá nhập': '', 'Thành tiền': item.total_amount });
    const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "ChiTiet"); XLSX.writeFile(wb, `Phieu_Nhap_${item.code}.xlsx`);
  };

  return (
    <div className="p-2 pb-10">
      <style>{`@keyframes fadeIn {from { opacity: 0; transform: scale(0.95); }to { opacity: 1; transform: scale(1); }}@keyframes fadeOut {from { opacity: 1; transform: scale(1); }to { opacity: 0; transform: scale(0.95); }}`}</style>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3 self-start md:self-center"><button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100 text-black-600 transition-colors"><Menu size={24} /></button><h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap">Nhập kho</h1></div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Tìm mã phiếu, NCC, tên hàng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <button onClick={() => { setIsViewMode(false); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors"><Plus size={20} /> <span className="hidden sm:inline">Tạo phiếu nhập</span></button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
              <tr>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('code')}><div className="flex items-center">Mã phiếu {renderSortIcon('code')}</div></th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('date')}><div className="flex items-center">Ngày nhập {renderSortIcon('date')}</div></th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('supplier')}><div className="flex items-center">Nhà cung cấp {renderSortIcon('supplier')}</div></th>
                <th className="p-4 text-right cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('total_amount')}><div className="flex items-center justify-end">Tổng tiền {renderSortIcon('total_amount')}</div></th>
                <th className="p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('total_quantity')}><div className="flex items-center justify-center">Tổng SL {renderSortIcon('total_quantity')}</div></th>
                <th className="p-4">Ghi chú</th>
                <th className="p-4 text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {currentItems.length === 0 ? ( <tr><td colSpan="7" className="p-8 text-center text-gray-500">{loading ? 'Đang tải...' : 'Chưa có phiếu nhập nào.'}</td></tr> ) : (
                currentItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-100 transition-colors cursor-pointer group" onClick={() => handleRowClick(item)}>
                    <td className="p-4 font-bold text-blue-600 text-sm font-mono">{item.code}</td>
                    <td className="p-4 text-gray-800">{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                    <td className="p-4 font-medium text-gray-800">{item.supplier_id?.name || <span className="text-red-400 italic">NCC đã xóa</span>}</td>
                    <td className="p-4 text-right font-bold text-gray-800">{formatCurrency(item.total_amount)}₫</td>
                    <td className="p-4 text-center"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{item.total_quantity}</span></td>
                    <td className="p-4 text-gray-500 text-sm italic">{item.note || '-'}</td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button onClick={(e) => handleExportSingleExcel(e, item)} className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-all" title="Xuất Excel"><FileSpreadsheet size={18} /></button>
                      <button onClick={(e) => handleDeleteImport(e, item._id, item.code)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" title="Xóa phiếu"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {processedImports.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">Hiển thị {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, processedImports.length)} trong số {processedImports.length} phiếu</div>
              <div className="flex items-center gap-2">
                <select className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value="10">10 dòng</option><option value="20">20 dòng</option><option value="50">50 dòng</option><option value="100">100 dòng</option>
                </select>
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className={`p-1 rounded-md border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}><ChevronLeft size={20} /></button>
                <div className="flex gap-1">{Array.from({ length: Math.min(5, totalPages) }, (_, i) => { let pageNum = i + 1; if (totalPages > 5) { if (currentPage > 3) pageNum = currentPage - 2 + i; if (pageNum > totalPages) pageNum = totalPages - 4 + i; } return (<button key={pageNum} onClick={() => paginate(pageNum)} className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${ currentPage === pageNum ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50' }`}>{pageNum}</button>) })}</div>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className={`p-1 rounded-md border ${currentPage === totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}><ChevronRight size={20} /></button>
              </div>
            </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col transform scale-100" style={{ animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' }}>
            <div className="flex justify-between items-center p-5 border-b">
              <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">{isViewMode ? <><Eye size={24} className="text-blue-600" /> Chi tiết phiếu nhập</> : <><Plus size={24} className="text-blue-600" /> Tạo phiếu nhập kho</>}</h2>
                  {!isViewMode && (
                    <button type="button" onClick={handleResetForm} className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-colors border border-gray-200 whitespace-nowrap" title="Xóa trắng form để nhập mới"><RefreshCw size={14} /> Làm mới</button>
                  )}
              </div>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-5 grid grid-cols-3 gap-5">
                <div><label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Barcode size={16} /> Mã phiếu</label><input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-100 text-gray-500 font-mono font-bold focus:ring-0 outline-none cursor-not-allowed" value={newImport.code} readOnly /></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><User size={16} /> Nhà cung cấp <span className="text-red-500">*</span></label>
                  <Select options={supplierOptions} value={supplierOptions.find(s => s.value === newImport.supplier_id) || null} onChange={(selected) => setNewImport({...newImport, supplier_id: selected ? selected.value : ''})} isDisabled={isViewMode} placeholder="-- Nhập tên --" isClearable isSearchable noOptionsMessage={() => "Không tìm thấy"} styles={{ control: (base) => ({ ...base, borderRadius: '0.5rem', borderColor: '#d1d5db', minHeight: '42px', fontSize: '14px' }), menu: (base) => ({ ...base, zIndex: 9999 }) }} />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><FileText size={16} /> Ghi chú</label><input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-gray-800" placeholder="VD: Nhập hàng đợt 1..." value={newImport.note} onChange={(e) => setNewImport({...newImport, note: e.target.value})} disabled={isViewMode} /></div>
              </div>

              {!isViewMode && (
                <div className="sticky top-0 z-20 bg-gray-50 pt-2 pb-4 mb-2 shadow-sm border-b border-gray-200">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Search size={18} className="text-blue-600" /><label className="font-bold text-gray-800 text-sm uppercase">Thêm sản phẩm vào phiếu</label></div>
                        <div className="flex gap-2">
                            <button onClick={handleDownloadTemplate} className="text-xs bg-gray-100 text-gray-700 px-2 py-1.5 rounded flex items-center gap-1 hover:bg-gray-200"><Download size={14}/> Tải file mẫu</button>
                            <label className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1.5 rounded flex items-center gap-1 hover:bg-green-100 cursor-pointer">
                                <Upload size={14}/> Nhập từ Excel <input ref={fileInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                            </label>
                        </div>
                    </div>
                    <input ref={searchInputRef} type="text" className="w-full border border-blue-300 rounded-lg p-3 shadow-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="Gõ tên hoặc mã sản phẩm để tìm..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} onFocus={() => setIsSearchFocus(true)} onBlur={() => setTimeout(() => setIsSearchFocus(false), 200)} onKeyDown={handleKeyDown} />
                  </div>
                  
                  {filteredProducts.length > 0 && (productSearch || isSearchFocus) && (
                    <div ref={listRef} className="absolute top-full left-0 right-0 bg-white shadow-xl border rounded-lg mt-1 z-10 max-h-60 overflow-y-auto">
                      {filteredProducts.map((p, index) => (
                        <div key={p._id} className={`p-3 cursor-pointer border-b flex justify-between items-center transition-colors ${index === activeIndex ? 'bg-blue-100 border-l-4 border-l-blue-600' : 'hover:bg-blue-50'}`} onClick={() => addProductToImport(p)}>
                          <div><div className="font-bold text-gray-800">{p.name}</div><div className="text-xs text-gray-500 flex gap-2 mt-1"><span className="bg-gray-100 px-1 rounded border">Mã: {p.sku || '---'}</span><span className="bg-purple-50 text-purple-700 px-1 rounded border border-purple-200">Điểm: {p.gift_points || 0}</span></div></div>
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
                    <tr><th className="p-3 w-10 text-center">#</th><th className="p-3">Tên sản phẩm</th><th className="p-3 w-24">Đơn vị</th><th className="p-3 w-32 text-right">Số lượng</th><th className="p-3 w-40 text-right">Giá nhập</th><th className="p-3 w-40 text-right">Thành tiền</th><th className="p-3 w-10"></th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {newImport.details.length === 0 ? ( <tr><td colSpan="7" className="p-10 text-center text-gray-400 italic">Chưa có sản phẩm nào.</td></tr> ) : (
                      newImport.details.map((item, index) => (
                        <tr key={index} className="hover:bg-blue-50 transition-colors">
                          <td className="p-3 text-center text-gray-500">{index + 1}</td>
                          <td className="p-3 font-medium text-gray-800">{item.product_name_backup}<div className="text-xs text-gray-400 font-mono mt-0.5">{item.sku}</div></td>
                          <td className="p-3 text-gray-600">{item.unit}</td>
                          <td className="p-3 text-right">
                            <input id={`quantity-${index}`} onKeyDown={handleQuantityKeyDown} onFocus={(e) => e.target.select()} onBlur={() => handleBlur(index, 'quantity')} type="number" min="0" className="w-20 border border-gray-300 rounded p-1.5 text-right focus:ring-1 focus:ring-blue-500 outline-none font-bold text-gray-800" value={item.quantity} onChange={(e) => updateDetail(index, 'quantity', e.target.value)} onWheel={preventNumberInputScroll} disabled={isViewMode} />
                          </td>
                          <td className="p-3 text-right">
                            <input type="text" onFocus={(e) => e.target.select()} onBlur={() => handleBlur(index, 'import_price')} className="w-32 border border-gray-300 rounded p-1.5 text-right focus:ring-1 focus:ring-blue-500 outline-none" value={item.import_price ? Number(item.import_price).toLocaleString('vi-VN') : ''} onChange={(e) => { const rawValue = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(rawValue)) { updateDetail(index, 'import_price', rawValue); } }} disabled={isViewMode} />
                          </td>
                          <td className="p-3 text-right font-bold text-blue-600">{formatCurrency(item.total)}₫</td>
                          <td className="p-3 text-center">
                            {!isViewMode && ( <button onClick={() => removeDetail(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={18} /></button> )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 border-t bg-white flex justify-end items-center rounded-b-xl gap-6">
              <div className="text-gray-600 font-medium flex items-center gap-2"><Package className="text-blue-600" /> Tổng SL: <span className="text-2xl font-bold text-blue-600 ml-1">{calculateTotalQuantity()}</span></div>
              <div className="text-gray-600 font-medium flex items-center gap-2 border-l pl-6"><DollarSign className="text-blue-600" /> Tổng tiền: <span className="text-2xl font-bold text-red-600 ml-1">{formatCurrency(calculateTotalAmount())}₫</span></div>
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