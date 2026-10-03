using {swiver as my} from '../../db/schema';

/**
 * Everything a small business needs to track what it owes its suppliers.
 */
service FinanceService {
  entity Suppliers        as projection on my.Suppliers {
    *,
    balance : redirected to SupplierBalances
  };

  entity SupplierInvoices as projection on my.SupplierInvoices
    actions {
      action markInvoicePaid() returns SupplierInvoices;
      action markInvoiceOpen() returns SupplierInvoices;
    };

  @readonly
  @cds.redirection.target: false
  entity SupplierBalances as projection on my.SupplierBalances;

  @readonly
  entity PaymentStatuses  as projection on my.PaymentStatuses;

  type KpiValue {
    count  : Integer;
    amount : Decimal(15, 2);
  }

  type Dashboard {
    currency      : String(3);
    open          : KpiValue;
    overdue       : KpiValue;
    dueNext7Days  : KpiValue;
    paidThisMonth : KpiValue;
  }

  /** Key figures for the dashboard tiles. */
  function dashboard() returns Dashboard;
}

annotate FinanceService.Suppliers with @odata.draft.enabled;
annotate FinanceService.SupplierInvoices with @odata.draft.enabled;
