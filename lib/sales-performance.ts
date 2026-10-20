import type { Dataset, Payment, Sale } from "./model";
import { reportingPayments } from "./payment-history";

export type CloserPerformance = {
  closer: string;
  calls: number;
  attended: number;
  sales: number;
  closeRate: number | null;
  verifiedPif: number;
  pifRate: number | null;
  contract: number;
  cash: number;
  cashPerAttendedCall: number | null;
};

export function isPifPaymentType(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return (
    normalized === "pif" ||
    normalized.includes("pay in full") ||
    normalized.includes("paid in full")
  );
}

function successfulSalePayments(payments: Payment[], saleId: string) {
  return payments.filter(
    (payment) => payment.sale_id === saleId && payment.status === "succeeded",
  );
}

export function isVerifiedPifSale(sale: Sale, payments: Payment[]) {
  if (!isPifPaymentType(sale.payment_type)) return false;
  const receipts = successfulSalePayments(payments, sale.id);
  return (
    receipts.length === 1 &&
    receipts[0].amount >= sale.contract_value
  );
}

const ratio = (numerator: number, denominator: number) =>
  denominator ? numerator / denominator : null;

export function salesPerformance(data: Dataset) {
  const payments = reportingPayments(data);
  const successfulLinkedPayments = payments.filter(
    (payment) => payment.status === "succeeded" && Boolean(payment.sale_id),
  );
  const attendedCalls = data.calls.filter(
    (call) => call.attendance === "attended",
  );
  const verifiedPif = data.sales.filter((sale) =>
    isVerifiedPifSale(sale, successfulLinkedPayments),
  ).length;
  const cash = successfulLinkedPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );

  const closerNames = [
    ...new Set(
      data.calls.map((call) => call.closer.trim() || "Unassigned"),
    ),
  ];

  const closers: CloserPerformance[] = closerNames
    .map((closer) => {
      const calls = data.calls.filter(
        (call) => (call.closer.trim() || "Unassigned") === closer,
      );
      const callIds = new Set(calls.map((call) => call.id));
      const attended = calls.filter(
        (call) => call.attendance === "attended",
      ).length;
      const sales = data.sales.filter(
        (sale) => Boolean(sale.sales_call_id && callIds.has(sale.sales_call_id)),
      );
      const saleIds = new Set(sales.map((sale) => sale.id));
      const receipts = successfulLinkedPayments.filter(
        (payment) => Boolean(payment.sale_id && saleIds.has(payment.sale_id)),
      );
      const closerCash = receipts.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      const closerPif = sales.filter((sale) =>
        isVerifiedPifSale(sale, receipts),
      ).length;

      return {
        closer,
        calls: calls.length,
        attended,
        sales: sales.length,
        closeRate: ratio(sales.length, attended),
        verifiedPif: closerPif,
        pifRate: ratio(closerPif, sales.length),
        contract: sales.reduce((sum, sale) => sum + sale.contract_value, 0),
        cash: closerCash,
        cashPerAttendedCall: ratio(closerCash, attended),
      };
    })
    .sort((a, b) => b.cash - a.cash || b.sales - a.sales);

  return {
    calls: data.calls.length,
    attended: attendedCalls.length,
    sales: data.sales.length,
    verifiedPif,
    pifRate: ratio(verifiedPif, data.sales.length),
    cash,
    cashPerAttendedCall: ratio(cash, attendedCalls.length),
    closers,
  };
}
