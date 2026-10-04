using {swiver as my} from '../../db/schema';
using from '../../db/sales';
using from '../../db/finance';
using from '../../db/collaboration';
using from '../../db/inventory';

/**
 * Money in: customers, products and services, quotes and sales invoices.
 */
service SalesService @(path: '/odata/v4/sales') {
  entity Customers            as projection on my.Customers {
    *,
    balance : redirected to CustomerBalances
  };

  entity ProductServices      as projection on my.ProductServices;

  entity SalesInvoices        as projection on my.SalesInvoices
    actions {
      /** Adds a comment or question, e.g. from the tax advisor. */
      @title: '{i18n>AddComment}'
      action   addComment(text : String(1000) @title: '{i18n>Comment}' @UI.MultiLineText) returns SalesInvoices;
      @title: '{i18n>Finalize}'
      action   finalize()                                 returns SalesInvoices;
      @title: '{i18n>MarkAsSent}'
      action   markAsSent()                               returns SalesInvoices;
      /** Records a payment of the open amount, dated today. */
      @title: '{i18n>MarkPaid}'
      action   markAsPaid()                               returns SalesInvoices;
      @title: '{i18n>RecordPayment}'
      action   recordPayment(amount : Decimal(15, 2) @title: '{i18n>Amount}',
                             paymentDate : Date @title: '{i18n>PaymentDate}',
                             reference : String(255) @title: '{i18n>Reference}') returns SalesInvoices;
      @title: '{i18n>CancelInvoice}'
      action   cancelInvoice()                            returns SalesInvoices;
      /** Removes the manually recorded payments, so the invoice is open again. */
      @title: '{i18n>Reopen}'
      action   reopen()                                   returns SalesInvoices;
      /** Cancels an issued invoice and creates a corrected draft that replaces it. */
      @title: '{i18n>Correct}'
      action   correct()                                  returns SalesInvoices;
      /** Copies the invoice into a new draft dated today. */
      @title: '{i18n>Duplicate}'
      action   duplicate()                                returns SalesInvoices;
      /** Sends the invoice with its ZUGFeRD PDF to the customer. */
      @title: '{i18n>SendByEmail}'
      action   sendByEmail(recipient : String(255) @title: '{i18n>Recipient}',
                           subject : String(255) @title: '{i18n>Subject}',
                           message : String(4000) @title: '{i18n>Message}' @UI.MultiLineText) returns SalesInvoices;
      @title: '{i18n>SendReminder}'
      action   sendReminder(recipient : String(255) @title: '{i18n>Recipient}') returns SalesInvoices;
      /** Creates a customer and assigns it to this invoice, without leaving the invoice. */
      @title: '{i18n>NewCustomer}'
      action   createCustomer(companyName : String(120) @title: '{i18n>CompanyName}',
                              name : String(120) @title: '{i18n>ContactName}',
                              email : String(120) @title: '{i18n>Email}',
                              street : String(200) @title: '{i18n>Address}',
                              postalCode : String(10) @title: '{i18n>PostalCode}',
                              city : String(80) @title: '{i18n>City}',
                              country : String(3) @title: '{i18n>Country}') returns SalesInvoices;
      /** The invoice as PDF, inline for the preview or as attachment for download. */
      @title: '{i18n>DownloadPdf}'
      function pdf(download : Boolean)                    returns LargeBinary @Core.MediaType: 'application/pdf';
      /** The finalized invoice as ZUGFeRD (PDF/A-3 with embedded EN 16931 XML). */
      @title: '{i18n>DownloadZugferd}'
      function zugferd(download : Boolean)                returns LargeBinary @Core.MediaType: 'application/pdf';
    };

  entity Quotes               as projection on my.Quotes
    actions {
      @title: '{i18n>MarkAsSent}'
      action   markAsSent()                               returns Quotes;
      @title: '{i18n>Accept}'
      action   accept()                                   returns Quotes;
      @title: '{i18n>Reject}'
      action   rejectQuote()                              returns Quotes;
      /** Creates a draft sales invoice from the quote. */
      @title: '{i18n>ConvertToInvoice}'
      action   convertToInvoice(force : Boolean @title: '{i18n>ConvertAgain}') returns SalesInvoices;
      @title: '{i18n>SendByEmail}'
      action   sendByEmail(recipient : String(255) @title: '{i18n>Recipient}',
                           subject : String(255) @title: '{i18n>Subject}',
                           message : String(4000) @title: '{i18n>Message}' @UI.MultiLineText) returns Quotes;
      @title: '{i18n>DownloadPdf}'
      function pdf(download : Boolean)                    returns LargeBinary @Core.MediaType: 'application/pdf';
      /** Creates a draft delivery note with the quote's goods. */
      @title: '{i18n>CreateDeliveryNote}'
      action   createDeliveryNote()                       returns DeliveryNotes;
    };

  entity DeliveryNotes        as projection on my.DeliveryNotes
    actions {
      /** Books the delivered goods out of stock and locks the delivery note. Repeating it changes nothing. */
      @title: '{i18n>ConfirmDelivery}'
      action confirm()                                    returns DeliveryNotes;
      /** Creates the draft sales invoice: from the quote if the delivery note has one, otherwise from its items. */
      @title: '{i18n>CreateInvoice}'
      action createInvoice()                              returns SalesInvoices;
    };

  entity DeliveryNoteItems    as projection on my.DeliveryNoteItems
    actions {
      /** Books goods returned by the customer back into stock. The refund is a correction of the invoice. */
      @title: '{i18n>CustomerReturn}'
      action returnGoods(quantity : Decimal @title: '{i18n>Quantity}',
                         reason : String(255) @title: '{i18n>Reason}') returns DeliveryNoteItems;
    };

  @readonly
  entity Suppliers            as projection on my.Suppliers {
    ID,
    name,
    city,
    active,
    organization
  };

  @readonly
  entity ProductTypes         as projection on my.ProductTypes;

  @readonly
  entity DeliveryNoteStatuses as projection on my.DeliveryNoteStatuses;

  @readonly
  entity StockMovements       as projection on my.StockMovements;

  @readonly
  entity StockMovementTypes   as projection on my.StockMovementTypes;

  @readonly
  @cds.redirection.target: false
  entity CustomerBalances     as projection on my.CustomerBalances;

  @readonly
  entity Payments             as projection on my.Payments;

  @readonly
  entity ReminderRecords      as projection on my.ReminderRecords;

  @readonly
  entity SalesInvoiceStatuses as projection on my.SalesInvoiceStatuses;

  @readonly
  entity QuoteStatuses        as projection on my.QuoteStatuses;

  @readonly
  entity PaymentStatuses      as projection on my.PaymentStatuses;

  @readonly
  entity FinancialComments as projection on my.FinancialComments
    actions {
      @title: '{i18n>Resolve}'
      action resolve() returns FinancialComments;
    };

  @readonly
  entity Units                as projection on my.Units;
}

annotate SalesService.Customers with @odata.draft.enabled;
annotate SalesService.SalesInvoices with @odata.draft.enabled;
annotate SalesService.Quotes with @odata.draft.enabled;
annotate SalesService.ProductServices with @odata.draft.enabled;
annotate SalesService.DeliveryNotes with @odata.draft.enabled;
