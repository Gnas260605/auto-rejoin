export class RbacService {
  constructor({ rbacRepository }) {
    this.rbacRepo = rbacRepository;
  }

  // Predefined permission maps for fast in-memory fallback
  static DEFAULT_ROLE_PERMISSIONS = {
    CUSTOMER: ["catalog.read", "orders.read", "tickets.read", "wallet.read", "wallet.debit"],
    STAFF: [
      "catalog.read",
      "inventory.read",
      "orders.read",
      "tickets.read",
      "tickets.assign",
      "tickets.process",
      "users.read",
      "wallet.read"
    ],
    ADMIN: [
      "catalog.read",
      "catalog.write",
      "inventory.read",
      "inventory.write",
      "orders.read",
      "orders.update",
      "orders.refund",
      "tickets.read",
      "tickets.assign",
      "tickets.process",
      "payments.read",
      "payments.reconcile",
      "blindbox.configure",
      "users.read",
      "users.update",
      "users.ban",
      "audit.read",
      "wallet.read",
      "wallet.credit",
      "wallet.debit"
    ],
    SUPER_ADMIN: [
      "catalog.read",
      "catalog.write",
      "inventory.read",
      "inventory.write",
      "orders.read",
      "orders.update",
      "orders.refund",
      "tickets.read",
      "tickets.assign",
      "tickets.process",
      "payments.read",
      "payments.reconcile",
      "blindbox.configure",
      "users.read",
      "users.update",
      "users.ban",
      "staff.manage",
      "settings.manage",
      "audit.read",
      "wallet.read",
      "wallet.credit",
      "wallet.debit"
    ]
  };

  async getPermissionsForRole(role) {
    if (this.rbacRepo) {
      try {
        const perms = await this.rbacRepo.getRolePermissions(role);
        if (perms && perms.length > 0) return perms;
      } catch (err) {
        // Fallback to static mapping if table not yet populated
      }
    }
    return RbacService.DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  async getRolePermissions(role) {
    return this.getPermissionsForRole(role);
  }

  async hasPermission(role, requiredPermission) {
    if (role === "SUPER_ADMIN") return true;
    const permissions = await this.getPermissionsForRole(role);
    return permissions.includes(requiredPermission);
  }
}

