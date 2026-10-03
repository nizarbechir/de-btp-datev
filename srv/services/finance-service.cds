using {swiver as my} from '../../db/schema';
using from '../../db/sales';
using from '../../db/settings';

/**
 * Everything a small business needs to invoice its customers and track what it owes its suppliers.
 */
service FinanceService {
  // Sales

  entity Customers            as projection on my.Customers {
    *,
    balance : redirected to CustomerBalances
  };

  entity SalesInvoices        as projection on my.SalesInvoices
    actions {
      action   markAsSent()                       returns SalesInvoices;
      action   markAsPaid()                       returns SalesInvoices;
      action   cancelInvoice()                    returns SalesInvoices;
      action   reopen()                           returns SalesInvoices;
      /** Copies the invoice into a new draft dated today. */
      action   duplicate()                        returns SalesInvoices;
      /** Creates a customer and assigns it to this invoice, without leaving the invoice. */
      action   createCustomer(companyName : String(120),
                              name : String(120),
                              email : String(120),
                              street : String(200),
                              postalCode : String(10),
                              city : String(80),
                              country : String(3)) returns SalesInvoices;
      /** The invoice as PDF, inline for the preview or as attachment for download. */
      function pdf(download : Boolean)            returns LargeBinary @Core.MediaType: 'application/pdf';
    };

  @readonly
  @cds.redirection.target: false
  entity CustomerBalances     as projection on my.CustomerBalances;

  @readonly
  entity SalesInvoiceStatuses as projection on my.SalesInvoiceStatuses;

  @readonly
  entity Units                as projection on my.Units;

  @Capabilities: {
    InsertRestrictions.Insertable: false,
    DeleteRestrictions.Deletable : false
  }
  entity CompanySettings      as projection on my.CompanySettings;

  // Purchases

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

  /** Money in: what customers owe the business. */
  type Receivables {
    outstanding   : KpiValue;
    overdue       : KpiValue;
    paidThisMonth : KpiValue;
  }

  /** Money out: what the business owes its suppliers. */
  type Payables {
    open          : KpiValue;
    overdue       : KpiValue;
    dueNext7Days  : KpiValue;
    paidThisMonth : KpiValue;
  }

  type Dashboard {
    currency    : String(3);
    receivables : Receivables;
    payables    : Payables;
  }

  /** Key figures for the dashboard tiles. */
  function dashboard() returns Dashboard;
}

annotate FinanceService.Suppliers with @odata.draft.enabled;
annotate FinanceService.SupplierInvoices with @odata.draft.enabled;
annotate FinanceService.Customers with @odata.draft.enabled;
annotate FinanceService.SalesInvoices with @odata.draft.enabled;
annotate FinanceService.CompanySettings with @odata.draft.enabled;
