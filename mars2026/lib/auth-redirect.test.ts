import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AUTH_RETURN_TO,
  returnToForRequest,
  safeReturnTo,
} from "./auth-redirect";

test("safeReturnTo keeps same-site paths, queries, and hashes", () => {
  assert.equal(
    safeReturnTo("/account/orders?view=recent#order-12"),
    "/account/orders?view=recent#order-12",
  );
});

test("safeReturnTo rejects external and malformed destinations", () => {
  assert.equal(safeReturnTo("https://example.com/orders"), DEFAULT_AUTH_RETURN_TO);
  assert.equal(safeReturnTo("//example.com/orders"), DEFAULT_AUTH_RETURN_TO);
  assert.equal(safeReturnTo("/\\example.com/orders"), DEFAULT_AUTH_RETURN_TO);
  assert.equal(safeReturnTo(["/account/orders"]), DEFAULT_AUTH_RETURN_TO);
  assert.equal(safeReturnTo(undefined), DEFAULT_AUTH_RETURN_TO);
});

test("safeReturnTo accepts an absolute URL only for an explicitly allowed origin", () => {
  assert.equal(
    safeReturnTo(
      "https://mars.example/account/orders?view=recent#order-12",
      "https://mars.example",
    ),
    "/account/orders?view=recent#order-12",
  );
  assert.equal(
    safeReturnTo("https://attacker.example/account/orders", "https://mars.example"),
    DEFAULT_AUTH_RETURN_TO,
  );
});

test("returnToForRequest preserves the requested path and query", () => {
  assert.equal(
    returnToForRequest("/account/orders", "?view=recent"),
    "/account/orders?view=recent",
  );
});
