using {swiver as my} from '../../db/schema';
using from '../../db/finance';
using from '../../db/collaboration';

/**
 * Money out: suppliers, the document inbox, supplier invoices and expense categories.
 */
service PurchasingService @(path: '/odata/v4/purchasing') {
  entity Suppliers                as projection on my.Suppliers {
    *,
    balance : redirected to SupplierBalances
  };

  entity SupplierInvoices         as projection on my.SupplierInvoices {
    *,
    /** Shown while editing: what happens when a document is uploaded. */
    virtual null as documentHint : String(300) @title: '{i18n>Note}' @readonly @UI.MultiLineText
  }
    actions {
      /** Adds a comment or question, e.g. from the tax advisor. */
      @title: '{i18n>AddComment}'
      action   addComment(text : String(1000) @title: '{i18n>Comment}' @UI.MultiLineText) returns SupplierInvoices;
      /** Records a payment of the open amount, dated today. */
      @title: '{i18n>MarkPaid}'
      action markInvoicePaid() returns SupplierInvoices;
      /** Removes the manually recorded payments, so the invoice is open again. */
      @title: '{i18n>MarkOpen}'
      action markInvoiceOpen() returns SupplierInvoices;
      @title: '{i18n>RecordPayment}'
      action recordPayment(amount : Decimal(15, 2) @title: '{i18n>Amount}',
                           paymentDate : Date @title: '{i18n>PaymentDate}',
                           reference : String(255) @title: '{i18n>Reference}') returns SupplierInvoices;
    };

  entity IncomingDocuments        as projection on my.IncomingDocuments
    actions {
      /** Adds a comment or question, e.g. from the tax advisor. */
      @title: '{i18n>AddComment}'
      action   addComment(text : String(1000) @title: '{i18n>Comment}' @UI.MultiLineText) returns IncomingDocuments;
      /** Reads the document again (e-invoice or PDF text) and proposes the invoice data. */
      @title: '{i18n>Process}'
      action process()                                         returns IncomingDocuments;
      /** Creates the supplier invoice from the document and marks the document as processed. */
      @title: '{i18n>CreateSupplierInvoice}'
      action createSupplierInvoice(supplier : UUID @title: '{i18n>Supplier}',
                                   newSupplierName : String(120) @title: '{i18n>NewSupplierName}',
                                   invoiceNumber : String(50) @title: '{i18n>InvoiceNumber}',
                                   invoiceDate : Date @title: '{i18n>InvoiceDate}',
                                   dueDate : Date @title: '{i18n>DueDate}',
                                   netAmount : Decimal(15, 2) @title: '{i18n>NetAmount}',
                                   taxAmount : Decimal(15, 2) @title: '{i18n>TaxAmount}',
                                   expenseCategory : UUID @title: '{i18n>ExpenseCategory}') returns SupplierInvoices;
      @title: '{i18n>Ignore}'
      action ignore()                                          returns IncomingDocuments;
    };

  entity ExpenseCategories        as projection on my.ExpenseCategories;

  @readonly
  @cds.redirection.target: false
  entity SupplierBalances         as projection on my.SupplierBalances;

  @readonly
  entity Payments                 as projection on my.Payments;

  @readonly
  entity FinancialComments as projection on my.FinancialComments
    actions {
      @title: '{i18n>Resolve}'
      action resolve() returns FinancialComments;
    };

  @readonly
  entity PaymentStatuses          as projection on my.PaymentStatuses;

  @readonly
  entity IncomingDocumentStatuses as projection on my.IncomingDocumentStatuses;

  /** Adds one file to the inbox in a single step (no draft) and reads its invoice data. */
  @requires: 'OrganizationMember'
  action uploadDocument(fileName : String(255), mediaType : String(100), content : LargeBinary) returns IncomingDocuments;
}

annotate PurchasingService.Suppliers with @odata.draft.enabled;
annotate PurchasingService.SupplierInvoices with @odata.draft.enabled;
annotate PurchasingService.IncomingDocuments with @odata.draft.enabled;
annotate PurchasingService.ExpenseCategories with @odata.draft.enabled;
