export class RbacRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getRolePermissions(roleName) {
    const [rows] = await this.pool.query(
      `SELECT p.code
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN roles r ON rp.role_id = r.id
       WHERE r.name = ?`,
      [roleName]
    );
    return rows.map((r) => r.code);
  }

  async listAllRolesWithPermissions() {
    const [roles] = await this.pool.query(`SELECT id, name, description FROM roles ORDER BY id ASC`);
    const [mappings] = await this.pool.query(
      `SELECT r.name AS roleName, p.code AS permissionCode
       FROM role_permissions rp
       INNER JOIN roles r ON rp.role_id = r.id
       INNER JOIN permissions p ON rp.permission_id = p.id`
    );

    const permMap = new Map();
    for (const m of mappings) {
      if (!permMap.has(m.roleName)) {
        permMap.set(m.roleName, []);
      }
      permMap.get(m.roleName).push(m.permissionCode);
    }

    return roles.map((r) => ({
      ...r,
      permissions: permMap.get(r.name) || []
    }));
  }
}
