using {swiver as my} from '../../db/schema';
using from '../../db/sales';
using from '../../db/finance';
using from '../../db/collaboration';

/**
 * Finance: bank transactions and payment matching, payments, VAT overview, accountant export
 * and the dashboard. Invoices are read-only here; they are maintained in Sales and Purchasing.
 */
service FinanceService {
  entity BankTransactions  as projection on my.BankTransactions
    actions {
      /** Adds a comment or question, e.g. from the tax advisor. */
      @title: '{i18n>AddComment}'
      action   addComment(text : String(1000) @title: '{i18n>Comment}' @UI.MultiLineText) returns BankTransactions;
      /** Confirms the suggested invoice: records the payment and marks the transaction as matched. */
      @title: '{i18n>ConfirmMatch}'
      action confirmMatch()                                            returns BankTransactions;
      @title: '{i18n>MatchManually}'
      action matchManually(salesInvoice : UUID @title: '{i18n>SalesInvoice}',
                           supplierInvoice : UUID @title: '{i18n>SupplierInvoice}') returns BankTransactions;
      @title: '{i18n>Ignore}'
      action ignore()                                                  returns BankTransactions;
      /** Removes the payment of a matched transaction, so it can be matched again. */
      @title: '{i18n>Unmatch}'
      action unmatch()                                                 returns BankTransactions;
    };

  @readonly
  entity BankImportBatches as projection on my.BankImportBatches;

  @readonly
  entity Payments          as projection on my.Payments;

  /** Payments per month, money in and out, for the dashboard chart. */
  @readonly @cds.redirection.target: false
  entity CashFlow          as projection on my.Payments {
    key ID,
        organization,
        substring(paymentDate, 0, 7)                             as month    : String(7),
        case when direction = 'IN' then amount else 0 end        as moneyIn  : Decimal(15, 2),
        case when direction = 'OUT' then amount else 0 end       as moneyOut : Decimal(15, 2)
  };

  @readonly
  entity SalesInvoices     as projection on my.SalesInvoices;

  @readonly
  entity SupplierInvoices  as projection on my.SupplierInvoices;

  @readonly
  entity Customers         as projection on my.Customers;

  @readonly
  entity Suppliers         as projection on my.Suppliers;

  @readonly
  entity ExpenseCategories as projection on my.ExpenseCategories;

  @readonly
  entity FinancialComments as projection on my.FinancialComments
    actions {
      @title: '{i18n>Resolve}'
      action resolve() returns FinancialComments;
    };

  @readonly
  entity BankMatchStatuses as projection on my.BankMatchStatuses;

  type ImportResult {
    imported   : Integer;
    duplicates : Integer;
    suggested  : Integer;
  }

  /** Imports a bank statement CSV and suggests matching invoices. */
  action   importBankStatement(fileName : String(255), content : LargeString) returns ImportResult;
  /** Suggests invoices for all unmatched transactions again. */
  action   suggestMatches()                                                   returns Integer;

  type KpiValue {
    count  : Integer;
    amount : Decimal(15, 2);
  }

  /** Money in: what customers owe the business. */
  type Receivables {
    outstanding      : KpiValue;
    overdue          : KpiValue;
    paidThisMonth    : KpiValue;
    revenueThisMonth : KpiValue;
  }

  /** Money out: what the business owes its suppliers. */
  type Payables {
    open              : KpiValue;
    overdue           : KpiValue;
    dueNext7Days      : KpiValue;
    paidThisMonth     : KpiValue;
    expensesThisMonth : KpiValue;
  }

  type AttentionItem {
    id     : String(30);
    count  : Integer;
    text   : String(200);
    target : String(60);
  }

  type Dashboard {
    currency         : String(3);
    organizationName : String(120);
    receivables      : Receivables;
    payables         : Payables;
    estimatedVat     : Decimal(15, 2);
    // Net revenue minus net expenses of this month.
    profitThisMonth  : Decimal(15, 2);
    inboxCount       : Integer;
    unmatchedCount   : Integer;
    needsAttention   : many AttentionItem;
  }

  /** Key figures for the dashboard tiles. */
  function dashboard()                                     returns Dashboard;

  type VatOverview {
    fromDate          : Date;
    toDate            : Date;
    currency          : String(3);
    netSales          : Decimal(15, 2);
    outputVat         : Decimal(15, 2);
    netExpenses       : Decimal(15, 2);
    inputVat          : Decimal(15, 2);
    // Output VAT minus input VAT: positive means VAT payable. An estimate, not a tax return.
    estimatedVat      : Decimal(15, 2);
    salesInvoiceCount : Integer;
    expenseCount      : Integer;
  }

  /** Estimated VAT of a period, from the sales and supplier invoices. */
  function vatOverview(fromDate : Date, toDate : Date)     returns VatOverview;
  /** ZIP with the invoices, documents and CSV lists of a period for the tax adviser. */
  function accountantExport(fromDate : Date, toDate : Date) returns LargeBinary @Core.MediaType: 'application/zip';
}
