import test from "node:test";
import assert from "node:assert/strict";
import { RbacRepository } from "../src/repositories/rbac.repository.js";
import { RbacService } from "../src/services/rbac.service.js";

test("RbacService: role permissions hierarchy and checking", async () => {
  const rbacRepo = new RbacRepository(null);
  const rbacService = new RbacService({ rbacRepository: rbacRepo });

  // SUPER_ADMIN has wildcard permissions
  assert.equal(await rbacService.hasPermission("SUPER_ADMIN", "catalog.write"), true);
  assert.equal(await rbacService.hasPermission("SUPER_ADMIN", "staff.manage"), true);
  assert.equal(await rbacService.hasPermission("SUPER_ADMIN", "anything.custom"), true);

  // ADMIN has system management permissions
  assert.equal(await rbacService.hasPermission("ADMIN", "catalog.write"), true);
  assert.equal(await rbacService.hasPermission("ADMIN", "payments.reconcile"), true);
  assert.equal(await rbacService.hasPermission("ADMIN", "users.ban"), true);

  // STAFF has ticket and order processing permissions, but NOT staff.manage or settings.manage
  assert.equal(await rbacService.hasPermission("STAFF", "tickets.process"), true);
  assert.equal(await rbacService.hasPermission("STAFF", "tickets.assign"), true);
  assert.equal(await rbacService.hasPermission("STAFF", "staff.manage"), false);
  assert.equal(await rbacService.hasPermission("STAFF", "settings.manage"), false);

  // CUSTOMER has only catalog.read, orders.read, tickets.read
  assert.equal(await rbacService.hasPermission("CUSTOMER", "catalog.read"), true);
  assert.equal(await rbacService.hasPermission("CUSTOMER", "catalog.write"), false);
  assert.equal(await rbacService.hasPermission("CUSTOMER", "users.ban"), false);
  assert.equal(await rbacService.hasPermission("CUSTOMER", "blindbox.configure"), false);
});

test("RbacService: getRolePermissions returns full list", async () => {
  const rbacRepo = new RbacRepository(null);
  const rbacService = new RbacService({ rbacRepository: rbacRepo });

  const staffPerms = await rbacService.getRolePermissions("STAFF");
  assert.ok(Array.isArray(staffPerms));
  assert.ok(staffPerms.includes("tickets.process"));
  assert.ok(!staffPerms.includes("staff.manage"));

  const customerPerms = await rbacService.getRolePermissions("CUSTOMER");
  assert.ok(customerPerms.includes("catalog.read"));
  assert.ok(!customerPerms.includes("catalog.write"));
});
