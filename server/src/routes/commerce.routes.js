import { Router } from "express";

export function createCommerceRouter({ controller, rateLimits }) {
  const router = Router();

  // Public Store endpoints
  router.get("/store/products", controller.getCatalog);
  router.get("/store/products/:slug", controller.getProductDetails);
  router.post("/store/orders", controller.createOrder);
  router.get("/store/orders/:orderCode", controller.getOrderStatus);
  router.post("/store/topup/card", controller.submitCardTopup);
  router.get("/store/recent-activity", controller.getRecentActivity);

  return router;
}

export function createCommerceAdminRouter({ controller, authMiddleware, rateLimits }) {
  const router = Router();
  router.use(authMiddleware);

  router.get("/products", controller.adminListProducts);
  router.post("/products", controller.adminCreateProduct);
  router.put("/products/:id", controller.adminUpdateProduct);
  router.delete("/products/:id", controller.adminDeleteProduct);

  router.post("/variants", controller.adminCreateVariant);
  router.put("/variants/:id", controller.adminUpdateVariant);
  router.delete("/variants/:id", controller.adminDeleteVariant);

  router.get("/inventory", controller.adminListInventory);
  router.post("/inventory/batch", controller.adminAddInventoryBatch);

  router.get("/orders", controller.adminListOrders);

  return router;
}
