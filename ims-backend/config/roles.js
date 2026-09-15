// Shared role-group constants for route-level authorization. Previously each
// routes/*.js file redefined its own copy of these same arrays (sometimes
// under a different local name like READ_ROLES/WRITE_ROLES/SALE_ROLES) -
// centralized here so the underlying role sets only need to change in one
// place. Route files still import under whatever local alias reads best for
// that file's routes.
const ADMIN_ROLES = ['ShopOwner', 'SuperAdmin'];
const SALESMAN_ROLES = ['ShopKeeper', 'ShopOwner', 'SuperAdmin'];
const PRODUCT_ENTRY_ROLES = ['Contentuser', 'ShopOwner', 'SuperAdmin'];
const ALL_STAFF_ROLES = ['ShopKeeper', 'Contentuser', 'ShopOwner', 'SuperAdmin'];

module.exports = {
  ADMIN_ROLES,
  SALESMAN_ROLES,
  PRODUCT_ENTRY_ROLES,
  ALL_STAFF_ROLES,
};
