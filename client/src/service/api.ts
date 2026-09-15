import axios from "axios";

// Base API URL configuration
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Resolve a server-relative path (e.g. an uploaded image URL) to an absolute URL
export function resolveUploadUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth types
export interface User {
  user_id: number;
  user_name: string;
  user_username: string;
  phone?: string;
  user_type: "SuperAdmin" | "ShopOwner" | "Contentuser" | "ShopKeeper";
  user_status: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoginPayload {
  user_username: string;
  user_password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface RegisterUserPayload {
  user_name: string;
  user_username: string;
  user_password: string;
  phone?: string;
  user_type?: "SuperAdmin" | "ShopOwner" | "Contentuser" | "ShopKeeper";
}

// Payment Method types
export interface PaymentMethod {
  id: number;
  name: string;
  value: string;
  icon: string;
  status: number;
  displayOrder: number;
  // Whether checkout must collect a bank account for this method (vs.
  // settling to the shop's default cash register).
  requiresBankAccount: boolean;
  created_at?: string;
  updated_at?: string;
}

// Product types
export interface Product {
  id: number;
  name: string;
  thickness: string;
  collection: string;
  commission_percentage?: number;
  colorRates: ProductColorRate[];
  // Archive flag: false means this product has real invoice history and
  // was archived instead of deleted.
  is_active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductColorRate {
  id: number;
  productId: number;
  color: string;
  rate: number;
  imageUrl?: string | null;
  sizes?: ProductSize[];
}

export interface ProductSize {
  id: number;
  productColorRateId: number;
  size: number;
  quantity: number;
  unit: string;
}

export interface CreateProductPayload {
  name: string;
  thickness: string;
  collection: string;
  commission_percentage?: number;
  is_active?: boolean;
  category?: string;
  rate?: string;
  stockQuantity?: string;
  unit?: string;
  colorRates?: Array<{
    color: string;
    rate: number | string;
    imageUrl?: string;
    sizes?: Array<{
      size: number | string;
      quantity: number | string;
      unit?: string;
    }>;
  }>;
}

// Customer types
export interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  // Removed state field
  // Archive flag: false means this customer has real invoice history and
  // was archived instead of deleted.
  is_active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  address?: string;
  // Removed state field
  is_active?: boolean;
}

// Invoice types
export interface Invoice {
  id: number;
  customerId: number;
  invoiceNumber: string;
  company?: string;
  date: string;
  grossAmount: number;
  discount: number;
  taxAmount: number;
  netAmount: number;
  remainingAmount: number;
  status: string;
  stockDeducted?: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  items?: InvoiceItem[];
  payments?: Payment[];
  // Every return/exchange event ever performed on this invoice - a return
  // or exchange never creates a new invoice, it always acts on this same
  // one, so this can keep growing over the invoice's whole lifetime. Drives
  // the Items/History/Amount Summary breakdown on the detail and print
  // views.
  returns?: ReturnRecord[];
  // Null for every ordinary Record Sale invoice. Set only for an invoice
  // placed through Online Orders.
  source?: "instagram" | "tiktok" | "whatsapp" | "shopify" | null;
  // Present only on an invoice placed through Online Orders - its
  // companion fulfillment/delivery record.
  onlineOrder?: OnlineOrder | null;
  // Refunds issued directly against this invoice (Online Order
  // cancellations) - distinct from a Return's refunds, which live under
  // returns[].refunds instead.
  orderRefunds?: RefundRecord[];
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  productColorRateId?: number;
  productColorRate?: ProductColorRate;
  itemName?: string;
  type?: string;
  color?: string;
  size?: number;
  quantity: number;
  rate: number;
  totalFeet?: number;
  grossValue?: number;
  discount?: number;
  netValue?: number;
  returnedQuantity?: number;
  product?: Product;
}

export interface CreateInvoicePayload {
  invoice: {
    customerId: number;
    company?: string;
    invoiceNumber?: string;
    date: Date | string;
    grossAmount: number;
    discount?: number;
    taxAmount?: number;
    netAmount: number;
    status?: string;
  };
  items: Array<{
    productId: number;
    itemName?: string;
    type?: string;
    color?: string;
    size?: number;
    quantity: number;
    rate: number;
    discount?: number;
  }>;
}

export interface UpdateInvoiceStatusPayload {
  status: 'pending' | 'paid' | 'cancelled';
}

// Sale (Record Sale) types
export interface CreateSalePayload {
  invoice: {
    customerId: number;
    company?: string;
    invoiceNumber?: string;
    date: Date | string;
    grossAmount: number;
    discount?: number;
    taxAmount?: number;
    netAmount: number;
  };
  items: Array<{
    productColorRateId: number;
    itemName?: string;
    type?: string;
    quantity: number;
    size: number;
    rate: number;
  }>;
  // Recorded in the SAME transaction as the sale/stock deduction - omitting
  // it creates an unpaid invoice, exactly like before this field existed.
  payment?: {
    amount: number;
    method: string;
    bank_account_id?: number;
    paymentDate?: Date | string;
  };
}

// Payment types
export interface Payment {
  id: number;
  invoiceId: number;
  amount: number;
  method: string;
  bank_account_id?: number;
  reference?: string;
  notes?: string;
  paymentDate: string;
  createdAt: string;
  updatedAt: string;
  // Set when this payment is an exchange top-up settlement rather than the
  // invoice's original sale payment - distinguishes "Total Additional Paid"
  // from the original amount collected at sale time.
  returnId?: number | null;
}

export interface CreatePaymentPayload {
  invoiceId: number;
  amount: number;
  method: string;
  bank_account_id?: number;
  reference?: string;
  notes?: string;
  paymentDate: Date | string;
}

// Customer API functions
export const customerAPI = {
  // Get all customers
  getAll: async (): Promise<Customer[]> => {
    const response = await apiClient.get("/api/customers");
    return response.data.customers || response.data;
  },

  // Create a new customer
  create: async (data: CreateCustomerPayload): Promise<Customer> => {
    const response = await apiClient.post("/api/customers", data);
    return response.data;
  },

  // Get customer by ID
  getById: async (id: number): Promise<Customer> => {
    const response = await apiClient.get(`/api/customers/${id}`);
    return response.data;
  },

  // Get customer with invoices
  getWithInvoices: async (id: number): Promise<Customer> => {
    const response = await apiClient.get(`/api/customers/${id}/invoices`);
    return response.data;
  },

  // Update customer
  update: async (id: number, data: Partial<CreateCustomerPayload>): Promise<Customer> => {
    const response = await apiClient.put(`/api/customers/${id}`, data);
    return response.data;
  },

  // Delete customer
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/customers/${id}`);
  },

  // Search customers
  search: async (term: string): Promise<Customer[]> => {
    const response = await apiClient.get(`/api/customers/search/term?term=${term}`);
    return response.data;
  }
};

// Product API functions
export const productAPI = {
  // Get all products
  getAll: async (): Promise<Product[]> => {
    const response = await apiClient.get("/api/products");
    return response.data;
  },

  // Create a new product
  create: async (data: CreateProductPayload): Promise<Product> => {
    const response = await apiClient.post("/api/products", data);
    return response.data;
  },

  // Get product by ID
  getById: async (id: number): Promise<Product> => {
    const response = await apiClient.get(`/api/products/${id}`);
    return response.data;
  },

  // Update product
  update: async (id: number, data: Partial<CreateProductPayload>): Promise<Product> => {
    const response = await apiClient.put(`/api/products/${id}`, data);
    return response.data;
  },

  // Delete product - only allowed when it has zero invoice history; the
  // backend blocks it otherwise and suggests archiving (update with
  // { is_active: false }) instead. There is no force-delete anymore.
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/products/${id}`);
  }
};

export interface ProductSizeLookup {
  productSizeId: number;
  productId: number;
  productName: string;
  collection: string;
  productColorRateId: number;
  color: string;
  rate: number;
  size: number;
  quantity: number;
}

// Product size lookup (QR/barcode scanning)
export const productSizeAPI = {
  // The scanned code is just the ProductSize id.
  lookup: async (id: number | string): Promise<ProductSizeLookup> => {
    const response = await apiClient.get(`/api/product-sizes/lookup/${id}`);
    return response.data;
  },
};

// Upload API functions
export const uploadAPI = {
  // Upload a single image for a product color rate
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await apiClient.post("/api/uploads/product-color-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};

// Invoice API functions
export const invoiceAPI = {
  // Get all invoices
  getAll: async (): Promise<Invoice[]> => {
    const response = await apiClient.get("/api/invoices");
    return response.data;
  },

  // Get invoice by ID
  getById: async (id: number): Promise<Invoice> => {
    const response = await apiClient.get(`/api/invoices/${id}`);
    return response.data;
  },

  // Create invoice with items
  create: async (data: CreateInvoicePayload): Promise<Invoice> => {
    const response = await apiClient.post("/api/invoices/with-items", data);
    return response.data;
  },

  // Update invoice
  update: async (id: number, data: CreateInvoicePayload): Promise<Invoice> => {
    const response = await apiClient.put(`/api/invoices/${id}`, data);
    return response.data;
  },

  // Update invoice status
  updateStatus: async (id: number, data: UpdateInvoiceStatusPayload): Promise<Invoice> => {
    const response = await apiClient.patch(`/api/invoices/${id}/status`, data);
    return response.data;
  },

  // Delete invoice
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/invoices/${id}`);
  },

  // Force delete invoice with all associated records
  forceDelete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/invoices/${id}?force=true`);
  },

  // Get invoices by customer ID
  getByCustomer: async (customerId: number): Promise<Invoice[]> => {
    const response = await apiClient.get(`/api/invoices/customer/${customerId}`);
    return response.data;
  },

  // Get invoices by date range
  getByDateRange: async (startDate: string, endDate: string): Promise<Invoice[]> => {
    const response = await apiClient.get(`/api/invoices/date-range?startDate=${startDate}&endDate=${endDate}`);
    return response.data;
  }
};

// Sale (Record Sale) API functions
export const saleAPI = {
  // Create a sale: creates the invoice, its item, and deducts exact stock
  create: async (data: CreateSalePayload): Promise<Invoice> => {
    const response = await apiClient.post("/api/sales", data);
    return response.data;
  },

  // Cancel a sale: restores exact stock and soft-cancels the invoice
  cancel: async (id: number): Promise<Invoice> => {
    const response = await apiClient.post(`/api/sales/${id}/cancel`);
    return response.data;
  }
};

// Online Orders types and functions
// Free text (not a fixed enum) - see OnlineOrderSourceOption for the
// manageable list of values the combobox offers.
export type OnlineOrderSource = string;
export type OnlineOrderFulfillmentStatus = "pending" | "shipped" | "delivered" | "cancelled";

// The manageable list behind the Online Orders source combobox.
export interface OnlineOrderSourceOption {
  id: number;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineOrder {
  id: number;
  invoiceId: number;
  source: OnlineOrderSource;
  deliveryAddress: string;
  deliveryCharge: number;
  fulfillmentStatus: OnlineOrderFulfillmentStatus;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  // Set only once stock is actually confirmed back on the shelf - never
  // set automatically for a post-shipment cancellation.
  stockReturnedAt?: string | null;
  refundAmount?: number | null;
  refundedAt?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOnlineOrderPayload {
  invoice: {
    customerId: number;
    date: Date | string;
    grossAmount: number;
    discount?: number;
    taxAmount?: number;
    netAmount: number;
  };
  items: Array<{
    productColorRateId: number;
    itemName?: string;
    type?: string;
    quantity: number;
    size: number;
    rate: number;
  }>;
  source: OnlineOrderSource;
  deliveryAddress: string;
  deliveryCharge?: number;
  payment?: {
    amount: number;
    method: string;
    bank_account_id?: number;
    paymentDate?: Date | string;
  };
}

export const onlineOrderAPI = {
  getAll: async (): Promise<Invoice[]> => {
    const response = await apiClient.get("/api/online-orders");
    return response.data;
  },

  getById: async (id: number): Promise<Invoice> => {
    const response = await apiClient.get(`/api/online-orders/${id}`);
    return response.data;
  },

  create: async (data: CreateOnlineOrderPayload): Promise<Invoice> => {
    const response = await apiClient.post("/api/online-orders", data);
    return response.data;
  },

  ship: async (id: number): Promise<Invoice> => {
    const response = await apiClient.patch(`/api/online-orders/${id}/ship`);
    return response.data;
  },

  deliver: async (id: number, payment?: { amount: number; method: string; bank_account_id?: number }): Promise<Invoice> => {
    const response = await apiClient.patch(`/api/online-orders/${id}/deliver`, payment ? { payment } : {});
    return response.data;
  },

  cancel: async (id: number, reason?: string): Promise<Invoice> => {
    const response = await apiClient.post(`/api/online-orders/${id}/cancel`, { reason });
    return response.data;
  },

  confirmStockReceived: async (id: number): Promise<Invoice> => {
    const response = await apiClient.post(`/api/online-orders/${id}/confirm-stock-received`);
    return response.data;
  },

  refund: async (id: number, data: { amount: number; method: string; bank_account_id?: number }): Promise<Invoice> => {
    const response = await apiClient.post(`/api/online-orders/${id}/refund`, data);
    return response.data;
  },

  // Admin only (enforced server-side) - full undo: restores stock if not
  // already accounted for, and reverses every Payment/Refund on the
  // invoice, regardless of fulfillment status.
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/online-orders/${id}`);
    return response.data;
  },
};

export const onlineOrderSourceAPI = {
  getAll: async (): Promise<OnlineOrderSourceOption[]> => {
    const response = await apiClient.get("/api/online-order-sources");
    return response.data;
  },

  // Self-service - any staff member placing an order can add a new one.
  create: async (value: string): Promise<OnlineOrderSourceOption> => {
    const response = await apiClient.post("/api/online-order-sources", { value });
    return response.data;
  },

  // Admin only (enforced server-side).
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/online-order-sources/${id}`);
    return response.data;
  },
};

// Return / Exchange API types and functions
export interface ReturnSummaryItem {
  invoiceItemId: number;
  productId: number;
  productColorRateId: number;
  productName: string;
  color?: string;
  size?: number;
  rate: number;
  quantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
}

export interface ReturnSummary {
  invoiceId: number;
  invoiceNumber: string;
  stockDeducted: boolean;
  status: string;
  items: ReturnSummaryItem[];
}

export interface CreateExchangeNewItemPayload {
  newProductColorRateId: number;
  newSize: number;
  newQuantity: number;
  newRate?: number;
}

export interface CreateReturnItemPayload {
  invoiceItemId: number;
  returnedQuantity: number;
  isExchange?: boolean;
  // One returned item can be exchanged for several different new items.
  newItems?: CreateExchangeNewItemPayload[];
}

export interface CreateReturnPayload {
  invoiceId: number;
  reason?: string;
  items: CreateReturnItemPayload[];
  settlement?: {
    // Any active PaymentMethod.value (cash, card, bank_transfer, easypaisa,
    // jazzcash, ...), not just the two originally-hardcoded literals.
    method: string;
    bank_account_id?: number;
  };
}

export interface ExchangeItemRecord {
  id: number;
  returnItemId: number;
  productColorRateId: number;
  size: number;
  quantity: number;
  rate: number;
  newInvoiceItemId?: number | null;
}

export interface ReturnItemRecord {
  id: number;
  returnId: number;
  invoiceItemId: number;
  returnedQuantity: number;
  refundRate: number;
  refundAmount: number;
  isExchange: boolean;
  exchangeItems?: ExchangeItemRecord[];
  priceDifference: number;
}

export interface RefundRecord {
  id: number;
  // Exactly one of returnId/invoiceId is set: returnId for a product
  // Return/Exchange refund, invoiceId for an Online Order cancellation
  // refund (nothing was returned, the whole order was cancelled).
  returnId?: number | null;
  invoiceId?: number | null;
  amount: number;
  method: string;
  bank_account_id?: number | null;
  refundDate: string;
}

export interface ReturnRecord {
  id: number;
  invoiceId: number;
  type: "return" | "exchange";
  processedByUserId?: number | null;
  reason?: string | null;
  date: string;
  items?: ReturnItemRecord[];
  refunds?: RefundRecord[];
}

export interface CreateReturnResponse {
  return: ReturnRecord;
  payment: Payment | null;
  refund: RefundRecord | null;
  // The same invoice this action was taken against, fully refreshed -
  // exchanges never create a new invoice, so this is always the invoice the
  // caller already knows about, just with its updated Items/History state.
  invoice: Invoice;
  netDifference: number;
}

export const returnAPI = {
  // Per-item remaining-returnable quantities for an invoice
  getSummary: async (invoiceId: number): Promise<ReturnSummary> => {
    const response = await apiClient.get(`/api/returns/invoice/${invoiceId}/summary`);
    return response.data;
  },

  // All returns (with refunds) - used by the Dashboard to net today's
  // refunds out of "Today's Sales".
  getAll: async (): Promise<ReturnRecord[]> => {
    const response = await apiClient.get("/api/returns");
    return response.data;
  },

  // Process a return/exchange (one or more items, one transaction)
  create: async (data: CreateReturnPayload): Promise<CreateReturnResponse> => {
    const response = await apiClient.post("/api/returns", data);
    return response.data;
  },
};

// Payment API functions
export const paymentAPI = {
  // Get all payments
  getAll: async (): Promise<Payment[]> => {
    const response = await apiClient.get("/api/payments");
    return response.data;
  },

  // Create a new payment
  create: async (data: CreatePaymentPayload): Promise<Payment> => {
    const response = await apiClient.post("/api/payments", data);
    return response.data;
  },

  // Get payment by ID
  getById: async (id: number): Promise<Payment> => {
    const response = await apiClient.get(`/api/payments/${id}`);
    return response.data;
  },

  // Get payments by invoice ID
  getByInvoiceId: async (invoiceId: number): Promise<Payment[]> => {
    const response = await apiClient.get(`/api/payments/invoice/${invoiceId}`);
    return response.data;
  },

  // Delete payment
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/payments/${id}`);
  }
};

// Auth API functions
export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  const response = await apiClient.post("/api/users/login", payload);
  return response.data;
};

export const logout = (): void => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

// User Management API
export const userAPI = {
  // Get all users
  getAll: async (): Promise<User[]> => {
    const response = await apiClient.get("/api/users");
    return response.data;
  },

  // Get user by ID
  getById: async (id: number): Promise<User> => {
    const response = await apiClient.get(`/api/users/${id}`);
    return response.data;
  },

  // Register a new user (only ShopOwner or SuperAdmin)
  register: async (payload: RegisterUserPayload): Promise<{ message: string; user: User }> => {
    const response = await apiClient.post("/api/users/register", payload);
    return response.data;
  },

  // Update user
  update: async (id: number, data: Partial<RegisterUserPayload>): Promise<{ message: string; user: User }> => {
    const response = await apiClient.put(`/api/users/${id}`, data);
    return response.data;
  },

  // Delete user (soft - deactivates the account, does not remove it)
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/users/${id}`);
    return response.data;
  },

  // Permanently delete user - irreversible, and only succeeds when the user
  // has zero historical activity anywhere in the system. Pass
  // confirmPermanentAccount: true only when deliberately targeting the
  // permanent recovery account.
  permanentDelete: async (id: number, confirmPermanentAccount?: boolean): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/users/${id}/permanent`, {
      data: confirmPermanentAccount ? { confirmPermanentAccount: true } : undefined,
    });
    return response.data;
  },

  // Admin-driven password reset (SuperAdmin/ShopOwner only) - no OTP, no
  // email, the admin sets the new password directly for the target user.
  resetPassword: async (id: number, new_password: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/api/users/${id}/reset-password`, { new_password });
    return response.data;
  },
};

// Payment Methods API
export const paymentMethodAPI = {
  // Get all payment methods
  getAll: async (activeOnly = false): Promise<PaymentMethod[]> => {
    const response = await apiClient.get("/api/payment-methods", {
      params: activeOnly ? { activeOnly: 'true' } : {}
    });
    return response.data;
  },

  // Get payment method by ID
  getById: async (id: number): Promise<PaymentMethod> => {
    const response = await apiClient.get(`/api/payment-methods/${id}`);
    return response.data;
  },

  // Create payment method (Admin only)
  create: async (data: Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentMethod> => {
    const response = await apiClient.post("/api/payment-methods", data);
    return response.data;
  },

  // Update payment method (Admin only)
  update: async (id: number, data: Partial<Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>>): Promise<PaymentMethod> => {
    const response = await apiClient.put(`/api/payment-methods/${id}`, data);
    return response.data;
  },

  // Delete payment method (Admin only)
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/payment-methods/${id}`);
    return response.data;
  },

  // Toggle payment method status (Admin only)
  toggleStatus: async (id: number): Promise<PaymentMethod> => {
    const response = await apiClient.patch(`/api/payment-methods/${id}/toggle-status`);
    return response.data;
  },
};

// ============================================
// BACKEND/FINANCIAL MODULE API
// ============================================

// Supplier types
export interface Supplier {
  supplier_id: number;
  name: string;
  phone?: string;
  address?: string;
  opening_balance: number;
  current_balance: number;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
  updated_at: string;
  transactions?: SupplierTransaction[];
}

// One new item received in a 'purchase'-type SupplierTransaction.
export interface SupplierTransactionItem {
  id: number;
  supplier_transaction_id: number;
  is_inventory_item: boolean;
  product_color_rate_id: number | null;
  size: number | null;
  description: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  productColorRate?: {
    id: number;
    color: string;
    rate: number;
    product?: { id: number; name: string };
  };
}

// A supplier purchase (goods received, items required) or payment (paying
// down an existing balance, no items). Owed-for-this-transaction is
// total_amount - amount_paid.
export interface SupplierTransaction {
  trans_id: number;
  supplier_id: number;
  type: 'purchase' | 'payment';
  total_amount: number;
  amount_paid: number;
  description?: string;
  payment_method?: string;
  bank_account_id?: number;
  reference_number?: string;
  transaction_date: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  supplier?: {
    supplier_id: number;
    name: string;
    current_balance?: number;
  };
  items?: SupplierTransactionItem[];
}

// Expense types
export interface Expense {
  expense_id: number;
  category: string;
  amount: number;
  description?: string;
  expense_date: string;
  payment_method?: string;
  bank_account_id?: number;
  reference_number?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  creator?: {
    user_id: number;
    user_name: string;
    user_username: string;
  };
}

// Supplier Invoice types
export interface SupplierInvoice {
  invoice_id: number;
  supplier_id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: 'pending' | 'partial' | 'paid';
  description?: string;
  due_date?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  supplier?: {
    supplier_id: number;
    name: string;
    phone?: string;
    address?: string;
    current_balance?: number;
  };
  creator?: {
    user_id: number;
    user_name: string;
    user_username: string;
  };
}

// Dashboard statistics type
export interface BackendDashboardStats {
  totalSuppliers: number;
  totalTransactions: number;
  totalOwedToSuppliers: number;
  totalBalance: number;
  recentTransactions: SupplierTransaction[];
}

// Expense categories constant
export const EXPENSE_CATEGORIES = [
  'Rent',
  'Transport',
  'Utilities',
  'Labor',
  'Materials',
  'Maintenance',
  'Marketing',
  'Office Supplies',
  'Professional Fees',
  'Insurance',
  'Other'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// Supplier API
export const supplierAPI = {
  // Get all suppliers
  getAll: async (): Promise<Supplier[]> => {
    const response = await apiClient.get("/api/backend/suppliers");
    return response.data;
  },

  // Get supplier by ID
  getById: async (id: number): Promise<Supplier> => {
    const response = await apiClient.get(`/api/backend/suppliers/${id}`);
    return response.data;
  },

  // Get supplier ledger
  getLedger: async (id: number, startDate?: string, endDate?: string): Promise<{
    supplier: {
      supplier_id: number;
      name: string;
      opening_balance: number;
      current_balance: number;
    };
    transactions: SupplierTransaction[];
  }> => {
    const response = await apiClient.get(`/api/backend/suppliers/${id}/ledger`, {
      params: { startDate, endDate }
    });
    return response.data;
  },

  // Create supplier
  create: async (data: Omit<Supplier, 'supplier_id' | 'current_balance' | 'created_at' | 'updated_at'>): Promise<{ message: string; supplier: Supplier }> => {
    const response = await apiClient.post("/api/backend/suppliers", data);
    return response.data;
  },

  // Update supplier
  update: async (id: number, data: Partial<Omit<Supplier, 'supplier_id' | 'created_at' | 'updated_at'>>): Promise<{ message: string; supplier: Supplier }> => {
    const response = await apiClient.put(`/api/backend/suppliers/${id}`, data);
    return response.data;
  },

  // Delete supplier
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/backend/suppliers/${id}`);
    return response.data;
  },
};

export interface CreateSupplierTransactionItemPayload {
  is_inventory_item: boolean;
  product_color_rate_id?: number;
  size?: number;
  description?: string;
  quantity: number;
  unit_cost: number;
}

export interface CreateSupplierTransactionPayload {
  supplier_id: number;
  type: 'purchase' | 'payment';
  items?: CreateSupplierTransactionItemPayload[];
  amount_paid: number;
  description?: string;
  payment_method?: string;
  bank_account_id?: number;
  reference_number?: string;
  transaction_date?: string;
}

// Supplier Transaction API - the supplier purchase/restock ledger
export const supplierTransactionAPI = {
  // Get dashboard statistics
  getDashboardStats: async (): Promise<BackendDashboardStats> => {
    const response = await apiClient.get("/api/backend/transactions/dashboard/stats");
    return response.data;
  },

  // Get all transactions
  getAll: async (filters?: {
    supplier_id?: number;
    type?: 'purchase' | 'payment';
    startDate?: string;
    endDate?: string;
  }): Promise<SupplierTransaction[]> => {
    const response = await apiClient.get("/api/backend/transactions", {
      params: filters
    });
    return response.data;
  },

  // Get transaction by ID
  getById: async (id: number): Promise<SupplierTransaction> => {
    const response = await apiClient.get(`/api/backend/transactions/${id}`);
    return response.data;
  },

  // Create transaction (purchase or payment)
  create: async (data: CreateSupplierTransactionPayload): Promise<{ message: string; transaction: SupplierTransaction }> => {
    const response = await apiClient.post("/api/backend/transactions", data);
    return response.data;
  },

  // Update transaction - descriptive fields only (description, reference
  // number, date); amounts/items/type aren't editable after the fact.
  update: async (id: number, data: { description?: string; reference_number?: string; transaction_date?: string }): Promise<{ message: string; transaction: SupplierTransaction }> => {
    const response = await apiClient.put(`/api/backend/transactions/${id}`, data);
    return response.data;
  },

  // Delete transaction
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/backend/transactions/${id}`);
    return response.data;
  },
};

// Expense API
export const expenseAPI = {
  // Get all expenses
  getAll: async (filters?: {
    category?: string;
    start_date?: string;
    end_date?: string;
    payment_method?: string;
  }): Promise<{ success: boolean; data: Expense[] }> => {
    const response = await apiClient.get("/api/backend/expenses", {
      params: filters
    });
    return response.data;
  },

  // Get expense by ID
  getById: async (id: number): Promise<{ success: boolean; data: Expense }> => {
    const response = await apiClient.get(`/api/backend/expenses/${id}`);
    return response.data;
  },

  // Get expenses by category
  getByCategory: async (filters?: {
    start_date?: string;
    end_date?: string;
  }): Promise<{ success: boolean; data: Array<{ category: string; total_amount: number; count: number }> }> => {
    const response = await apiClient.get("/api/backend/expenses/by-category", {
      params: filters
    });
    return response.data;
  },

  // Get expense statistics
  getStats: async (filters?: {
    start_date?: string;
    end_date?: string;
  }): Promise<{ success: boolean; data: { total_expenses: number; total_count: number; average_expense: number } }> => {
    const response = await apiClient.get("/api/backend/expenses/stats", {
      params: filters
    });
    return response.data;
  },

  // Create expense
  create: async (data: {
    category: string;
    amount: number;
    description?: string;
    expense_date: string;
    payment_method?: string;
    reference_number?: string;
  }): Promise<{ success: boolean; message: string; data: Expense }> => {
    const response = await apiClient.post("/api/backend/expenses", data);
    return response.data;
  },

  // Delete expense
  delete: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/api/backend/expenses/${id}`);
    return response.data;
  },
};

// Supplier Invoice API
export const supplierInvoiceAPI = {
  // Get all supplier invoices
  getAll: async (filters?: {
    supplier_id?: number;
    status?: 'pending' | 'partial' | 'paid';
    start_date?: string;
    end_date?: string;
  }): Promise<{ success: boolean; data: SupplierInvoice[] }> => {
    const response = await apiClient.get("/api/backend/supplier-invoices", {
      params: filters
    });
    return response.data;
  },

  // Get supplier invoice by ID
  getById: async (id: number): Promise<{ success: boolean; data: SupplierInvoice }> => {
    const response = await apiClient.get(`/api/backend/supplier-invoices/${id}`);
    return response.data;
  },

  // Get pending invoices (for payables)
  getPending: async (filters?: {
    supplier_id?: number;
  }): Promise<{ success: boolean; data: { invoices: SupplierInvoice[]; total_pending: number; count: number } }> => {
    const response = await apiClient.get("/api/backend/supplier-invoices/pending", {
      params: filters
    });
    return response.data;
  },

  // Get supplier invoice statistics
  getStats: async (filters?: {
    supplier_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    success: boolean;
    data: {
      total_invoiced: number;
      total_paid: number; 
      total_pending: number; 
      total_count: number;
      status_breakdown: Array<{ status: string; count: number }>;
    } 
  }> => {
    const response = await apiClient.get("/api/backend/supplier-invoices/stats", {
      params: filters
    });
    return response.data;
  },

  // Create supplier invoice
  create: async (data: {
    supplier_id: number;
    invoice_number: string;
    invoice_date: string;
    total_amount: number;
    paid_amount?: number;
    description?: string;
    due_date?: string;
  }): Promise<{ success: boolean; message: string; data: SupplierInvoice }> => {
    const response = await apiClient.post("/api/backend/supplier-invoices", data);
    return response.data;
  },

  // Update supplier invoice
  update: async (id: number, data: {
    invoice_number?: string;
    invoice_date?: string;
    total_amount?: number;
    paid_amount?: number;
    description?: string;
    due_date?: string;
  }): Promise<{ success: boolean; message: string; data: SupplierInvoice }> => {
    const response = await apiClient.put(`/api/backend/supplier-invoices/${id}`, data);
    return response.data;
  },

  // Delete supplier invoice
  delete: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/api/backend/supplier-invoices/${id}`);
    return response.data;
  },
};

// ============================================
// PHASE 3: ADVANCED FINANCIAL FEATURES
// ============================================

// Bank Account Interface
export interface BankAccount {
  account_id: number;
  account_name: string;
  account_number?: string;
  bank_name?: string;
  account_type: 'bank' | 'cash' | 'wallet';
  opening_balance: number;
  current_balance: number;
  currency: string;
  branch?: string;
  ifsc_code?: string;
  description?: string;
  status: number;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  creator?: User;
}

// Cash Flow Interface
export interface CashFlow {
  flow_id: number;
  account_id: number;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
  amount: number;
  related_account_id?: number;
  reference_type?: 'company_transaction' | 'supplier_invoice' | 'expense' | 'manual' | 'other';
  reference_id?: number;
  reference_number?: string;
  payment_method?: string;
  description?: string;
  transaction_date: string;
  balance_before?: number;
  balance_after?: number;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  account?: BankAccount;
  relatedAccount?: BankAccount;
  creator?: User;
}

// Cash Flow Summary Interface
export interface CashFlowSummary {
  total_deposits: number;
  total_withdrawals: number;
  total_transfers_in: number;
  total_transfers_out: number;
  total_inflow: number;
  total_outflow: number;
  net_cash_flow: number;
}

// Bank Account Statistics Interface
export interface BankAccountStats {
  account_name: string;
  current_balance: number;
  opening_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  net_change: number;
}

// Bank Account API
export const bankAccountAPI = {
  // Get all bank accounts
  getAll: async (filters?: {
    account_type?: 'bank' | 'cash' | 'wallet';
    status?: number;
  }): Promise<BankAccount[]> => {
    const response = await apiClient.get("/api/backend/bank-accounts", { params: filters });
    return response.data;
  },

  // Get shop's personal bank accounts (for invoice payments)
  getShopBankAccounts: async (): Promise<BankAccount[]> => {
    const response = await apiClient.get("/api/backend/bank-accounts/shop/accounts");
    return response.data;
  },

  // Get single bank account
  getById: async (id: number): Promise<BankAccount> => {
    const response = await apiClient.get(`/api/backend/bank-accounts/${id}`);
    return response.data;
  },

  // Create bank account
  create: async (data: {
    account_name: string;
    account_number?: string;
    bank_name?: string;
    account_type: 'bank' | 'cash' | 'wallet';
    opening_balance?: number;
    currency?: string;
    branch?: string;
    ifsc_code?: string;
    description?: string;
  }): Promise<{ message: string; account: BankAccount }> => {
    const response = await apiClient.post("/api/backend/bank-accounts", data);
    return response.data;
  },

  // Update bank account
  update: async (id: number, data: Partial<BankAccount>): Promise<{ message: string; account: BankAccount }> => {
    const response = await apiClient.put(`/api/backend/bank-accounts/${id}`, data);
    return response.data;
  },

  // Delete bank account
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/backend/bank-accounts/${id}`);
    return response.data;
  },

  // Toggle account status
  toggleStatus: async (id: number): Promise<{ message: string; account: BankAccount }> => {
    const response = await apiClient.patch(`/api/backend/bank-accounts/${id}/toggle-status`);
    return response.data;
  },

  // Deposit money
  deposit: async (id: number, data: {
    amount: number;
    description?: string;
    reference_number?: string;
    payment_method?: string;
    transaction_date?: string;
    reference_type?: string;
    reference_id?: number;
  }): Promise<{ message: string; cashFlow: CashFlow; account: BankAccount }> => {
    const response = await apiClient.post(`/api/backend/bank-accounts/${id}/deposit`, data);
    return response.data;
  },

  // Withdraw money
  withdraw: async (id: number, data: {
    amount: number;
    description?: string;
    reference_number?: string;
    payment_method?: string;
    transaction_date?: string;
    reference_type?: string;
    reference_id?: number;
  }): Promise<{ message: string; cashFlow: CashFlow; account: BankAccount }> => {
    const response = await apiClient.post(`/api/backend/bank-accounts/${id}/withdraw`, data);
    return response.data;
  },

  // Transfer between accounts
  transfer: async (data: {
    from_account_id: number;
    to_account_id: number;
    amount: number;
    description?: string;
    reference_number?: string;
    transaction_date?: string;
  }): Promise<{
    message: string;
    from_account: BankAccount;
    to_account: BankAccount;
    transfer_out: CashFlow;
    transfer_in: CashFlow;
  }> => {
    const response = await apiClient.post("/api/backend/bank-accounts/transfer", data);
    return response.data;
  },

  // Get account statistics
  getStats: async (id: number, filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<BankAccountStats> => {
    const response = await apiClient.get(`/api/backend/bank-accounts/${id}/stats`, { params: filters });
    return response.data;
  },
};

// Cash Flow API
export const cashFlowAPI = {
  // Get all cash flows
  getAll: async (filters?: {
    account_id?: number;
    transaction_type?: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
    startDate?: string;
    endDate?: string;
    reference_type?: string;
  }): Promise<CashFlow[]> => {
    const response = await apiClient.get("/api/backend/cash-flows", { params: filters });
    return response.data;
  },

  // Get single cash flow
  getById: async (id: number): Promise<CashFlow> => {
    const response = await apiClient.get(`/api/backend/cash-flows/${id}`);
    return response.data;
  },

  // Get cash flow summary
  getSummary: async (filters?: {
    account_id?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<CashFlowSummary> => {
    const response = await apiClient.get("/api/backend/cash-flows/summary", { params: filters });
    return response.data;
  },

  // Delete cash flow (reverses transaction)
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/backend/cash-flows/${id}`);
    return response.data;
  },
};

// ============================================================================
// BUSINESS REPORTS INTERFACES
// ============================================================================

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  totalRefunded: number;
  profitLoss: number;
  profitMargin: string;
  totalReceivables: number;
  totalOwedToSuppliers: number;
  totalBankBalance: number;
  bankAccounts: {
    account_id: number;
    account_name: string;
    account_type: string;
    current_balance: number;
    status: number;
  }[];
  dateRange: {
    startDate: string;
    endDate: string;
  } | null;
}

export interface RevenueOverTimePoint {
  period: string;
  orderCount: number;
  revenue: number;
}

export interface RevenueOverTimeResponse {
  points: RevenueOverTimePoint[];
  groupBy: 'day' | 'week' | 'month';
  dateRange: { startDate: string; endDate: string } | null;
}

export interface TopProduct {
  productId: number;
  productName: string;
  collection: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface TopProductCollection {
  collection: string;
  unitsSold: number;
  revenue: number;
}

export interface TopProductsResponse {
  products: TopProduct[];
  collections: TopProductCollection[];
  dateRange: { startDate: string; endDate: string } | null;
}

export interface ReturnActivity {
  returnId: number;
  date: string;
  type: 'return' | 'exchange';
  invoiceNumber: string;
  refundAmount: number;
  additionalPaymentAmount: number;
}

export interface ReturnsSummaryResponse {
  totalReturns: number;
  totalExchanges: number;
  totalPlainReturns: number;
  totalReturnedValue: number;
  totalRefunded: number;
  totalAdditionalCollected: number;
  recentReturns: ReturnActivity[];
  dateRange: { startDate: string; endDate: string } | null;
}

export interface LowStockItem {
  productId: number;
  productName: string;
  collection: string;
  color: string;
  size: number;
  quantity: number;
  rate: number;
  value: number;
}

export interface StockByCollection {
  collection: string;
  units: number;
  value: number;
}

export interface StockReportResponse {
  totalStockUnits: number;
  totalStockValue: number;
  outOfStockCount: number;
  lowStockThreshold: number;
  lowStockItems: LowStockItem[];
  byCollection: StockByCollection[];
}

export interface SupplierDebt {
  supplierId: number;
  name: string;
  phone: string;
  openingBalance: string;
  currentBalance: string;
  status: string;
}

export interface SupplierDebtsResponse {
  suppliers: SupplierDebt[];
  totalDebt: string;
}

export interface CustomerInvoice {
  invoiceId: number;
  invoiceNumber: string;
  date: string;
  netAmount: number;
  remainingAmount: number;
}

export interface CustomerReceivable {
  customerId: number;
  name: string;
  phone: string;
  address: string;
  totalReceivable: number;
  invoiceCount: number;
  invoices: CustomerInvoice[];
}

export interface CustomerReceivablesResponse {
  customers: CustomerReceivable[];
  totalReceivables: number;
  customerCount: number;
}

export interface CashFlowAnalysisItem {
  flowId: number;
  accountName: string;
  accountType: string;
  transactionType: string;
  amount: string;
  balanceAfter: string;
  description: string;
  date: string;
  referenceType: string;
  referenceId: number;
}

export interface CashFlowAnalysisResponse {
  cashFlows: CashFlowAnalysisItem[];
  summary: {
    totalDeposits: string;
    totalWithdrawals: string;
    netCashFlow: string;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  } | null;
}

export interface ExpenseBreakdownCategory {
  category: string;
  count: number;
  total: string;
  percentage: string;
}

export interface ExpenseBreakdownResponse {
  breakdown: ExpenseBreakdownCategory[];
  totalExpenses: string;
  dateRange: {
    startDate: string;
    endDate: string;
  } | null;
}

export interface DailyCashTransaction {
  flowId: number;
  transactionType: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
  amount: number;
  description?: string | null;
  time: string;
  referenceType?: string | null;
  referenceId?: number | null;
}

export interface DailyCashAccountSummary {
  accountId: number;
  accountName: string;
  accountType: 'bank' | 'cash' | 'wallet';
  openingBalance: number;
  moneyIn: number;
  moneyOut: number;
  netToday: number;
  endingBalance: number;
  transactions: DailyCashTransaction[];
}

export interface DailyCashSummaryResponse {
  date: string;
  accounts: DailyCashAccountSummary[];
  grandTotal: {
    openingBalance: number;
    moneyIn: number;
    moneyOut: number;
    netToday: number;
    endingBalance: number;
  };
}

// Business Reports API
export const businessReportsAPI = {
  // Get financial summary (KPI cards)
  getFinancialSummary: async (filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; data: FinancialSummary }> => {
    const response = await apiClient.get("/api/backend/business-reports/financial-summary", { params: filters });
    return response.data;
  },

  // Get revenue over time (net of returns), bucketed by day/week/month
  getRevenueOverTime: async (filters?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<{ success: boolean; data: RevenueOverTimeResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/revenue-over-time", { params: filters });
    return response.data;
  },

  // Get top-selling products and collections
  getTopProducts: async (filters?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{ success: boolean; data: TopProductsResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/top-products", { params: filters });
    return response.data;
  },

  // Get returns & exchanges summary
  getReturnsSummary: async (filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; data: ReturnsSummaryResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/returns-summary", { params: filters });
    return response.data;
  },

  // Get stock value / low stock report
  getStockReport: async (): Promise<{ success: boolean; data: StockReportResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/stock");
    return response.data;
  },

  // Get supplier debts
  getSupplierDebts: async (): Promise<{ success: boolean; data: SupplierDebtsResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/supplier-debts");
    return response.data;
  },

  // Get customer receivables
  getCustomerReceivables: async (): Promise<{ success: boolean; data: CustomerReceivablesResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/customer-receivables");
    return response.data;
  },

  // Get cash flow analysis
  getCashFlowAnalysis: async (filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; data: CashFlowAnalysisResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/cash-flow-analysis", { params: filters });
    return response.data;
  },

  // Get expense breakdown
  getExpenseBreakdown: async (filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; data: ExpenseBreakdownResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/expense-breakdown", { params: filters });
    return response.data;
  },

  // Get the Daily Cash Summary - per-account Money In/Out/Ending Balance
  // for a single day, built from the CashFlow ledger
  getDailyCashSummary: async (date?: string): Promise<{ success: boolean; data: DailyCashSummaryResponse }> => {
    const response = await apiClient.get("/api/backend/business-reports/daily-cash-summary", { params: date ? { date } : {} });
    return response.data;
  },
};

