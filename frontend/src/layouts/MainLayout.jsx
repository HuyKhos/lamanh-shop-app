import React, { useState } from 'react';
import { Link, useLocation, useOutlet } from 'react-router-dom'; // Thêm useOutlet
import { ChartNoAxesCombined, Package, ArrowDownToLine, ArrowUpFromLine, Users, Wallet, Boxes } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MainLayout = () => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);

  // --- KHO DỮ LIỆU (Giữ nguyên) ---
  const [globalCache, setGlobalCache] = useState({
    dashboard: null, products: null, imports: null, exports: null, partners: null, debts: null
  });

  const [refreshFlags, setRefreshFlags] = useState({
    dashboard: true, products: true, imports: true, exports: true, partners: true, debts: true
  });

  const updateCache = (key, data) => {
    setGlobalCache(prev => ({ ...prev, [key]: data }));
    setRefreshFlags(prev => ({ ...prev, [key]: false }));
  };

  const triggerRefresh = (keys) => {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    setRefreshFlags(prev => {
      const nextState = { ...prev };
      keysArray.forEach(k => nextState[k] = true);
      return nextState;
    });
  };

  // Gom dữ liệu cần truyền xuống các trang con
  const contextValue = {
    isExpanded, setIsExpanded,
    globalCache, refreshFlags, updateCache, triggerRefresh
  };

  // QUAN TRỌNG: Lấy nội dung trang hiện tại và truyền context vào
  // Thay thế cho việc dùng thẻ <Outlet context={...} />
  const currentOutlet = useOutlet(contextValue);

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <ChartNoAxesCombined size={20} /> },
    { path: '/products', label: 'Sản phẩm', icon: <Package size={20} /> },
    { path: '/imports', label: 'Nhập kho', icon: <ArrowDownToLine size={20} /> },
    { path: '/exports', label: 'Xuất kho', icon: <ArrowUpFromLine size={20} /> },
    { path: '/partners', label: 'Đối tác', icon: <Users size={20} /> },
    { path: '/debts', label: 'Công nợ', icon: <Wallet size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* SIDEBAR (Giữ nguyên) */}
      <div className={`${isExpanded ? 'w-56' : 'w-20'} bg-white shadow-md flex flex-col shrink-0 transition-all duration-300 ease-in-out z-20 relative`}> 
        <div className="p-5 border-b flex items-center justify-center gap-2 overflow-hidden h-[70px]">
          <span className="text-gray-600 shrink-0"><Boxes size={35} /></span>
          <h1 className={`text-2xl font-bold text-gray-800 whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>LÂM ANH</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} title={!isExpanded ? item.label : ''} 
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'} ${!isExpanded ? 'justify-center' : ''}`}
              >
                {item.icon}
                <span className={`text-sm font-medium whitespace-nowrap transition-all duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
            <div className="max-w-7xl mx-auto h-full">
                
                {/* HIỆU ỨNG CHUYỂN TRANG */}
                {/* mode="wait": Chờ trang cũ biến mất xong mới hiện trang mới */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname} // Dựa vào đường dẫn để biết khi nào đổi trang
                        
                        // Hiệu ứng
                        initial={{ opacity: 0}}  // Vào: Mờ & thấp
                        animate={{ opacity: 1}}   // Hiện: Rõ & đúng chỗ
                        exit={{ opacity: 0}}    // Ra: Mờ & bay lên
                        
                        // Thời gian: 0.3s (nhanh gọn)
                        transition={{ duration: 0.1, ease: "easeInOut" }}
                        
                        className="h-full w-full"
                    >
                         {/* Render trang con đã được gắn context */}
                         {currentOutlet}
                    </motion.div>
                </AnimatePresence>

            </div>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;