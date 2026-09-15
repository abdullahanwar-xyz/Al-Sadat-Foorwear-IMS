export type UserRole = "SuperAdmin" | "ShopOwner" | "Contentuser" | "ShopKeeper";

// Role groups shared by route guards (App.tsx) and nav filtering (sidebar.tsx) -
// previously redefined identically in both places.
export const ADMIN_ROLES = ["ShopOwner", "SuperAdmin"];
export const SALESMAN_ROLES = ["ShopKeeper", "ShopOwner", "SuperAdmin"];
export const PRODUCT_ENTRY_ROLES = ["Contentuser", "ShopOwner", "SuperAdmin"];

// Where each role lands after login / when redirected away from a page it
// can't access.
export function getLandingPathForRole(role?: string): string {
  if (role === "ShopKeeper") return "/record-sale";
  if (role === "Contentuser") return "/inventory";
  return "/";
}
