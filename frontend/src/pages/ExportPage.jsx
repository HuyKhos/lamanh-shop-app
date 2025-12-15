import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { 
  Plus, Search, X, User, FileText, 
  Trash2, Save, Menu, Barcode, DollarSign,
  Eye, Printer, FileSpreadsheet, Gift,
  RefreshCw, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon,
  ChevronLeft, ChevronRight, Upload, Download
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx-js-style';
import html2canvas from 'html2canvas'; 
import Select from 'react-select';

const ExportPage = () => {
  const { isExpanded, setIsExpanded } = useOutletContext();
  const { globalCache, refreshFlags, updateCache, triggerRefresh } = useOutletContext();
  const searchInputRef = useRef(null); 
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

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
  const formatCurrency = (amount) => {
      if (amount === undefined || amount === null) return '0';
      return Number(amount).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
  };
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

  // --- LOGIC FORM: LƯU NHÁP & KHÔI PHỤC (Local Storage) ---
  const DRAFT_KEY = 'export_draft_data';
  const DRAFT_CUSTOMER_KEY = 'export_draft_customer';

  // 1. Lưu nháp
  useEffect(() => {
    if (showModal && !isViewMode) {
       if (newExport.customer_id || newExport.details.length > 0) {
           localStorage.setItem(DRAFT_KEY, JSON.stringify(newExport));
           if (selectedCustomerInfo) {
               localStorage.setItem(DRAFT_CUSTOMER_KEY, JSON.stringify(selectedCustomerInfo));
           }
       }
    }
  }, [newExport, selectedCustomerInfo, showModal, isViewMode]);

  // 2. Khôi phục
  useEffect(() => {
    if (showModal && !isViewMode) {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      const savedCustomer = localStorage.getItem(DRAFT_CUSTOMER_KEY);

      if (savedDraft) {
         try {
             const parsedDraft = JSON.parse(savedDraft);
             if (parsedDraft.customer_id || parsedDraft.details.length > 0) {
                 setNewExport(parsedDraft);
                 if (savedCustomer) setSelectedCustomerInfo(JSON.parse(savedCustomer));
                 toast.info('Đã khôi phục phiếu xuất đang soạn dở', { autoClose: 2000 });
                 return; 
             }
         } catch (e) { localStorage.removeItem(DRAFT_KEY); }
      }
      
      const isDraftCurrent = newExport.customer_id || newExport.details.length > 0;
      if (!isDraftCurrent) {
          setNewExport({ ...INITIAL_EXPORT_STATE, code: 'Đang tải mã...' });
          setSelectedCustomerInfo(null);
          fetchNewCode();
      }
    }
  }, [showModal, isViewMode]);

  // --- HÀM LÀM MỚI FORM (RESET) ---
  const handleResetForm = () => {
    if (window.confirm('Bạn có chắc muốn xóa hết thông tin đang nhập để tạo phiếu mới?')) {
        setNewExport(INITIAL_EXPORT_STATE);
        setSelectedCustomerInfo(null);
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(DRAFT_CUSTOMER_KEY);
        fetchNewCode();
        toast.info('Đã làm mới form');
    }
  };

  const customerOptions = customers.map(c => ({ value: c._id, label: c.name }));

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
    const customerName = item.customer_id?.name || 'Khách lẻ';
    const customerPhone = item.customer_id?.phone || '';
    const customerAddress = item.customer_id?.address || '';
    const saleName = 'Phan Thành Tiến - 0387.645.618';
    const note = item.note || '';
    
    // --- LOGIC TÍNH ĐIỂM SỬA ĐỔI ---
    const totalPointsThisBill = item.details.reduce((sum, d) => sum + (d.quantity * (d.gift_points || 0)), 0);
    let finalPoints = 0;
    let startPoints = 0;

    if (item.partner_points_snapshot !== undefined && item.partner_points_snapshot !== null) {
        // TRƯỜNG HỢP 1: XEM PHIẾU CŨ (Đã có lưu snapshot điểm lúc tạo)
        // Snapshot chính là Điểm Cuối Kỳ lúc đó
        finalPoints = item.partner_points_snapshot;
        startPoints = finalPoints - totalPointsThisBill; 
    } else {
        // TRƯỜNG HỢP 2: TẠO PHIẾU MỚI (Hoặc phiếu cũ quá chưa có snapshot)
        // Lấy điểm hiện tại của khách làm Điểm Đầu Kỳ
        startPoints = item.customer_id?.saved_points || 0;
        finalPoints = startPoints + totalPointsThisBill;
    }
    // -------------------------------

    let totalQty = 0; let totalRawAmount = 0;
    const cssConfig = isImageExport ? { tableStyle: 'border-collapse: separate; border-spacing: 0; border-top: 1px solid #000; border-left: 1px solid #000;', cellBorder: 'border-right: 1px solid #000; border-bottom: 1px solid #000; border-top: none; border-left: none;', paddingTD: 'padding-top: 0px !important; padding-bottom: 12px !important; padding-right: 4px;', paddingTH: 'padding-top: 0px !important; padding-bottom: 10px !important;', lineHeight: '1.1', productNamePadding: 'padding-left: 5px !important;' } : { tableStyle: 'border-collapse: collapse; border: none;', cellBorder: 'border: 1px solid #000;', paddingTD: 'padding: 5px 4px;', paddingTH: 'padding: 5px 4px;', lineHeight: '1.3', productNamePadding: 'padding-left: 5px;' };
    const productRows = item.details.map((detail, index) => { totalQty += detail.quantity; const rawAmount = detail.quantity * detail.export_price; totalRawAmount += rawAmount; const rowPointTotal = detail.quantity * (detail.gift_points || 0); let priceCells = ''; if (!hidePrice) { priceCells = `<td style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(detail.export_price)}</td><td style="text-align:center; font-weight:bold; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatNumber(detail.quantity)}</td><td style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(rawAmount)}</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${detail.discount > 0 ? detail.discount + '%' : ''}</td><td style="text-align:right; font-weight: bold; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(detail.total)}</td>`; } else { priceCells = `<td style="text-align:center; font-weight:bold; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatNumber(detail.quantity)}</td>`; } return `<tr><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${index + 1}</td><td style="text-align:left; ${cssConfig.productNamePadding} ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${detail.product_name_backup}</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${detail.unit}</td>${priceCells}<td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${rowPointTotal > 0 ? '+' : ''}${rowPointTotal}</td></tr>`; }).join('');
    let tableHeader = ''; if (!hidePrice) { tableHeader = `<tr><th rowspan="2" style="width: 5%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">STT</th><th rowspan="2" style="${cssConfig.cellBorder} ${cssConfig.paddingTH}">Tên sản phẩm</th><th rowspan="2" style="width: 6%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">ĐVT</th><th rowspan="2" style="width: 9%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Đơn giá</th><th colspan="2" style="width: 14%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Bán</th><th rowspan="2" style="width: 8%; white-space: nowrap; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">CK(%)</th><th rowspan="2" style="width: 12%; white-space: nowrap; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Thành tiền</th><th rowspan="2" style="width: 7%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Điểm<br>quà</th></tr><tr><th style="width: 4%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">SL</th><th style="${cssConfig.cellBorder} ${cssConfig.paddingTH}">Tiền</th></tr>`; } else { tableHeader = `<tr><th rowspan="2" style="width: 5%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">STT</th><th rowspan="2" style="${cssConfig.cellBorder} ${cssConfig.paddingTH}">Tên sản phẩm</th><th rowspan="2" style="width: 10%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">ĐVT</th><th rowspan="2" style="width: 10%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">SL</th><th rowspan="2" style="width: 10%; ${cssConfig.cellBorder} ${cssConfig.paddingTH}">Điểm quà</th></tr>`; }
    let totalRow = ''; if (!hidePrice) { totalRow = `<tr style="font-weight:bold;"><td colspan="4" style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">TỔNG</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatNumber(totalQty)}</td><td style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(totalRawAmount)}</td><td style="${cssConfig.cellBorder} ${cssConfig.paddingTD}"></td><td style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatCurrency(item.total_amount)}</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${totalPointsThisBill > 0 ? '+' : ''}${totalPointsThisBill}</td></tr>`; } else { totalRow = `<tr style="font-weight:bold;"><td colspan="3" style="text-align:right; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">TỔNG</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${formatNumber(totalQty)}</td><td style="text-align:center; ${cssConfig.cellBorder} ${cssConfig.paddingTD}">${totalPointsThisBill > 0 ? '+' : ''}${totalPointsThisBill}</td></tr>`; }
    const totalAmountText = !hidePrice ? `<div style="font-weight:bold; text-transform:uppercase; text-align:right; font-size: 14px;">TỔNG TIỀN PHẢI THANH TOÁN: ${formatCurrency(item.total_amount)}VNĐ</div>` : '';
    
    // Hiển thị: Điểm còn gửi: [Điểm Cuối] ([Điểm Đầu] + [Điểm Phiếu])
    return `<style>.print-container { font-family: "Times New Roman", Times, serif; font-size: 13px; color: #000; background: white; line-height: ${cssConfig.lineHeight}; padding: 20px; } .print-container table { font-size: 14px; width: 100%; ${cssConfig.tableStyle} margin-bottom: 5px; } .print-container th, .print-container td { vertical-align: middle !important; } .print-container th { text-align: center; font-weight: bold; background-color: #ffffff; ${isImageExport ? 'height: 40px;' : ''} } .print-container .no-border td { border: none !important; padding: 2px 0 !important; vertical-align: top !important; } .print-container .header-title { text-align: center; margin-bottom: 5px; margin-top: 10px; } .print-container .header-title h2 { margin-bottom: 1px; margin-top: 5px; font-size: 20px; text-transform: uppercase; font-weight: bold; } .print-container strong { font-weight: bold; } .print-container i { font-style: italic; } </style> <div class="print-container"> <table class="no-border" style="width:100%; margin-bottom:0px; border: none !important;"> <tr> <td style="font-size:14px; line-height: 1.3; width:65%;"> <strong style="text-transform: uppercase;">NPP LÂM ANH</strong><br> Mã số thuế: 1801790506<br> Địa chỉ: 430B, KV1, P. Cái Răng, TP. Cần Thơ </td> <td style="font-size:14px; width:35%; text-align:right;"> Số phiếu: <strong>${item.code}</strong> </td> </tr> </table> <div class="header-title"><h2>PHIẾU GIAO HÀNG</h2><i>${formatDate(item.date)}</i></div> <table class="no-border" style="width:100%; margin-bottom:10px; border: none !important;"> <tr> <td style="width: 58%; padding-left: 40px !important;"><strong>Khách hàng:</strong> ${customerName}</td> <td style="width: 42%; padding-right: 40px !important;"><strong>Điện thoại:</strong> ${customerPhone}</td> </tr> <tr> <td style="padding-left: 40px !important;"><strong>Địa chỉ:</strong> ${customerAddress}</td> <td style="padding-right: 10px !important;"><strong>Sale:</strong> ${saleName}</td> </tr> </table> <table> <thead>${tableHeader}</thead> <tbody>${productRows}${totalRow}</tbody> </table> <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 15px;"> <div style="font-size: 13px; flex: 1;"> <strong>Điểm còn gửi:</strong> ${formatNumber(finalPoints)} <i style="margin-left: 5px;"> (${formatNumber(startPoints)} ${totalPointsThisBill >= 0 ? '+' : ''} ${formatNumber(totalPointsThisBill)}) </i> </div> <div style="flex: 1; text-align: right;">${totalAmountText}</div> </div> <div style="margin-top: 1px;"><strong>Ghi chú:</strong> ${note}</div> <table class="no-border" style="width:100%; margin-top: 20px; text-align: center; border: none !important;"> <tr> <td style="width: 33%; text-align: center !important;"><strong>Người lập phiếu</strong></td> <td style="width: 33%; text-align: center !important;"><strong>Người giao hàng</strong></td> <td style="width: 33%; text-align: center !important;"><strong>Người nhận hàng</strong></td> </tr> </table> </div>`;
  };

  const printTransactionWindow = (item, hidePrice) => { const content = generateInvoiceHTML(item, hidePrice, false); const fullHtml = `<html><head><title>In Phiếu ${item.code}</title></head><body>${content}</body></html>`; const printWindow = window.open('', '_blank'); printWindow.document.write(fullHtml); printWindow.document.close(); setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500); };
  const exportImage = async (item, hidePrice) => { try { toast.info('Đang tạo ảnh...', { autoClose: 2000 }); const tempDiv = document.createElement('div'); tempDiv.innerHTML = generateInvoiceHTML(item, hidePrice, true); tempDiv.style.position = 'absolute'; tempDiv.style.left = '-9999px'; tempDiv.style.top = '0'; tempDiv.style.width = '850px'; tempDiv.style.backgroundColor = '#fff'; document.body.appendChild(tempDiv); const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' }); const image = canvas.toDataURL("image/png"); const link = document.createElement('a'); link.href = image; link.download = `Phieu_${item.code}.png`; link.click(); document.body.removeChild(tempDiv); toast.success('Đã tải ảnh thành công!'); } catch (error) { console.error("Lỗi xuất ảnh:", error); toast.error('Có lỗi khi tạo ảnh'); } };
  const checkExportAction = (e, item, type) => { e.stopPropagation(); if (type === 'excel' || type === 'image') { performExport(item, type, false); return; } const customerId = item.customer_id?._id; const foundCustomer = customers.find(c => c._id === customerId); const customerHideSetting = foundCustomer ? foundCustomer.hide_price : false; performExport(item, type, customerHideSetting); };
  const performExport = (item, type, hidePrice) => { if (type === 'excel') { exportExcel(item, false); } else if (type === 'print') { printTransactionWindow(item, hidePrice); } else if (type === 'image') { exportImage(item, hidePrice); } };
  const exportExcel = (item, hidePrice) => {
    // 1. Chuẩn bị dữ liệu
    const customerName = item.customer_id?.name || 'Khách lẻ';
    const customerPhone = item.customer_id?.phone || '';
    const customerAddress = item.customer_id?.address || '';
    const saleName = 'Phan Thành Tiến - 0387.645.618'; // Hoặc lấy từ user đăng nhập
    const createdDate = new Date(item.date);
    const dateStr = `Ngày ${createdDate.getDate()} tháng ${createdDate.getMonth() + 1} năm ${createdDate.getFullYear()}`;
    
    // Tính toán
    const totalQty = item.details.reduce((s, i) => s + i.quantity, 0);
    const totalRawPrice = item.details.reduce((s, i) => s + (i.quantity * i.export_price), 0);
    const totalPoints = item.details.reduce((s, i) => s + (i.quantity * (i.gift_points || 0)), 0);
    const oldPoints = (item.partner_points_snapshot !== undefined && item.partner_points_snapshot !== null) 
                      ? item.partner_points_snapshot - totalPoints 
                      : (item.customer_id?.saved_points || 0) - totalPoints;

    // --- ĐỊNH NGHĨA STYLE ---
    const styleBorder = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
    };
    const styleCenter = { alignment: { horizontal: "center", vertical: "center" } };
    const styleBold = { font: { bold: true } };
    const styleHeaderTable = { 
        font: { bold: true }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: styleBorder,
        fill: { fgColor: { rgb: "EFEFEF" } } // Màu nền xám nhẹ
    };
    const styleCellBorder = { border: styleBorder };
    const styleCellBorderCenter = { border: styleBorder, alignment: { horizontal: "center" } };
    const styleCellBorderRight = { border: styleBorder, alignment: { horizontal: "right" } };

    // 2. Xây dựng dữ liệu (WS_DATA)
    const ws_data = [
        ["NPP LÂM ANH", "", "", "", "", "", "", "Số phiếu:", item.code],
        ["Mã số thuế: 1801790506"], 
        ["Địa chỉ: 430B, KV1, P. Cái Răng, TP. Cần Thơ"],
        [], 
        ["PHIẾU GIAO HÀNG"], 
        [dateStr],
        [], 
        ["Khách hàng:", customerName, "", "", "", "", "Điện thoại:", customerPhone],
        ["Địa chỉ:", customerAddress, "", "", "", "", "Sale:", saleName],
        ["Ghi chú:", item.note || ''],
        [], 
    ];

    // Xác định dòng bắt đầu của bảng (Header Table nằm ở dòng index 11 - tức dòng 12 trong excel)
    const tableHeaderRowIndex = 11;

    // --- Header Bảng ---
    let tableHead = ["STT", "Tên sản phẩm", "ĐVT"];
    if (!hidePrice) {
        tableHead.push("Đơn giá", "SL", "Tiền hàng", "CK(%)", "Thành tiền");
    } else {
        tableHead.push("SL");
    }
    tableHead.push("Điểm quà");
    ws_data.push(tableHead);

    // --- Dữ liệu chi tiết ---
    item.details.forEach((d, index) => {
        let row = [
            index + 1,
            d.product_name_backup,
            d.unit
        ];
        if (!hidePrice) {
            row.push(d.export_price, d.quantity, d.export_price * d.quantity, d.discount ? d.discount + '%' : '', d.total);
        } else {
            row.push(d.quantity);
        }
        row.push(d.quantity * (d.gift_points || 0));
        ws_data.push(row);
    });

    // --- Dòng Tổng cộng ---
    let totalRow = ["", "TỔNG CỘNG", ""];
    if (!hidePrice) {
        totalRow.push("", totalQty, totalRawPrice, "", item.total_amount);
    } else {
        totalRow.push(totalQty);
    }
    totalRow.push(totalPoints);
    ws_data.push(totalRow);

    // --- Footer Chữ ký ---
    ws_data.push([]);
    
    // Dòng thông tin điểm và tổng tiền bằng chữ
    let footerInfo = [`Điểm còn gửi: ${oldPoints} + ${totalPoints} = ${oldPoints + totalPoints}`];
    if(!hidePrice) {
        // Đẩy sang phải để khớp cột
        const spacer = ["", "", "", "", "", "TỔNG THANH TOÁN:", item.total_amount]; 
        // Nối mảng footerInfo với spacer
        footerInfo = footerInfo.concat(spacer.slice(1)); // Hack nhẹ để nối mảng
        // Nhưng cách tốt nhất là gán trực tiếp vào row
        ws_data.push([`Điểm còn gửi: ${oldPoints} + ${totalPoints} = ${oldPoints + totalPoints}`, "", "", "", "", "", "TỔNG THANH TOÁN:", item.total_amount]);
    } else {
        ws_data.push(footerInfo);
    }
    
    ws_data.push([]);
    ws_data.push(["", "Người lập phiếu", "", "", "Người giao hàng", "", "", "Người nhận hàng"]);

    // --- TẠO WORKSHEET ---
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // 3. ÁP DỤNG STYLE (QUAN TRỌNG NHẤT)
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Duyệt qua từng ô để gán style
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cell_address]) continue; // Bỏ qua ô trống không có dữ liệu

            // A. Style cho Tiêu đề lớn "PHIẾU GIAO HÀNG" (Dòng 5 -> index 4)
            if (R === 4) {
                ws[cell_address].s = { font: { bold: true, sz: 16 }, alignment: { horizontal: "center" } };
            }
            // B. Style cho Ngày tháng (Dòng 6 -> index 5)
            else if (R === 5) {
                ws[cell_address].s = { font: { italic: true }, alignment: { horizontal: "center" } };
            }
            // C. Style cho Header Bảng (Dòng 12 -> index 11)
            else if (R === tableHeaderRowIndex) {
                ws[cell_address].s = styleHeaderTable;
            }
            // D. Style cho Nội dung Bảng + Dòng Tổng cộng
            else if (R > tableHeaderRowIndex && R <= tableHeaderRowIndex + item.details.length + 1) {
                // Kiểm tra xem đây là dòng dữ liệu hay dòng tổng cộng
                const isTotalRow = R === (tableHeaderRowIndex + item.details.length + 1);
                
                // Style cơ bản là có viền
                let cellStyle = { ...styleCellBorder };
                
                if (isTotalRow) {
                    cellStyle.font = { bold: true }; // Dòng tổng in đậm
                }

                // Căn lề theo loại dữ liệu
                if (C === 0 || C === 2) { // STT, ĐVT: Căn giữa
                     cellStyle.alignment = { horizontal: "center" };
                } else if (C === 1) { // Tên SP: Căn trái
                     cellStyle.alignment = { horizontal: "left" };
                } else { // Các cột số (Tiền, SL...): Căn phải
                     cellStyle.alignment = { horizontal: "right" };
                }
                
                ws[cell_address].s = cellStyle;
            }
            // E. Style cho Footer Tổng thanh toán (In đậm, Căn phải, Size to)
            else if (R === tableHeaderRowIndex + item.details.length + 3) { // Dòng sau dòng trống
                 if(C >= 6) ws[cell_address].s = { font: { bold: true, sz: 12 }, alignment: { horizontal: "right" } };
            }
        }
    }

    // 4. Cấu hình độ rộng cột (!cols)
    const wscols = !hidePrice ? [
        { wch: 5 },  // A: STT
        { wch: 30 }, // B: Tên SP
        { wch: 8 },  // C: ĐVT
        { wch: 10 }, // D: Đơn giá
        { wch: 6 },  // E: SL
        { wch: 12 }, // F: Tiền hàng
        { wch: 6 },  // G: CK
        { wch: 12 }, // H: Thành tiền
        { wch: 8 }   // I: Điểm
    ] : [
        { wch: 5 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
    ];
    ws['!cols'] = wscols;

    // 5. Cấu hình gộp ô (!merges)
    const lastCol = !hidePrice ? 8 : 4; 
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // NPP Lâm Anh
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // MST
        { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // Địa chỉ
        { s: { r: 0, c: 7 }, e: { r: 0, c: 7 } }, // Label "Số phiếu:"
        { s: { r: 0, c: 8 }, e: { r: 0, c: lastCol } }, // Giá trị Code
        { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } }, // PHIẾU GIAO HÀNG (Căn giữa vùng)
        { s: { r: 5, c: 0 }, e: { r: 5, c: lastCol } }, // Ngày tháng
        { s: { r: 7, c: 1 }, e: { r: 7, c: 5 } }, // Tên Khách
        { s: { r: 7, c: 7 }, e: { r: 7, c: lastCol } }, // SĐT
        { s: { r: 8, c: 1 }, e: { r: 8, c: 5 } }, // Địa chỉ Khách
        { s: { r: 8, c: 7 }, e: { r: 8, c: lastCol } }, // Tên Sale
        { s: { r: 9, c: 1 }, e: { r: 9, c: lastCol } }, // Ghi chú
    ];

    // 6. Xuất file
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PhieuXuat");
    XLSX.writeFile(wb, `Phieu_${item.code}.xlsx`);
  };

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

  const handleSaveExport = async () => {
    if (!newExport.customer_id) return toast.warning('Chọn Khách hàng');
    if (newExport.details.length === 0) return toast.warning('Chưa có sản phẩm');
    if (isSubmitting) return;
    try { 
        setIsSubmitting(true); 
        const payload = { ...newExport, total_amount: calculateTotalAmount() }; 
        await axiosClient.post('/exports', payload);
        
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(DRAFT_CUSTOMER_KEY);
        
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
  const recalculatePrices = (isWholesale) => { 
    setNewExport(prev => { 
        const newDetails = prev.details.map(item => { 
            const product = products.find(p => p._id === item.product_id); 
            if (!product) return item; 
            
            // --- SỬA ĐỔI ---
            const originalPrice = product.export_price || 0;
            
            // Nếu là khách sỉ -> Lấy % từ DB. Khách lẻ -> 0%
            const newDiscount = isWholesale ? (product.discount_percent || 0) : 0;
            
            return { 
                ...item, 
                export_price: originalPrice, // Luôn reset về giá gốc
                discount: newDiscount,       // Cập nhật cột %
                total: calculateLineTotal(item.quantity, originalPrice, newDiscount) // Tính lại tổng
            }; 
        }); 
        return { ...prev, details: newDetails }; 
    }); 
  };
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

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const productName = row[0] ? String(row[0]).trim() : '';
          const quantity = row[1] ? Number(row[1]) : 1;

          if (!productName) continue;

          // Tìm sản phẩm
          const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());

          if (product) {
            // Kiểm tra tồn kho
            if (product.current_stock <= 0) {
                notFoundProducts.push(`${productName} (Hết hàng)`);
                continue;
            }

            const finalPrice = getPriceForProduct(product);
            const finalQuantity = Math.min(quantity, product.current_stock);

            importedDetails.push({
              product_id: product._id,
              product_name_backup: product.name,
              sku: product.sku,
              unit: product.unit,
              quantity: finalQuantity > 0 ? finalQuantity : 1,
              export_price: Math.round(finalPrice), // <--- SỬA: Math.round giá nhập từ excel
              gift_points: product.gift_points || 0,
              total: Math.round((finalQuantity > 0 ? finalQuantity : 1) * finalPrice)
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

  const addProductToExport = (product) => { 
    if (product.current_stock <= 0) { return toast.error(`Sản phẩm ${product.name} đã hết hàng!`); } 
    
    // --- SỬA ĐỔI: Lấy giá gốc và % giảm giá từ DB ---
    
    // 1. Luôn lấy giá gốc (không tự động trừ tiền ở đây nữa)
    const originalPrice = product.export_price || 0; 
    
    // 2. Lấy % giảm giá từ DB (như trong ảnh của bạn là 6.25)
    // Logic: Nếu khách sỉ (apply_wholesale) thì lấy % trong DB, nếu khách lẻ thì 0 (hoặc tùy bạn muốn luôn lấy)
    let autoDiscount = 0;
    if (newExport.apply_wholesale) {
        autoDiscount = product.discount_percent || 0;
    }
    // Lưu ý: Nếu bạn muốn sản phẩm này LUÔN LUÔN giảm giá cho mọi khách, bỏ dòng if check ở trên đi.

    const newItem = { 
        product_id: product._id, 
        product_name_backup: product.name, 
        sku: product.sku, 
        unit: product.unit, 
        quantity: 1, 
        export_price: originalPrice, // Giữ nguyên giá 175.500
        gift_points: product.gift_points || 0,
        
        discount: autoDiscount, // <--- Tự động điền 6.25 vào đây
        
        // Tính thành tiền: Giá gốc * (1 - 6.25%)
        total: calculateLineTotal(1, originalPrice, autoDiscount) 
    }; 
    
    setNewExport({ ...newExport, details: [...newExport.details, newItem] }); 
    setProductSearch(''); 
    setFilteredProducts([]); 
    setIsSearchFocus(true); 
    setActiveIndex(-1); 
  };

  const updateDetail = (index, field, value) => {
    const updatedDetails = [...newExport.details];
    
    // 1. Cho phép gán chuỗi rỗng '' vào state
    const val = value === '' ? '' : Number(value);

    // 2. Kiểm tra tồn kho (Logic riêng của ExportPage)
    if (field === 'quantity') {
      const product = products.find(p => p._id === updatedDetails[index].product_id);
      if (!isViewMode && product && val !== '' && val > product.current_stock) {
        toast.error(`Quá tồn kho! Tối đa: ${product.current_stock}`);
        updatedDetails[index][field] = product.current_stock;
        
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

    // Xử lý khi ô trống
    if (item[field] === '') {
        const updatedDetails = [...newExport.details];
        updatedDetails[index][field] = 0;
        
        const qty = updatedDetails[index].quantity === '' ? 0 : updatedDetails[index].quantity;
        const price = updatedDetails[index].export_price === '' ? 0 : updatedDetails[index].export_price;
        const discount = updatedDetails[index].discount || 0;
        
        updatedDetails[index].total = calculateLineTotal(qty, price, discount);
        setNewExport({ ...newExport, details: updatedDetails });
    }
    
    // SỬA: Xử lý làm tròn Đơn Giá khi người dùng nhập số lẻ rồi bấm ra ngoài
    if (field === 'export_price' && typeof item[field] === 'number') {
         const updatedDetails = [...newExport.details];
         updatedDetails[index][field] = Math.round(item[field]);
         // Tính lại total luôn cho chắc
         const qty = updatedDetails[index].quantity;
         const price = updatedDetails[index][field]; // Giá đã làm tròn
         const discount = updatedDetails[index].discount || 0;
         updatedDetails[index].total = calculateLineTotal(qty, price, discount);
         setNewExport({ ...newExport, details: updatedDetails });
    }
  };

  const removeDetail = (index) => { const updatedDetails = newExport.details.filter((_, i) => i !== index); setNewExport({ ...newExport, details: updatedDetails }); };
  const calculateTotalAmount = () => Math.round(newExport.details.reduce((sum, item) => sum + item.total, 0));
  const calculateTotalPoints = () => newExport.details.reduce((sum, item) => sum + (item.quantity * (item.gift_points || 0)), 0);
  
  const calculateLineTotal = (qty, price, discountPercent) => {
    const finalPrice = price * (1 - (discountPercent / 100));
    return Math.round(qty * finalPrice); 
  };
  
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
  
    if (results.length > 0) {
      setActiveIndex(0);
    } else {
      setActiveIndex(-1);
    }
  }, [productSearch, products, isSearchFocus]);

const handleKeyDown = (e) => {
  if (filteredProducts.length === 0) return;

  if (e.key === 'ArrowDown' || e.key === 'Tab') {
    e.preventDefault(); 
    setActiveIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
  } 
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
  } 
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIndex >= 0 && filteredProducts[activeIndex]) {
      addProductToExport(filteredProducts[activeIndex]);
    } 
    else if (filteredProducts.length > 0) {
      addProductToExport(filteredProducts[0]);
    }
  } 
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
                    <td className="p-4 text-right font-bold text-gray-800">{formatCurrency(item.total_amount)}₫</td>
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div 
            className="bg-white rounded-xl shadow-2xl w-[98%] md:w-[90%] max-w-7xl h-[92vh] flex flex-col transform scale-100"
            style={{ 
               animation: isClosing ? 'fadeOut 0.1s ease-out forwards' : 'fadeIn 0.1s ease-out forwards' 
            }}
          >
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
                          <td className="p-3 text-right"><input id={`quantity-${index}`} onKeyDown={handleQuantityKeyDown} onBlur={() => handleBlur(index, 'quantity')} onFocus={(e) => e.target.select()} type="number" min="0" className="w-16 border border-gray-300 rounded p-1.5 text-right focus:ring-1 focus:ring-blue-500 outline-none font-bold text-gray-800" value={item.quantity} onChange={(e) => updateDetail(index, 'quantity', e.target.value)} onWheel={preventNumberInputScroll} disabled={isViewMode} /></td>
                          <td className="p-3 text-right"><input type="number" onBlur={() => handleBlur(index, 'gift_points')} onFocus={(e) => e.target.select()} className="w-16 border border-gray-300 rounded p-1.5 text-center font-bold focus:ring-1 focus:ring-blue-500 outline-none" value={item.gift_points !== undefined ? item.gift_points : 0} onChange={(e) => updateDetail(index, 'gift_points', e.target.value)} onWheel={preventNumberInputScroll} disabled={isViewMode} /></td>
                          <td className="p-3 text-right"><input type="number" onBlur={() => handleBlur(index, 'export_price')} onFocus={(e) => e.target.select()} className="w-28 border border-gray-300 rounded p-1.5 text-right focus:ring-1 focus:ring-blue-500 outline-none" value={item.export_price} onChange={(e) => updateDetail(index, 'export_price', e.target.value)} onWheel={preventNumberInputScroll} disabled={isViewMode} /></td>
                          <td className="p-3 text-right font-bold text-blue-600">{Math.round(item.total).toLocaleString('vi-VN')}₫</td>
                          <td className="p-3 text-center">{!isViewMode && <button onClick={() => removeDetail(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={18} /></button>}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* --- FOOTER MODAL ĐÃ SỬA: CĂN PHẢI TOÀN BỘ --- */}
            <div className="p-5 border-t bg-white flex justify-end items-center rounded-b-xl shrink-0 gap-6">
              
              {/* 1. TỔNG TIỀN */}
              <div className="text-gray-600 font-medium flex items-center gap-2">
                  <DollarSign className="text-blue-600" /> 
                  Tổng tiền: 
                  <span className="text-2xl font-bold text-red-600 ml-1">
                    {Math.round(calculateTotalAmount()).toLocaleString('vi-VN')}₫
                  </span>
              </div>

              <div className="text-gray-600 font-medium flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <Gift className="text-purple-600" size={20} />
                  
                  {/* LOGIC HIỂN THỊ ĐIỂM */}
                  {(() => {
                      const totalPoints = calculateTotalPoints();
                      let startPoints = 0;
                      let finalPoints = 0;
                      let hasCustomer = false;

                      if (isViewMode && newExport.partner_points_snapshot !== undefined && newExport.partner_points_snapshot !== null) {
                          // A. CHẾ ĐỘ XEM (Có snapshot): Tính ngược
                          hasCustomer = true;
                          finalPoints = newExport.partner_points_snapshot;
                          startPoints = finalPoints - totalPoints;
                      } else if (selectedCustomerInfo) {
                          // B. CHẾ ĐỘ TẠO (Hoặc xem phiếu legacy): Tính xuôi từ điểm hiện tại
                          hasCustomer = true;
                          startPoints = selectedCustomerInfo.saved_points || 0;
                          finalPoints = startPoints + totalPoints;
                      }

                      if (hasCustomer) {
                          return (
                              <>
                                <span className="text-sm">Điểm còn gửi:</span>
                                <span className={`text-xl font-bold ${finalPoints < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                    {finalPoints}
                                </span>
                                <span className="text-sm text-gray-500 font-normal">
                                    ({startPoints} {totalPoints >= 0 ? '+' : ''}{totalPoints})
                                </span>
                              </>
                          );
                      } else {
                          // Chưa chọn khách
                          return (
                              <>
                                <span className="text-sm">Tổng điểm phiếu:</span>
                                <span className={`text-xl font-bold ml-1 ${totalPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {totalPoints > 0 ? '+' : ''}{totalPoints}
                                </span>
                              </>
                          );
                      }
                  })()}
              </div>

              {/* 3. NÚT BẤM */}
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    if (isViewMode && newExport._id) {
                      handleUpdateNote();
                    }
                    handleCloseModal();
                  }} 
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                >
                  Đóng
                </button>
                
                {!isViewMode && (
                  <button 
                      onClick={handleSaveExport} 
                      className={`px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 shadow-lg transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                      {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
                      {isSubmitting ? 'Đang lưu...' : 'Lưu phiếu'}
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

export default ExportPage;