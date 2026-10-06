import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_ENTITLEMENTS, resolvePlanEntitlements } from "../src/constants/license.js";

test("Shop plans (plan_*) get full entitlements", () => {
  for (const plan of ["plan_1day", "plan_7days", "plan_30days", "plan_lifetime", "plan_moi_them_sau"]) {
    assert.deepEqual(resolvePlanEntitlements(plan), PLAN_ENTITLEMENTS.business, plan);
  }
});

test("Known tool plans keep their own entitlements", () => {
  assert.deepEqual(resolvePlanEntitlements("standard"), PLAN_ENTITLEMENTS.standard);
  assert.deepEqual(resolvePlanEntitlements("pro"), PLAN_ENTITLEMENTS.pro);
});

test("Unknown plans fall back to basic", () => {
  assert.deepEqual(resolvePlanEntitlements("xyz"), PLAN_ENTITLEMENTS.basic);
  assert.deepEqual(resolvePlanEntitlements(null), PLAN_ENTITLEMENTS.basic);
});
