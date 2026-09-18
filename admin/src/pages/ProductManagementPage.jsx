import React, { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Package,
  Key,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
  Download,
  Trash2,
  Edit,
  Database,
  Search,
  ExternalLink,
  ChevronRight,
  Image,
  Tag
} from "lucide-react";

export function ProductManagementPage() {
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("products");
  
  // Edit product modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    thumbnailUrl: "",
    badge: "",
    shortDescription: "",
    category: "tools"
  });

  // Batch upload key modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchTargetProductId, setBatchTargetProductId] = useState("");
  const [batchTargetVariantId, setBatchTargetVariantId] = useState("");
  const [batchKeysText, setBatchKeysText] = useState("");
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchMessage, setBatchMessage] = useState(null);

  // New Product Modal
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    slug: "",
    type: "LICENSE",
    category: "tools",
    shortDescription: "",
    thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    badge: "Mới"
  });

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/store/products");
      const data = await res.json();
      if (data.ok) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch("/api/v1/admin/commerce/inventory");
      const data = await res.json();
      if (data.ok) {
        setInventory(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
    }
  };

  useEffect(() => {
    fetchCatalog();
    fetchInventory();
  }, []);

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setEditForm({
      name: p.name || "",
      thumbnailUrl: p.thumbnailUrl || "",
      badge: p.badge || "",
      shortDescription: p.shortDescription || "",
      category: p.category || "tools"
    });
  };

  const handleSaveProductEdit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const res = await fetch(`/api/v1/admin/commerce/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.ok) {
        setEditingProduct(null);
        fetchCatalog();
      } else {
        alert(data.message || "Lỗi khi cập nhật sản phẩm");
      }
    } catch (err) {
      alert("Lỗi kết nối server");
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/admin/commerce/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProductForm)
      });
      const data = await res.json();
      if (data.ok) {
        setShowNewProductModal(false);
        fetchCatalog();
      } else {
        alert(data.message || "Lỗi khi tạo sản phẩm");
      }
    } catch (err) {
      alert("Lỗi kết nối server");
    }
  };

  const handleBatchUploadKeys = async (e) => {
    e.preventDefault();
    if (!batchTargetProductId || !batchKeysText.trim()) return;

    try {
      setBatchSubmitting(true);
      setBatchMessage(null);
      const rawKeys = batchKeysText
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/v1/admin/commerce/inventory/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: Number(batchTargetProductId),
          variantId: batchTargetVariantId ? Number(batchTargetVariantId) : null,
          rawKeys
        })
      });

      const data = await res.json();
      if (data.ok) {
        setBatchMessage({ type: "success", text: `Đã nạp thành công ${data.addedCount} keys vào kho mã hóa AES-256!` });
        setBatchKeysText("");
        fetchCatalog();
        fetchInventory();
        setTimeout(() => setShowBatchModal(false), 2000);
      } else {
        setBatchMessage({ type: "error", text: data.message || "Lỗi khi nạp key" });
      }
    } catch (err) {
      setBatchMessage({ type: "error", text: "Lỗi kết nối server" });
    } finally {
      setBatchSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight font-heading">
              Quản Lý Sản Phẩm & Đổi Ảnh Sản Phẩm
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase">
              Admin Catalog
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Chỉnh sửa hình ảnh đại diện, giá bán, danh mục hoặc tạo thêm sản phẩm số mới theo ý bạn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchCatalog();
              fetchInventory();
            }}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowNewProductModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold rounded-xl text-xs border border-slate-700 transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Thêm Sản Phẩm Mới</span>
          </button>

          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all"
          >
            <Key className="w-4 h-4" />
            <span>Nạp Key Vào Kho</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "products"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Danh Mục Sản Phẩm ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "inventory"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Kho Serial Key Mã Hóa ({inventory.length})</span>
        </button>
      </div>

      {/* Tab 1: Products */}
      {activeTab === "products" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Image Banner */}
                <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group">
                  <img
                    src={product.thumbnailUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80"}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    {product.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/80 text-slate-950">
                        {product.badge}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/80 text-emerald-300 border border-slate-700">
                      {product.type}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {product.category}
                  </span>
                  <h3 className="text-sm font-bold text-white line-clamp-1">
                    {product.name}
                  </h3>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {product.shortDescription}
                </p>

                {/* Variants List */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                    Các gói giá hiện tại:
                  </span>
                  {product.variants?.map((variant) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                    >
                      <span className="text-slate-300 truncate pr-2 font-medium">
                        {variant.name}
                      </span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {Number(variant.price).toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  Slug: {product.slug}
                </span>

                <button
                  onClick={() => handleOpenEdit(product)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Sửa Ảnh & Thông Tin</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Inventory */}
      {activeTab === "inventory" && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Danh Sách Key Trong Kho (Đã Mã Hóa AES-256-GCM)
            </h3>
            <span className="text-xs text-slate-400">
              Tổng: {inventory.length} keys
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">ID</th>
                  <th className="p-3.5">Sản Phẩm</th>
                  <th className="p-3.5">Key (Masked)</th>
                  <th className="p-3.5">Trạng Thái</th>
                  <th className="p-3.5">Ngày Nhập</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Chưa có serial key nào trong kho.
                    </td>
                  </tr>
                ) : (
                  inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 text-slate-400">#{item.id}</td>
                      <td className="p-3.5 font-sans font-bold text-white">
                        {item.productName || `Product #${item.productId}`}
                      </td>
                      <td className="p-3.5 text-emerald-400 font-bold">
                        ••••-••••-••••-{item.secretLast4}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.status === "AVAILABLE"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {item.status === "AVAILABLE" ? "Sẵn sàng" : "Đã bán"}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Product & Thumbnail Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-[#09101F] border border-slate-800 p-6 space-y-4 shadow-2xl shadow-emerald-500/10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Edit className="w-5 h-5" />
                <h3 className="text-sm text-white font-bold">Sửa Thông Tin & Đổi Ảnh</h3>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">
                  Tên Sản Phẩm:
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">
                  Đường Dẫn Link Ảnh Đại Diện (Image URL):
                </label>
                <input
                  type="text"
                  value={editForm.thumbnailUrl}
                  onChange={(e) => setEditForm({ ...editForm, thumbnailUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono outline-none focus:border-emerald-500"
                />
                {editForm.thumbnailUrl && (
                  <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-800 mt-2">
                    <img src={editForm.thumbnailUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold uppercase text-[10px]">
                    Badge (Nhãn nổi bật):
                  </label>
                  <input
                    type="text"
                    value={editForm.badge}
                    onChange={(e) => setEditForm({ ...editForm, badge: e.target.value })}
                    placeholder="Bán Chạy / Hot"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold uppercase text-[10px]">
                    Danh Mục:
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-emerald-500"
                  >
                    <option value="tools">Tool Bản Quyền (tools)</option>
                    <option value="services">Dịch Vụ Reset (services)</option>
                    <option value="scripts">Script VIP (scripts)</option>
                    <option value="configs">Cấu Hình (configs)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">
                  Mô Tả Ngắn:
                </label>
                <textarea
                  rows={2}
                  value={editForm.shortDescription}
                  onChange={(e) => setEditForm({ ...editForm, shortDescription: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-md shadow-emerald-500/20"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-[#09101F] border border-slate-800 p-6 space-y-4 shadow-2xl shadow-emerald-500/10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Plus className="w-5 h-5" />
                <h3 className="text-sm text-white font-bold">Thêm Sản Phẩm Mới Vào Shop</h3>
              </div>
              <button
                onClick={() => setShowNewProductModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Tên Sản Phẩm:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Tool Auto Rejoin VIP 2"
                  value={newProductForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    setNewProductForm({ ...newProductForm, name, slug });
                  }}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Slug (URL Định Danh):</label>
                <input
                  type="text"
                  value={newProductForm.slug}
                  onChange={(e) => setNewProductForm({ ...newProductForm, slug: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Link Ảnh Đại Diện (Image URL):</label>
                <input
                  type="text"
                  value={newProductForm.thumbnailUrl}
                  onChange={(e) => setNewProductForm({ ...newProductForm, thumbnailUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Mô Tả Ngắn:</label>
                <textarea
                  rows={2}
                  value={newProductForm.shortDescription}
                  onChange={(e) => setNewProductForm({ ...newProductForm, shortDescription: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewProductModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-md shadow-emerald-500/20"
                >
                  Tạo Sản Phẩm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Import Keys Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#09101F] border border-slate-800 p-6 space-y-4 shadow-2xl shadow-emerald-500/10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Key className="w-5 h-5" />
                <h3 className="text-sm text-white font-bold">Nạp Hàng Loạt Serial Key Vào Kho</h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {batchMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  batchMessage.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                }`}
              >
                {batchMessage.text}
              </div>
            )}

            <form onSubmit={handleBatchUploadKeys} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase text-[10px]">
                  Chọn Sản Phẩm Cần Nạp Key:
                </label>
                <select
                  value={batchTargetProductId}
                  onChange={(e) => {
                    setBatchTargetProductId(e.target.value);
                    setBatchTargetVariantId("");
                  }}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium outline-none focus:border-emerald-500"
                >
                  <option value="">-- Chọn sản phẩm --</option>
                  {products
                    .filter((p) => p.type === "DIGITAL_KEY" || p.type === "LICENSE")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold uppercase text-[10px]">
                  Danh Sách Key (Mỗi key trên 1 dòng):
                </label>
                <textarea
                  rows={6}
                  value={batchKeysText}
                  onChange={(e) => setBatchKeysText(e.target.value)}
                  placeholder={"KEY-XXXX-XXXX\nKEY-YYYY-YYYY\nKEY-ZZZZ-ZZZZ"}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={batchSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  {batchSubmitting ? "Đang mã hóa & nạp..." : "Xác Nhận Nạp Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
