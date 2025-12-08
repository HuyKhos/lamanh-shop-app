import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  Plus, Search, X, User, FileText, 
  Trash2, Save, Menu, Barcode, Package, DollarSign,
  Eye, Printer, FileSpreadsheet, ChevronDown, Gift,
  AlertTriangle, RefreshCw, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon,
  ChevronLeft, ChevronRight, Upload, Download // <--- Thêm Upload, Download
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas'; 
import Select from 'react-select';

const ExportPage = () => {
  const { isExpanded, setIsExpanded, triggerRefreshDashboard } = useOutletContext();
  const { globalCache, refreshFlags, updateCache, triggerRefresh } = useOutletContext();
  const searchInputRef = useRef(null); 
  const listRef = useRef(null);
  const fileInputRef = useRef(null); // <--- Ref cho input file Excel

  const [showModal, setShowModal] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [customers, setCustomers] = useState([]); 
  const [products, setProducts] = useState([]);    
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });
  const [exports, setExports] = useState(globalCache.exports || []); 
  const [loading, setLoading] = useState(!globalCache.exports); 
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  // --- TRẠNG THÁI MẶC ĐỊNH ---
  const INITIAL_EXPORT_STATE = {
    code: '', 
    customer_id: '',
    note: '',
    payment_due_date: '',
    hide_price: false,
    apply_wholesale: false,
    details: [] 
  };

  const [newExport, setNewExport] = useState(INITIAL_EXPORT_STATE);

  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isSearchFocus, setIsSearchFocus] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Utils
  const formatCurrency = (amount) => amount?.toLocaleString('vi-VN');
  const formatNumber = (num) => num?.toLocaleString('vi-VN');
  const formatDate = (dateString) => { if (!dateString) return ''; const date = new Date(dateString); if (isNaN(date.getTime())) return ''; return `Ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`; };
  const toInputDate = (isoStr) => { if (!isoStr) return ''; const date = new Date(isoStr); if (isNaN(date.getTime())) return ''; return date.toISOString().split('T')[0]; };
  const formatDisplayDate = (isoDateStr) => { if (!isoDateStr) return ''; if (isoDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) { const [year, month, day] = isoDateStr.split('-'); return `${day}/${month}/${year}`; } return isoDateStr; };

  const handleCloseModal = () => { setIsClosing(true); setTimeout(() => { setShowModal(false); setIsClosing(false); }, 100); };

  // --- API: LẤY MÃ MỚI ---
  const fetchNewCode = async () => {
    try {
      const res = await axiosClient.get('/exports/new-code');
      setNewExport(prev => ({ ...prev, code: res.code }));
    } catch (error) { console.error(error); }
  };

  // --- HÀM LÀM MỚI FORM (RESET) ---
  const handleResetForm = () => {
    if (window.confirm('Bạn có chắc muốn xóa hết thông tin đang nhập để tạo phiếu mới?')) {
        setNewExport(INITIAL_EXPORT_STATE);
        setSelectedCustomerInfo(null);
        updateCache('exportDraft', null);
        updateCache('exportDraftCustomer', null);
        fetchNewCode();
        toast.info('Đã làm mới form');
    }
  };

  const customerOptions = customers.map(c => ({
    value: c._id,
    label: c.name // <--- Chỉ lấy Tên, bỏ SĐT
  }));

  // --- USE EFFECT: LOAD DATA ---
  useEffect(() => {
    const loadData = async () => { if (!globalCache.exports || refreshFlags.exports) { try { setLoading(true); const res = await axiosClient.get('/exports'); setExports(res); updateCache('exports', res); } catch (error) { console.error(error); } finally { setLoading(false); } } };
    loadData();
  }, [refreshFlags.exports]);

  const fetchData = async () => { try { setLoading(true); const [exportRes, customerRes, productRes] = await Promise.all([axiosClient.get('/exports'), axiosClient.get('/partners?type=customer'), axiosClient.get('/products')]); setExports(exportRes); updateCache('exports', exportRes); setCustomers(customerRes); setProducts(productRes); } catch (error) { toast.error('Lỗi tải dữ liệu'); } finally { setLoading(false); } };
  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortConfig]);

  // --- IN ẤN & XUẤT ẢNH ---
  const generateInvoiceHTML = (item, hidePrice, isImageExport = false) => {
    /* ... (Giữ nguyên code hàm in ấn của bạn) ... */
    const customerName = item.customer_id?.name || 'Khách lẻ';
    const customerPhone = item.customer_id?.phone || '';
    const customerAddress = item.customer_id?.address || '';
    const saleName = 'Phan Thành Tiến - 0387.645.618';
    const note = item.note || '';
    const currentPoints = (item.partner_points_snapshot !== undefined && item.partner_points_snapshot !== null) ? item.partner_points_snapshot : (item.customer_id?.saved_points || 0);
    const totalPointsThisBill = item.details.reduce((sum, d) => sum + (d.quantity * (d.gift_points || 0)), 0);
    const oldPoints = currentPoints - totalPointsThisBill;
    let totalQty = 0; let totalRawAmount = 0;
    const cssConfig = isImageExport ? { tableStyle: 'border-collapse: separate; border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000;', cellBorder: 'border-right: 1px solid #000; border-bottom: 1px solid #000; border-top: none; border-left: none;', paddingTD: 'padding-top: 0px !important; padding-bottom: 12px !important; padding-right: 4px;', paddingTH: 'padding-top: 0px !important; padding-bottom: 10px !important;', lineHeight: '1.1', productNamePadding: 'padding-left: 5px !important;' } : { tableStyle: 'border-collapse: collapse; border: none;', cellBorder: 'border: 1px solid #000;', paddingTD: 'padding: 5px 4px;', paddingTH: 'padding: 5px 4px;', lineHeight: '1.3', productNamePadding: 'padding-left: 5px;' };
    const productRows = item.details.map((detail, index) => { totalQty += detail.quantity; const rawAmount = detail.quantity * detail.export_price; totalRawAmount += rawAmount; const rowPointTotal = detail.quantity * (detail.gift_points || 0); let priceCells = ''; if (!hidePrice) { priceCells = `<td style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(detail.export_price)}</td><td style="text-align:center; font-weight:bold; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatNumber(detail.quantity)}</td><td style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(rawAmount)}</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${detail.discount > 0 ? detail.discount + '%' : ''}</td><td style="text-align:right; font-weight: bold; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(detail.total)}</td>`; } else { priceCells = `<td style="text-align:center; font-weight:bold; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatNumber(detail.quantity)}</td>`; } return `<tr><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${index + 1}</td><td style="text-align:left; ${cssConfig.productNamePadding} ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${detail.product_name_backup}</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${detail.unit}</td>${priceCells}<td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${rowPointTotal > 0 ? '+' : ''}${rowPointTotal}</td></tr>`; }).join('');
    let tableHeader = ''; if (!hidePrice) { tableHeader = `<tr><th rowspan="2" style="width: 5%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">STT</th><th rowspan="2" style="${cssConfig.cellBorder} ${cssConfig.paddingTH}">Tên sản phẩm</th><th rowspan="2" style="width: 6%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">ĐVT</th><th rowspan="2" style="width: 9%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Đơn giá</th><th colspan="2" style="width: 14%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Bán</th><th rowspan="2" style="width: 8%; white-space: nowrap; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">CK(%)</th><th rowspan="2" style="width: 12%; white-space: nowrap; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Thành tiền</th><th rowspan="2" style="width: 7%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Điểm<br>quà</th></tr><tr><th style="width: 4%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">SL</th><th style="${cssConfig.cellBorder} ${cssConfig.paddingTH}">Tiền</th></tr>`; } else { tableHeader = `<tr><th rowspan="2" style="width: 5%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">STT</th><th rowspan="2" style="${cssConfig.cellBorder} ${cssConfig.paddingTH}">Tên sản phẩm</th><th rowspan="2" style="width: 10%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">ĐVT</th><th rowspan="2" style="width: 10%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">SL</th><th rowspan="2" style="width: 10%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Điểm quà</th></tr>`; }
    let totalRow = ''; if (!hidePrice) { totalRow = `<tr style="font-weight:bold;"><td colspan="4" style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">TỔNG</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatNumber(totalQty)}</td><td style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(totalRawAmount)}</td><td style="${cssConfig.cellBorder} ${cssConfig.paddingTD}"></td><td style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(item.total_amount)}</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${totalPointsThisBill > 0 ? '+' : ''}${totalPointsThisBill}</td></tr>`; } else { totalRow = `<tr style="font-weight:bold;"><td colspan="3" style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">TỔNG</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatNumber(totalQty)}</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${totalPointsThisBill > 0 ? '+' : ''}${totalPointsThisBill}</td></tr>`; }
    const totalAmountText = !hidePrice ? `<div style="font-weight:bold; text-transform:uppercase; text-align:right; font-size: 14px;">TỔNG TIỀN PHẢI THANH TOÁN: ${formatCurrency(item.total_amount)}VNĐ</div>` : '';
    return `<style>.print-container { font-family: "Times New Roman", Times, serif; font-size: 13px; color: #000; background: white; line-height: ${cssConfig.lineHeight}; padding: 20px; } .print-container table { font-size: 14px; width: 100%; ${cssConfig.tableStyle} margin-bottom: 5px; } .print-container th, .print-container td { vertical-align: middle !important; } .print-container th { text-align: center; font-weight: bold; background-color: #ffffff; ${isImageExport ? 'height: 40px;' : ''} } .print-container .no-border td { border: none !important; padding: 2px 0 !important; vertical-align: top !important; } .print-container .header-title { text-align: center; margin-bottom: 5px; margin-top: 10px; } .print-container .header-title h2 { margin-bottom: 1px; margin-top: 5px; font-size: 20px; text-transform: uppercase; font-weight: bold; } .print-container strong { font-weight: bold; } .print-container i { font-style: italic; } </style> <div class="print-container"> <table class="no-border" style="width:100%; margin-bottom:0px; border: none !important;"> <tr> <td style="font-size:14px; line-height: 1.3; width:65%;"> <strong style="text-transform: uppercase;">NPP LÂM ANH</strong><br> Mã số thuế: 1801790506<br> Địa chỉ: 430B, KV1, P. Cái Răng, TP. Cần Thơ </td> <td style="font-size:14px; width:35%; text-align:right;"> Số phiếu: <strong>${item.code}</strong> </td> </tr> </table> <div class="header-title"><h2>PHIẾU GIAO HÀNG</h2><i>${formatDate(item.date)}</i></div> <table class="no-border" style="width:100%; margin-bottom:10px; border: none !important;"> <tr> <td style="width: 58%; padding-left: 40px !important;"><strong>Khách hàng:</strong> ${customerName}</td> <td style="width: 42%; padding-right: 40px !important;"><strong>Điện thoại:</strong> ${customerPhone}</td> </tr> <tr> <td style="padding-left: 40px !important;"><strong>Địa chỉ:</strong> ${customerAddress}</td> <td style="padding-right: 10px !important;"><strong>Sale:</strong> ${saleName}</td> </tr> </table> <table> <thead>${tableHeader}</thead> <tbody>${productRows}${totalRow}</tbody> </table> <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 15px;"> <div style="font-size: 13px; flex: 1;"> <strong>Điểm còn gửi:</strong> ${formatNumber(currentPoints)} <i style="margin-left: 5px;"> (${formatNumber(oldPoints)} ${totalPointsThisBill >= 0 ? '+' : ''} ${formatNumber(totalPointsThisBill)}) </i> </div> <div style="flex: 1; text-align: right;">${totalAmountText}</div> </div> <div style="margin-top: 1px;"><strong>Ghi chú:</strong> ${note}</div> <table class="no-border" style="width:100%; margin-top: 20px; text-align: center; border: none !important;"> <tr> <td style="width: 33%; text-align: center !important;"><strong>Người lập phiếu</strong></td> <td style="width: 33%; text-align: center !important;"><strong>Người giao hàng</strong></td> <td style="width: 33%; text-align: center !important;"><strong>Người nhận hàng</strong></td> </tr> </table> </div>`;
  };

  const printTransactionWindow = (item, hidePrice) => { const content = generateInvoiceHTML(item, hidePrice, false); const fullHtml = `<html><head><title>In Phiếu ${item.code}</title></head><body>${content}</body></html>`; const printWindow = window.open('', '_blank'); printWindow.document.write(fullHtml); printWindow.document.close(); setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500); };
  const exportImage = async (item, hidePrice) => { try { toast.info('Đang tạo ảnh...', { autoClose: 2000 }); const tempDiv = document.createElement('div'); tempDiv.innerHTML = generateInvoiceHTML(item, hidePrice, true); tempDiv.style.position = 'absolute'; tempDiv.style.left = '-9999px'; tempDiv.style.top = '0'; tempDiv.style.width = '850px'; tempDiv.style.backgroundColor = '#fff'; document.body.appendChild(tempDiv); const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' }); const image = canvas.toDataURL("image/png"); const link = document.createElement('a'); link.href = image; link.download = `Phieu_${item.code}.png`; link.click(); document.body.removeChild(tempDiv); toast.success('Đã tải ảnh thành công!'); } catch (error) { console.error("Lỗi xuất ảnh:", error); toast.error('Có lỗi khi tạo ảnh'); } };
  const checkExportAction = (e, item, type) => { e.stopPropagation(); if (type === 'excel' || type === 'image') { performExport(item, type, false); return; } const customerId = item.customer_id?._id; const foundCustomer = customers.find(c => c._id === customerId); const customerHideSetting = foundCustomer ? foundCustomer.hide_price : false; performExport(item, type, customerHideSetting); };
  const performExport = (item, type, hidePrice) => { if (type === 'excel') { exportExcel(item, false); } else if (type === 'print') { printTransactionWindow(item, hidePrice); } else if (type === 'image') { exportImage(item, hidePrice); } };
  const exportExcel = (item, hidePrice) => { const dataToExport = item.details.map((d, index) => { const row = { 'STT': index + 1, 'Tên sản phẩm': d.product_name_backup, 'Đơn vị': d.unit, 'Số lượng': d.quantity, 'Điểm quà': d.quantity * (d.gift_points || 0) }; if (!hidePrice) { row['Đơn giá'] = d.export_price; row['Thành tiền'] = d.total; } return row; }); const totalRow = { 'STT': '', 'Tên sản phẩm': 'TỔNG CỘNG', 'Đơn vị': '', 'Số lượng': item.details.reduce((s, i) => s + i.quantity, 0), 'Điểm quà': item.details.reduce((sum, d) => sum + (d.quantity * (d.gift_points || 0)), 0) }; if (!hidePrice) { totalRow['Đơn giá'] = ''; totalRow['Thành tiền'] = item.total_amount; } dataToExport.push(totalRow); const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "PhieuXuat"); XLSX.writeFile(wb, `Phieu_${item.code}.xlsx`); };

  // --- XỬ LÝ DỮ LIỆU & PHÂN TRANG (GIỮ NGUYÊN) ---
  const getProcessedExports = () => { let result = [...exports]; if (searchTerm) { const lowerTerm = searchTerm.toLowerCase().trim(); result = result.filter(item => { const matchCode = item.code?.toLowerCase().includes(lowerTerm); const matchCustomer = item.customer_id?.name?.toLowerCase().includes(lowerTerm); const matchNote = item.note?.toLowerCase().includes(lowerTerm); const dateStr = new Date(item.date).toLocaleDateString('vi-VN'); const matchDate = dateStr.includes(lowerTerm); const matchProduct = item.details?.some(d => d.product_name_backup?.toLowerCase().includes(lowerTerm) || d.sku?.toLowerCase().includes(lowerTerm)); return matchCode || matchCustomer || matchNote || matchDate || matchProduct; }); } return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); };
  const processedExports = getProcessedExports();
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = processedExports.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(processedExports.length / itemsPerPage);
  const paginate = (pageNumber) => { if (pageNumber > 0 && pageNumber <= totalPages) setCurrentPage(pageNumber); };
  const handleSort = (key) => { let direction = 'asc'; if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const renderSortIcon = (key) => { if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 ml-1" />; return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-1" /> : <ArrowDown size={14} className="text-blue-600 ml-1" />; };

  // --- FORM LOGIC MỚI: Tự động lưu và khôi phục nháp ---

  // 1. Tự động LƯU nháp vào globalCache mỗi khi newExport thay đổi
  useEffect(() => {
    // Chỉ lưu khi đang mở modal tạo mới (không phải xem chi tiết)
    if (showModal && !isViewMode) {
      // Debounce nhẹ hoặc lưu luôn (ở đây lưu luôn cho đơn giản)
      updateCache('exportDraft', newExport);
      updateCache('exportDraftCustomer', selectedCustomerInfo);
    }
  }, [newExport, selectedCustomerInfo, showModal, isViewMode]);

  // 2. KHÔI PHỤC nháp khi mở Modal
  useEffect(() => {
    if (showModal && !isViewMode) {
      // Kiểm tra xem có bản nháp trong Cache không
      const draft = globalCache.exportDraft;
      const draftCustomer = globalCache.exportDraftCustomer;

      // Nếu có bản nháp và nó có dữ liệu (có khách hoặc có sản phẩm)
      if (draft && (draft.customer_id || draft.details.length > 0)) {
        setNewExport(draft);
        setSelectedCustomerInfo(draftCustomer);
        toast.info('Đã khôi phục phiếu xuất đang soạn dở', { autoClose: 1000 });
      } else {
        // Nếu không có nháp thì mới Reset như bình thường
        const isDraftCurrent = newExport.customer_id || newExport.details.length > 0;
        if (!isDraftCurrent) {
            setNewExport({ ...INITIAL_EXPORT_STATE, code: 'Đang tải mã...' });
            setSelectedCustomerInfo(null);
            setProductSearch('');
            setFilteredProducts([]);
            setIsSubmitting(false);
            fetchNewCode();
        }
      }
    }
  }, [showModal, isViewMode]); // Bỏ dependencies newExport để tránh loop

  const handleSaveExport = async () => {
    if (!newExport.customer_id) return toast.warning('Chọn Khách hàng');
    if (newExport.details.length === 0) return toast.warning('Chưa có sản phẩm');
    if (isSubmitting) return;
    try { 
        setIsSubmitting(true); 
        const payload = { ...newExport, total_amount: calculateTotalAmount() }; 
        await axiosClient.post('/exports', payload);
        updateCache('exportDraft', null);
        updateCache('exportDraftCustomer', null); 
        toast.success('Xuất kho thành công!'); 
        triggerRefresh(['exports', 'products', 'debts', 'dashboard', 'partners']); 
        
        setNewExport(INITIAL_EXPORT_STATE);
        setSelectedCustomerInfo(null);

        handleCloseModal();
        fetchData(); 
    } catch (error) { 
        toast.error('Lỗi: ' + (error.response?.data?.message || error.message)); 
    } finally { 
        setIsSubmitting(false); 
    }
  };

  const handleUpdateNote = async () => { try { await axiosClient.put(`/exports/${newExport._id}`, { note: newExport.note, hide_price: newExport.hide_price }); fetchData(); } catch (error) { toast.error('Lỗi cập nhật: ' + error.message); } };
  const handleDeleteExport = async (e, id, code) => { e.stopPropagation(); if (window.confirm(`Xóa phiếu ${code}?`)) { try { await axiosClient.delete(`/exports/${id}`); toast.success('Đã xóa'); triggerRefresh(['exports', 'products', 'debts', 'dashboard', 'partners']); fetchData(); } catch (error) { toast.error('Lỗi xóa: ' + error.message); } } };
  const handleRowClick = (item) => { setNewExport({ _id: item._id, code: item.code, customer_id: item.customer_id?._id || '', note: item.note || '', payment_due_date: toInputDate(item.payment_due_date), hide_price: item.hide_price || false, details: item.details || [], date: item.date, total_amount: item.total_amount, partner_points_snapshot: item.partner_points_snapshot }); const oldCustomer = customers.find(c => c._id === (item.customer_id?._id || item.customer_id)); setSelectedCustomerInfo(oldCustomer); setIsViewMode(true); setShowModal(true); };
  const handleCustomerChange = (customerId) => { const customer = customers.find(c => c._id === customerId); if (customer) { setSelectedCustomerInfo(customer); setNewExport(prev => ({ ...prev, customer_id: customerId, hide_price: customer.hide_price || false, apply_wholesale: customer.is_wholesale || false })); recalculatePrices(customer.is_wholesale || false); } else { setSelectedCustomerInfo(null); setNewExport(prev => ({ ...prev, customer_id: '', apply_wholesale: false })); } };
  const recalculatePrices = (isWholesale) => { setNewExport(prev => { const newDetails = prev.details.map(item => { const product = products.find(p => p._id === item.product_id); if (!product) return item; let newPrice = product.export_price || 0; if (isWholesale) { const discount = product.discount_percent || 0; newPrice = newPrice * (1 - discount / 100); } return { ...item, export_price: newPrice, total: item.quantity * newPrice }; }); return { ...prev, details: newDetails }; }); };
  const getPriceForProduct = (product) => { let price = product.export_price || 0; if (newExport.apply_wholesale) { const discount = product.discount_percent || 0; price = price * (1 - discount / 100); } return price; };
  
  // --- XỬ LÝ IMPORT EXCEL (MỚI) ---
  const handleDownloadTemplate = () => {
    const templateData = [['Tên sản phẩm', 'Số lượng'], ['Sữa Ông Thọ', 10], ['Bánh Mì', 5]];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MauXuatKho");
    XLSX.writeFile(wb, "Mau_Xuat_Kho.xlsx");
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
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const importedDetails = [];
        const notFoundProducts = [];

        // Duyệt từ dòng 1 (bỏ tiêu đề)
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const productName = row[0] ? String(row[0]).trim() : '';
          const quantity = row[1] ? Number(row[1]) : 1;

          if (!productName) continue;

          // Tìm sản phẩm
          const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());

          if (product) {
            // Kiểm tra tồn kho nếu không phải đang xem chi tiết
            if (product.current_stock <= 0) {
                notFoundProducts.push(`${productName} (Hết hàng)`);
                continue;
            }

            const finalPrice = getPriceForProduct(product);
            const finalQuantity = Math.min(quantity, product.current_stock); // Không cho nhập quá tồn

            importedDetails.push({
              product_id: product._id,
              product_name_backup: product.name,
              sku: product.sku,
              unit: product.unit,
              quantity: finalQuantity > 0 ? finalQuantity : 1,
              export_price: finalPrice,
              gift_points: product.gift_points || 0,
              total: (finalQuantity > 0 ? finalQuantity : 1) * finalPrice
            });
          } else {
            notFoundProducts.push(productName);
          }
        }

        if (importedDetails.length > 0) {
          setNewExport(prev => ({
            ...prev,
            details: [...prev.details, ...importedDetails]
          }));
          toast.success(`Đã thêm ${importedDetails.length} sản phẩm từ file!`);
        }

        if (notFoundProducts.length > 0) {
          toast.warn(`Không thêm được ${notFoundProducts.length} SP: ${notFoundProducts.slice(0, 3).join(', ')}...`);
        }

      } catch (error) {
        console.error(error);
        toast.error('Lỗi đọc file Excel.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const preventNumberInputScroll = (e) => {
    // Chặn cuộn chuột: Khi lăn chuột, lập tức bỏ focus khỏi ô input
    if (e.type === 'wheel') {
        e.target.blur();
    }
  };

  const addProductToExport = (product) => { if (product.current_stock <= 0) { return toast.error(`Sản phẩm ${product.name} đã hết hàng!`); } const finalPrice = getPriceForProduct(product); const newItem = { product_id: product._id, product_name_backup: product.name, sku: product.sku, unit: product.unit, quantity: 1, export_price: finalPrice, gift_points: product.gift_points || 0, total: finalPrice }; setNewExport({ ...newExport, details: [...newExport.details, newItem] }); setProductSearch(''); setFilteredProducts([]); setIsSearchFocus(true); setActiveIndex(-1); };
  const updateDetail = (index, field, value) => {
    const updatedDetails = [...newExport.details];
    
    // 1. Cho phép gán chuỗi rỗng '' vào state
    const val = value === '' ? '' : Number(value);

    // 2. Kiểm tra tồn kho (Logic riêng của ExportPage)
    // Chỉ kiểm tra khi val là số thực sự (> 0)
    if (field === 'quantity') {
      const product = products.find(p => p._id === updatedDetails[index].product_id);
      if (!isViewMode && product && val !== '' && val > product.current_stock) {
        toast.error(`Quá tồn kho! Tối đa: ${product.current_stock}`);
        // Nếu nhập quá, gán về max tồn kho luôn
        updatedDetails[index][field] = product.current_stock;
        
        // Tính lại total ngay tại đây cho trường hợp bị gán lại
        updatedDetails[index].total = calculateLineTotal(product.current_stock, updatedDetails[index].export_price, updatedDetails[index].discount || 0);
        setNewExport({ ...newExport, details: updatedDetails });
        return; 
      }
    }

    // 3. Cập nhật giá trị vào biến tạm
    updatedDetails[index][field] = val;

    // 4. Tính toán Total an toàn (coi '' là 0)
    const qty = field === 'quantity' ? (val === '' ? 0 : val) : (updatedDetails[index].quantity === '' ? 0 : updatedDetails[index].quantity);
    const price = field === 'export_price' ? (val === '' ? 0 : val) : (updatedDetails[index].export_price === '' ? 0 : updatedDetails[index].export_price);
    const discount = updatedDetails[index].discount || 0;

    updatedDetails[index].total = calculateLineTotal(qty, price, discount);

    setNewExport({ ...newExport, details: updatedDetails });
  };
  const handleBlur = (index, field) => {
    const item = newExport.details[index];

    // Nếu giá trị đang là chuỗi rỗng '', thì reset về 0
    if (item[field] === '') {
        const updatedDetails = [...newExport.details];
        updatedDetails[index][field] = 0;

        // Tính lại total cho dòng này để đảm bảo nhất quán
        const qty = updatedDetails[index].quantity === '' ? 0 : updatedDetails[index].quantity;
        const price = updatedDetails[index].export_price === '' ? 0 : updatedDetails[index].export_price;
        const discount = updatedDetails[index].discount || 0;
        
        updatedDetails[index].total = calculateLineTotal(qty, price, discount);

        setNewExport({ ...newExport, details: updatedDetails });
    }
  };
  const removeDetail = (index) => { const updatedDetails = newExport.details.filter((_, i) => i !== index); setNewExport({ ...newExport, details: updatedDetails }); };
  const calculateTotalAmount = () => newExport.details.reduce((sum, item) => sum + item.total, 0);
  const calculateTotalPoints = () => newExport.details.reduce((sum, item) => sum + (item.quantity * (item.gift_points || 0)), 0);
  const calculateLineTotal = (qty, price, discountPercent) => { const finalPrice = price * (1 - (discountPercent / 100)); return qty * finalPrice; };
  
  useEffect(() => {
    if (!isSearchFocus && productSearch.trim() === '') {
      setFilteredProducts([]);
      setActiveIndex(-1); // Reset khi rỗng
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
  
    // --- QUAN TRỌNG: Mặc định chọn dòng đầu tiên (index 0) nếu có kết quả ---
    if (results.length > 0) {
      setActiveIndex(0);
    } else {
      setActiveIndex(-1);
    }
  }, [productSearch, products, isSearchFocus]);
// --- Sửa hàm handleKeyDown trong ExportPage.jsx ---
const handleKeyDown = (e) => {
  if (filteredProducts.length === 0) return;

  // Xử lý nút Mũi tên xuống HOẶC nút Tab
  if (e.key === 'ArrowDown' || e.key === 'Tab') {
    e.preventDefault(); 
    // Di chuyển xuống dưới, nếu đang ở cuối thì giữ nguyên
    setActiveIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
  } 
  // Xử lý nút Mũi tên lên
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    // Di chuyển lên trên, nếu đang ở đầu (0) thì giữ nguyên
    setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
  } 
  // Xử lý nút Enter
  else if (e.key === 'Enter') {
    e.preventDefault();
    // Nếu activeIndex hợp lệ thì chọn sản phẩm đó
    if (activeIndex >= 0 && filteredProducts[activeIndex]) {
      addProductToExport(filteredProducts[activeIndex]);
    } 
    // Fallback: Nếu vì lý do nào đó chưa chọn (ví dụ -1) nhưng có danh sách, chọn cái đầu tiên
    else if (filteredProducts.length > 0) {
      addProductToExport(filteredProducts[0]);
    }
  } 
  // Xử lý nút ESC
  else if (e.key === 'Escape') {
    setIsSearchFocus(false);
  }
  };
  const handleQuantityKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); if (searchInputRef.current) searchInputRef.current.focus(); } };
  useEffect(() => { if (activeIndex !== -1 && listRef.current) { const listItems = listRef.current.children; if (listItems[activeIndex]) listItems[activeIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } }, [activeIndex]);
  useEffect(() => { if (newExport.details.length > 0) { const lastIndex = newExport.details.length - 1; const quantityInput = document.getElementById(`quantity-${lastIndex}`); if (quantityInput) { quantityInput.focus(); quantityInput.select(); } } }, [newExport.details.length]);

  return (
    <div className="p-2 pb-10">
      <style>{`@keyframes fadeIn {from { opacity: 0; transform: scale(0.95); }to { opacity: 1; transform: scale(1); }}@keyframes fadeOut {from { opacity: 1; transform: scale(1); }to { opacity: 0; transform: scale(0.95); }}`}</style>

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div className="flex items-center gap-3">
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100 text-black-600 transition-colors"><Menu size={24} /></button>
            <h1 className="text-2xl font-bold text-gray-800">Xuất kho</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Mã phiếu, Khách, Ghi chú..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <button onClick={() => { setIsViewMode(false); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors">
            <Plus size={20} /> Tạo phiếu xuất
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden print:hidden">
        <div className="overflow-x-auto">
            {/* Table content kept same as previous version for brevity */}
            <table className="w-full text-left">
            <thead className="bg-blue-50 text-gray-600 font-semibold text-sm border-b">
                <tr>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('code')}><div className="flex items-center">Mã phiếu {renderSortIcon('code')}</div></th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('date')}><div className="flex items-center">Ngày xuất {renderSortIcon('date')}</div></th>
                <th className="p-4 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('customer_id')}><div className="flex items-center">Khách hàng {renderSortIcon('customer_id')}</div></th>
                <th className="p-4 text-right cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort('total_amount')}><div className="flex items-center justify-end">Tổng tiền {renderSortIcon('total_amount')}</div></th>
                <th className="p-4 text-gray-600">Ghi chú</th>
                <th className="p-4 text-center w-40">Thao tác</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {currentItems.map((item) => (
                <tr key={item._id} className="hover:bg-gray-100 cursor-pointer" onClick={() => handleRowClick(item)}>
                    <td className="p-4 font-bold text-blue-600 font-mono">{item.code}</td>
                    <td className="p-4 text-gray-800">{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                    <td className="p-4 font-medium text-gray-800">{item.customer_id?.name} {item.hide_price && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded border border-yellow-200">Ẩn giá</span>}</td>
                    <td className="p-4 text-right font-bold text-gray-800">{item.total_amount?.toLocaleString()}₫</td>
                    <td className="p-4 text-gray-500 italic text-sm max-w-[200px] truncate" title={item.note}>{item.note || ''}</td>
                    <td className="p-4 text-center flex justify-center gap-1">
                    <button onClick={(e) => checkExportAction(e, item, 'print')} className="p-2 text-gray-600 hover:bg-gray-200 rounded" title="In phiếu"><Printer size={18} /></button>
                    <button onClick={(e) => checkExportAction(e, item, 'excel')} className="p-2 text-green-600 hover:bg-green-100 rounded" title="Excel"><FileSpreadsheet size={18} /></button>
                    <button onClick={(e) => checkExportAction(e, item, 'image')} className="p-2 text-purple-600 hover:bg-purple-100 rounded" title="Lưu ảnh"><ImageIcon size={18} /></button>
                    <div className="w-px h-4 bg-gray-300 mx-1 self-center"></div>
                    <button onClick={(e) => handleDeleteExport(e, item._id, item.code)} className="p-2 text-red-400 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={18} /></button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>

        {/* --- THANH PHÂN TRANG UI --- */}
        {processedExports.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">
                Hiển thị {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, processedExports.length)} trong số {processedExports.length} phiếu
              </div>
              
              <div className="flex items-center gap-2">
                <select className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value="10">10 dòng</option><option value="20">20 dòng</option><option value="50">50 dòng</option><option value="100">100 dòng</option>
                </select>
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className={`p-1 rounded-md border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}><ChevronLeft size={20} /></button>
                <div className="flex gap-1">{Array.from({ length: Math.min(5, totalPages) }, (_, i) => { let pageNum = i + 1; if (totalPages > 5) { if (currentPage > 3) pageNum = currentPage - 2 + i; if (pageNum > totalPages) pageNum = totalPages - 4 + i; } return (<button key={pageNum} onClick={() => paginate(pageNum)} className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${ currentPage === pageNum ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50' }`}>{pageNum}</button>) })}</div>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className={`p-1 rounded-md border ${currentPage === totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}><ChevronRight size={20} /></button>
              </div>
            </div>
        )}
      </div>

      {/* MODAL CHÍNH */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div 
            className="bg-white rounded-xl shadow-2xl w-[98%] md:w-[90%] max-w-7xl h-[92vh] flex flex-col transform scale-100"
            style={{ 
               animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' 
            }}
          >
             {/* HEADER MODAL */}
             <div className="flex justify-between items-center p-5 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-4 overflow-hidden">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 truncate">
                    {isViewMode ? <><Eye size={24} className="text-blue-600 shrink-0" /> Chi tiết phiếu xuất</> : <><Plus size={24} className="text-blue-600 shrink-0" /> Tạo đơn bán hàng</>}
                  </h2>
                  
                  {!isViewMode && (
                    <button type="button" onClick={handleResetForm} className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-colors border border-gray-200 whitespace-nowrap shrink-0" title="Xóa trắng form để nhập mới">
                        <RefreshCw size={14} /> Làm mới
                    </button>
                  )}
              </div>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100 shrink-0 ml-4"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-5">
                <div className="grid grid-cols-4 gap-5 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Barcode size={16}/> Mã phiếu</label>
                      <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-100 text-gray-500 font-mono font-bold focus:ring-0 outline-none cursor-not-allowed" value={newExport.code} readOnly />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><User size={16}/> Khách hàng <span className="text-red-500">*</span></label>
                      <Select
                        options={customerOptions}
                        value={customerOptions.find(c => c.value === newExport.customer_id) || null}
                        onChange={(selected) => handleCustomerChange(selected ? selected.value : '')}
                        isDisabled={isViewMode}
                        placeholder="-- Nhập tên --"
                        isClearable
                        isSearchable
                        noOptionsMessage={() => "Không tìm thấy tên này"}
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderRadius: '0.5rem',
                            borderColor: '#d1d5db',
                            minHeight: '42px',
                            fontSize: '14px'
                          }),
                          menu: (base) => ({ ...base, zIndex: 9999 })
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hạn thanh toán</label>
                      <input 
                        type={isViewMode ? "text" : "date"}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-gray-800"
                        value={isViewMode ? formatDisplayDate(newExport.payment_due_date) : newExport.payment_due_date} 
                        onChange={(e) => setNewExport({...newExport, payment_due_date: e.target.value})}
                        disabled={isViewMode}
                        placeholder="dd/mm/yyyy"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><FileText size={16}/> Ghi chú</label>
                      <div className="flex gap-2">
                        <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-gray-800" placeholder="VD: Giao gấp..." value={newExport.note} onChange={(e) => setNewExport({...newExport, note: e.target.value})} />
                        {isViewMode && <button onClick={handleUpdateNote} className="bg-blue-100 text-blue-700 p-2 rounded hover:bg-blue-200" title="Cập nhật ghi chú"><RefreshCw size={18}/></button>}
                      </div>
                    </div>
                </div>
              </div>
              
              {!isViewMode && (
                <div className="sticky top-0 z-20 bg-gray-50 pt-2 pb-4 mb-2 shadow-sm border-b border-gray-200">
                  <div className="flex flex-col gap-3">
                    {/* --- TÍNH NĂNG MỚI: NHẬP EXCEL (GIỐNG IMPORT PAGE) --- */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Search size={18} className="text-blue-600" /><label className="font-bold text-gray-800 text-sm uppercase">Thêm sản phẩm vào giỏ</label></div>
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
                    {/* ----------------------------------------------------- */}

                    <input ref={searchInputRef} type="text" className="w-full border border-blue-300 rounded-lg p-3 shadow-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="Gõ tên hoặc mã sản phẩm..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} onFocus={() => setIsSearchFocus(true)} onBlur={() => setTimeout(() => setIsSearchFocus(false), 200)} onKeyDown={handleKeyDown} />
                  </div>
                  {filteredProducts.length > 0 && (productSearch || isSearchFocus) && (
                    <div ref={listRef} className="absolute top-full left-0 right-0 bg-white shadow-xl border rounded-lg mt-1 z-10 max-h-60 overflow-y-auto">
                      {filteredProducts.map((p, index) => (
                        <div key={p._id} className={`p-3 cursor-pointer border-b flex justify-between items-center transition-colors ${index === activeIndex ? 'bg-blue-100 border-l-4 border-l-blue-600' : 'hover:bg-blue-50'}`} onClick={() => addProductToExport(p)}>
                          <div><div className="font-bold text-gray-800">{p.name}</div><div className="text-xs text-gray-500 flex gap-2 mt-1"><span className="bg-gray-100 px-1 rounded border">Mã: {p.sku || '---'}</span><span className="bg-purple-50 text-purple-700 px-1 rounded border border-purple-200">Điểm: {p.gift_points || 0}</span></div></div>
                          <div className={`font-medium px-2 py-1 rounded border ${p.current_stock > 0 ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-red-600 bg-red-50 border-red-100'}`}>Tồn: {p.current_stock}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-3">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 text-gray-700 text-sm uppercase font-semibold">
                    <tr><th className="p-3 w-10 text-center">#</th><th className="p-3">Tên sản phẩm</th><th className="p-3 w-24">Đơn vị</th><th className="p-3 w-32 text-right">Số lượng</th><th className="p-3 w-24 text-center">Điểm</th><th className="p-3 w-40 text-right">Đơn giá</th><th className="p-3 w-40 text-right">Thành tiền</th><th className="p-3 w-10"></th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {newExport.details.length === 0 ? ( <tr><td colSpan="8" className="p-10 text-center text-gray-400 italic">Chưa có sản phẩm nào.</td></tr> ) : (
                      newExport.details.map((item, index) => (
                        <tr key={index} className="hover:bg-blue-50 transition-colors">
                          <td className="p-3 text-center text-gray-500">{index + 1}</td>
                          <td className="p-3 font-medium text-gray-800">{item.product_name_backup}<div className="text-xs text-gray-400 font-mono mt-0.5">{item.sku}</div></td>
                          <td className="p-3 text-gray-600">{item.unit}</td>
                          <td className="p-3 text-right"><input id={`quantity-${index}`} onKeyDown={handleQuantityKeyDown} onBlur={() => handleBlur(index, 'quantity')} type="number" min="0" className="w-16 border border-gray-300 rounded p-1.5 text-right focus:ring-1 focus:ring-blue-500 outline-none font-bold text-gray-800" value={item.quantity} onChange={(e) => updateDetail(index, 'quantity', e.target.value)} onWheel={preventNumberInputScroll} disabled={isViewMode} /></td>
                          <td className="p-3 text-right"><input type="number" onBlur={() => handleBlur(index, 'gift_points')} className="w-16 border border-gray-300 rounded p-1.5 text-center font-bold focus:ring-1 focus:ring-blue-500 outline-none" value={item.gift_points !== undefined ? item.gift_points : 0} onChange={(e) => updateDetail(index, 'gift_points', e.target.value)} onWheel={preventNumberInputScroll} disabled={isViewMode} /></td>
                          <td className="p-3 text-right"><input type="number" onBlur={() => handleBlur(index, 'gift_points')} className="w-28 border border-gray-300 rounded p-1.5 text-right focus:ring-1 focus:ring-blue-500 outline-none" value={item.export_price} onChange={(e) => updateDetail(index, 'export_price', e.target.value)} onWheel={preventNumberInputScroll} disabled={isViewMode} /></td>
                          <td className="p-3 text-right font-bold text-blue-600">{item.total.toLocaleString()}₫</td>
                          <td className="p-3 text-center">{!isViewMode && <button onClick={() => removeDetail(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={18} /></button>}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-5 border-t bg-white flex justify-between items-center rounded-b-xl shrink-0">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <div className="text-gray-600 font-medium flex items-center gap-2">
                    <Gift className="text-purple-600" />
                    {selectedCustomerInfo ? (
                        <>
                            <span className="text-sm">Điểm còn gửi:</span>
                            <span className={`text-xl font-bold ${((selectedCustomerInfo.saved_points || 0) + calculateTotalPoints()) < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                {(selectedCustomerInfo.saved_points || 0) + calculateTotalPoints()}
                            </span>
                            <span className="text-sm text-gray-500 font-normal">
                                ({selectedCustomerInfo.saved_points || 0} {calculateTotalPoints() >= 0 ? '+' : ''}{calculateTotalPoints()})
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-sm">Tổng điểm phiếu:</span>
                            <span className={`text-xl font-bold ml-1 ${calculateTotalPoints() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {calculateTotalPoints() > 0 ? '+' : ''}{calculateTotalPoints()}
                            </span>
                        </>
                    )}
                </div>
                <div className="text-gray-600 font-medium flex items-center gap-2 md:border-l md:pl-6"><DollarSign className="text-blue-600" /> Tổng tiền: <span className="text-2xl font-bold text-red-600 ml-1">{calculateTotalAmount().toLocaleString()}₫</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => {
                  if (isViewMode && newExport._id) {
                    handleUpdateNote();
                  }
                  handleCloseModal();
                }} className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">Đóng</button>
                {!isViewMode && <button onClick={handleSaveExport} className={`px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 shadow-lg transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} {isSubmitting ? 'Đang lưu...' : 'Lưu phiếu'}</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPage;