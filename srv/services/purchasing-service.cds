using {swiver as my} from '../../db/schema';
using from '../../db/finance';

/**
 * Money out: suppliers, the document inbox, supplier invoices and expense categories.
 */
service PurchasingService @(path: '/odata/v4/purchasing') {
  entity Suppliers                as projection on my.Suppliers {
    *,
    balance : redirected to SupplierBalances
  };

  entity SupplierInvoices         as projection on my.SupplierInvoices
    actions {
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
      /** Reads an embedded e-invoice (ZUGFeRD) again and proposes the invoice data. */
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
  entity PaymentStatuses          as projection on my.PaymentStatuses;

  @readonly
  entity IncomingDocumentStatuses as projection on my.IncomingDocumentStatuses;
}

annotate PurchasingService.Suppliers with @odata.draft.enabled;
annotate PurchasingService.SupplierInvoices with @odata.draft.enabled;
annotate PurchasingService.IncomingDocuments with @odata.draft.enabled;
annotate PurchasingService.ExpenseCategories with @odata.draft.enabled;
