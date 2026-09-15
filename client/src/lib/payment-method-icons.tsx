import {
  Wallet,
  CreditCard,
  Landmark,
  DollarSign,
  Smartphone,
  Banknote,
  type LucideIcon,
} from "lucide-react";

// Lucide icon lookup for PaymentMethod.icon (a plain string column, e.g.
// "Wallet", "Landmark") - shared by the admin Payment Methods page and every
// checkout surface that renders the active payment methods list.
export const paymentMethodIconMap: Record<string, LucideIcon> = {
  Wallet,
  CreditCard,
  Landmark,
  DollarSign,
  Smartphone,
  Banknote,
};

export function getPaymentMethodIcon(iconName: string | undefined): LucideIcon {
  return (iconName && paymentMethodIconMap[iconName]) || DollarSign;
}
