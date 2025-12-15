import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  DollarSign, ShoppingBag, Package, TrendingUp, AlertCircle, Menu, NotebookPen 
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import axiosClient from '../api/axiosClient';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const { 
    globalCache,       
    refreshFlags,      
    updateCache,
    isExpanded,       
    setIsExpanded     
  } = useOutletContext();

  const [data, setData] = useState(globalCache?.dashboard || null);
  const [loading, setLoading] = useState(!globalCache?.dashboard);

  // --- STATE GHI CHÚ ---
  const [note, setNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Hàm xử lý lưu ghi chú
  const handleNoteChange = (e) => {
    const value = e.target.value;
    setNote(value);
    setIsSavingNote(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        await axiosClient.post('/dashboard/note', { note: value });
        setIsSavingNote(false);
      } catch (error) {
        console.error("Lỗi lưu note:", error);
        setIsSavingNote(false);
      }
    }, 1000); 
  };

  useEffect(() => {
    const initDashboard = async () => {
      if (!globalCache?.dashboard || refreshFlags?.dashboard) {
        try {
          setLoading(true);
          const res = await axiosClient.get('/dashboard');
          setData(res);
          updateCache('dashboard', res); 
        } catch (error) {
          console.error("Lỗi tải dashboard:", error);
        } finally {
          setLoading(false);
        }
      }

      try {
        const noteRes = await axiosClient.get('/dashboard/note');
        if (noteRes && noteRes.note !== undefined) {
            setNote(noteRes.note);
        }
      } catch (error) {
        console.error("Lỗi tải note:", error);
      }
    };

    initDashboard();
  }, [refreshFlags?.dashboard]);

  if (loading) return <div className="p-6 text-gray-500">Đang cập nhật số liệu...</div>;
  if (!data) return <div className="p-6">Không có dữ liệu</div>;

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '0 ₫';
    return Math.round(val).toLocaleString('vi-VN') + ' ₫';
  };

  // --- CẤU HÌNH BIỂU ĐỒ ---
  const lineData = {
    labels: data.trend.map(d => d._id),
    datasets: [{
      label: 'Doanh thu',
      data: data.trend.map(d => d.revenue),
      borderColor: 'rgb(37, 99, 235)',
      backgroundColor: 'rgba(37, 99, 235, 0.5)',
      tension: 0,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  };

  const productData = {
    labels: data.topProducts.map(p => p.name),
    datasets: [{
      data: data.topProducts.map(p => p.value),
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    }]
  };

  const customerData = {
    labels: data.topCustomers.map(c => c.name),
    datasets: [{
      data: data.topCustomers.map(c => c.value),
      backgroundColor: ['#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6'],
    }]
  };

  return (
    <div className="p-0 pb-20"> 
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3 self-start md:self-center">
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-gray-100 text-black-600 transition-colors">
                  <Menu size={24} />
              </button>
              <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap">Tổng quan kinh doanh</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto"></div>
      </div>

      {/* NỘI DUNG CHÍNH */}
      <div className="space-y-6">
        {/* Hàng 1: Thẻ thống kê */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Doanh thu tháng này" value={formatCurrency(data.summary.revenue)} icon={<DollarSign />} color="text-blue-600" bg="bg-blue-100" growth={data.summary.revenueGrowth} growthLabel="so với tháng trước"/>
          <StatCard title="Lợi nhuận tháng này" value={formatCurrency(data.summary.profit)} icon={<TrendingUp />} color="text-green-600" bg="bg-green-100" growth={data.summary.profitGrowth} growthLabel="so với tháng trước"/>
          <StatCard title="Đơn hàng tháng này" value={data.summary.orders} icon={<ShoppingBag />} color="text-purple-600" bg="bg-purple-100" customSubText={`Tháng trước: ${data.summary.ordersLastMonth} đơn`} />
          <StatCard title="Giá trị tồn kho" value={formatCurrency(data.summary.stockValue)} icon={<Package />} color="text-orange-600" bg="bg-orange-100" growth={data.summary.stockValueGrowth} growthLabel="so với tháng trước"/>
        </div>

        {/* Hàng 2: Biểu đồ Doanh thu & GHI CHÚ (ĐÃ ĐỔI CHỖ) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border">
            <h3 className="font-bold text-gray-700 mb-4">Xu hướng doanh thu</h3>
            <div className="h-64">
              <Line data={lineData} options={{ responsive: true, maintainAspectRatio: false,plugins: {legend: {display: false}}}}/>
            </div>
          </div>

          {/* Widget Ghi chú chuyển lên đây */}
          <div className="bg-yellow-50 p-5 rounded-xl shadow-sm border border-yellow-200 flex flex-col h-80 lg:h-auto transition-colors">
            <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
               <NotebookPen size={20} className="text-yellow-600"/> Ghi chú nhanh
            </h3>
            <textarea 
              className="flex-1 w-full bg-transparent border-none outline-none resize-none text-gray-700 placeholder-yellow-800/50 text-sm font-medium leading-relaxed"
              placeholder="- Gọi lại cho khách A...&#10;- Nhập thêm hàng sữa..."
              value={note}
              onChange={handleNoteChange}
            ></textarea>
            <div className="text-right mt-2 h-4">
                <span className={`text-[10px] italic transition-opacity duration-300 ${isSavingNote ? 'text-blue-600 opacity-100' : 'text-green-600 opacity-100'}`}>
                    {isSavingNote ? 'Đang lưu...' : 'Đã đồng bộ'}
                </span>
            </div>
          </div>
        </div>

        {/* Hàng 3: Top Sản phẩm, Khách hàng & CÔNG NỢ (ĐÃ ĐỔI CHỖ) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <h3 className="font-bold text-gray-700 mb-4">Top Sản phẩm bán chạy</h3>
            <div className="h-64 flex justify-center">
              <Doughnut data={productData} options={{ maintainAspectRatio: false, plugins: {legend: {display: false }}}} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border">
            <h3 className="font-bold text-gray-700 mb-4">Top Khách hàng thân thiết</h3>
            <div className="h-64 flex justify-center">
              <Doughnut data={customerData} options={{ maintainAspectRatio: false,plugins: {legend: {display: false }}}} />
            </div>
          </div>

          {/* Widget Công nợ chuyển xuống đây */}
          <div className="bg-white p-5 rounded-xl shadow-sm border flex flex-col">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" /> Công nợ cần thu
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 max-h-64">
              {/* BƯỚC LỌC TRỰC TIẾP TẠI FRONTEND */}
              {data.debt.filter(d => d.remaining > 0).length === 0 ? (
                <p className="text-gray-500 text-sm">Không có nợ đến hạn.</p> 
              ) : (
                data.debt
                  .filter(d => d.remaining > 0) // <--- CHỈ HIỂN THỊ NẾU > 0
                  .map((d, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{d.customer}</p>
                        <p className="text-xs text-gray-500">
                          Hạn: {d.dueDate ? new Date(d.dueDate).toLocaleDateString('vi-VN') : '---'}
                        </p>
                      </div>
                      <span className="font-bold text-red-600 text-sm">
                        {d.remaining?.toLocaleString()} đ
                      </span>
                    </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, bg, growth, growthLabel, customSubText }) => {
  const isPositive = parseFloat(growth) >= 0;
  const growthColor = isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  const growthIcon = isPositive ? '↑' : '↓';

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border flex flex-col justify-between h-full">
        <div className="flex items-center gap-4 mb-2">
            <div className={`p-3 rounded-full ${bg} ${color}`}>{icon}</div>
            <div>
                <p className="text-sm text-gray-500">{title}</p>
                <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
        
        {/* LOGIC MỚI: Ưu tiên hiển thị customSubText nếu có */}
        {customSubText ? (
            <div className="mt-2 px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 w-fit text-gray-600 bg-gray-100">
                {customSubText}
            </div>
        ) : growth !== undefined && (
            <div className={`mt-2 px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 w-fit ${growthColor}`}>
                <span>{growthIcon} {Math.abs(growth)}%</span>
                <span className="text-gray-500 font-normal ml-1">{growthLabel}</span>
            </div>
        )}
    </div>
  );
};

export default Dashboard;
