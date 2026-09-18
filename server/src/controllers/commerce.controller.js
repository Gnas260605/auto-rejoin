import { sendSuccess, sendError } from "../utils/response.js";

export class CommerceController {
  constructor(commerceService) {
    this.service = commerceService;
  }

  getCatalog = async (_req, res, next) => {
    try {
      const products = await this.service.getCatalog();
      sendSuccess(res, { products });
    } catch (err) {
      next(err);
    }
  };

  getProductDetails = async (req, res, next) => {
    try {
      const product = await this.service.getProductDetails(req.params.slug);
      sendSuccess(res, { product });
    } catch (err) {
      next(err);
    }
  };

  createOrder = async (req, res, next) => {
    try {
      const { items, customerEmail, customerName, customerPhone, paymentMethod } = req.body;
      const order = await this.service.createOrder({
        items,
        customerEmail,
        customerName,
        customerPhone,
        paymentMethod
      });
      sendSuccess(res, order, 201);
    } catch (err) {
      next(err);
    }
  };

  getOrderStatus = async (req, res, next) => {
    try {
      const order = await this.service.getOrderStatus(req.params.orderCode);
      sendSuccess(res, { order });
    } catch (err) {
      next(err);
    }
  };

  submitCardTopup = async (req, res, next) => {
    try {
      const result = await this.service.submitCardTopup(req.body);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  getRecentActivity = async (_req, res, next) => {
    try {
      const activities = await this.service.getRecentActivity();
      sendSuccess(res, { activities });
    } catch (err) {
      next(err);
    }
  };

  // --- Admin Methods ---

  adminListProducts = async (_req, res, next) => {
    try {
      const products = await this.service.getCatalog();
      sendSuccess(res, { products });
    } catch (err) {
      next(err);
    }
  };

  adminCreateProduct = async (req, res, next) => {
    try {
      const id = await this.service.commerceRepo.createProduct(req.body);
      sendSuccess(res, { id, message: "Product created successfully" }, 201);
    } catch (err) {
      next(err);
    }
  };

  adminUpdateProduct = async (req, res, next) => {
    try {
      await this.service.commerceRepo.updateProduct(req.params.id, req.body);
      sendSuccess(res, { message: "Product updated successfully" });
    } catch (err) {
      next(err);
    }
  };

  adminDeleteProduct = async (req, res, next) => {
    try {
      await this.service.commerceRepo.deleteProduct(req.params.id);
      sendSuccess(res, { message: "Product deleted successfully" });
    } catch (err) {
      next(err);
    }
  };

  adminCreateVariant = async (req, res, next) => {
    try {
      const id = await this.service.commerceRepo.createVariant(req.body);
      sendSuccess(res, { id, message: "Variant created successfully" }, 201);
    } catch (err) {
      next(err);
    }
  };

  adminUpdateVariant = async (req, res, next) => {
    try {
      await this.service.commerceRepo.updateVariant(req.params.id, req.body);
      sendSuccess(res, { message: "Variant updated successfully" });
    } catch (err) {
      next(err);
    }
  };

  adminDeleteVariant = async (req, res, next) => {
    try {
      await this.service.commerceRepo.deleteVariant(req.params.id);
      sendSuccess(res, { message: "Variant deleted successfully" });
    } catch (err) {
      next(err);
    }
  };

  adminListInventory = async (req, res, next) => {
    try {
      const { productId, status } = req.query;
      const items = await this.service.commerceRepo.listInventory(productId, status);
      sendSuccess(res, { items });
    } catch (err) {
      next(err);
    }
  };

  adminAddInventoryBatch = async (req, res, next) => {
    try {
      const { productId, variantId, rawKeys } = req.body;
      const result = await this.service.addInventoryBatch({ productId, variantId, rawKeys });
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  adminListOrders = async (req, res, next) => {
    try {
      const { limit, offset, status } = req.query;
      const orders = await this.service.commerceRepo.listAdminOrders({ limit, offset, status });
      sendSuccess(res, { orders });
    } catch (err) {
      next(err);
    }
  };
}
