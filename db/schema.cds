using {
  cuid,
  managed,
  Country,
  Currency,
  sap.common.CodeList
} from '@sap/cds/common';
using {swiver.OrganizationOwned} from './organizations';
using {swiver.Payments} from './finance';

namespace swiver;

type Amount : Decimal(15, 2);

/**
 * Companies the business buys from.
 * Suppliers are deactivated rather than deleted, so their invoices stay intact.
 */
entity Suppliers : cuid, managed, OrganizationOwned {
  name           : String(120) @mandatory;
  supplierNumber : String(20);
  taxNumber      : String(30);
  vatId          : String(20);
  email          : String(120);
  phone          : String(40);
  address        : String(200);
  city           : String(80);
  postalCode     : String(10);
  country        : Country;
  iban           : String(34);
  notes          : String(1000);
  active         : Boolean default true;
  invoices       : Association to many SupplierInvoices
                     on invoices.supplier = $self;
  balance        : Association to SupplierBalances
                     on balance.supplier_ID = ID;
}

/**
 * Invoices received from suppliers, including the original document.
 * Overdue is not stored: it is derived from the payment status and the due date.
 */
entity SupplierInvoices : cuid, managed, OrganizationOwned {
  supplier          : Association to Suppliers @mandatory;
  expenseCategory   : Association to ExpenseCategories;
  invoiceNumber     : String(50) @mandatory;
  invoiceDate       : Date @mandatory;
  dueDate           : Date @assert: (case
                                       when dueDate < invoiceDate
                                       then 'DUE_DATE_BEFORE_INVOICE_DATE'
                                     end);
  currency          : Currency @mandatory default 'EUR';
  netAmount         : Amount @mandatory  @assert: (case
                                                    when netAmount < 0
                                                    then 'AMOUNT_NEGATIVE'
                                                  end);
  taxAmount         : Amount @mandatory default 0  @assert: (case
                                                              when taxAmount < 0
                                                              then 'AMOUNT_NEGATIVE'
                                                            end);
  grossAmount       : Amount = netAmount + taxAmount;
  notes             : String(1000);
  // Maintained by the backend from the payments: OPEN, PARTIAL or PAID.
  paymentStatus     : Association to PaymentStatuses default 'OPEN';
  // Date of the last payment.
  paymentDate       : Date;
  paidAmount        : Amount default 0;
  outstandingAmount : Amount = netAmount + taxAmount - coalesce(paidAmount, 0);
  isOverdue         : Boolean = (paymentStatus.code != 'PAID' and dueDate < current_date);
  status            : String(20) = (case
                                      when paymentStatus.code = 'PAID'
                                      then 'Paid'
                                      when dueDate < current_date
                                      then 'Overdue'
                                      when paymentStatus.code = 'PARTIAL'
                                      then 'Partially Paid'
                                      else 'Open'
                                    end);
  statusCriticality : Integer = (case
                                   when paymentStatus.code = 'PAID'
                                   then 3
                                   when dueDate < current_date
                                   then 1
                                   when paymentStatus.code = 'PARTIAL'
                                   then 2
                                   else 0
                                 end);
  payments          : Association to many Payments
                        on payments.supplierInvoice = $self;
  // The inbox document this invoice was created from, if any.
  incomingDocument  : Association to IncomingDocuments;
  // The original invoice (PDF, PNG or JPEG). One document per invoice.
  documentContent   : LargeBinary @Core.MediaType: documentMediaType
                                  @Core.ContentDisposition.Filename: documentFileName
                                  @Core.AcceptableMediaTypes: [
                                    'application/pdf',
                                    'image/png',
                                    'image/jpeg'
                                  ];
  documentMediaType : String(100) @Core.IsMediaType;
  documentFileName  : String(255);
}

entity PaymentStatuses : CodeList {
  key code : String(10) enum {
        open    = 'OPEN';
        partial = 'PARTIAL';
        paid    = 'PAID';
      };
}

/**
 * Invoice count and open amount per supplier.
 */
@readonly
view SupplierBalances as
  select from SupplierInvoices {
    key supplier.ID                                           as supplier_ID,
        organization.ID                                       as organization_ID : UUID,
        count(1)                                              as invoiceCount : Integer,
        sum(case
              when paymentStatus.code = 'PAID'
              then 0
              else netAmount + taxAmount - coalesce(paidAmount, 0)
            end)                                              as openAmount   : Decimal(15, 2),
        min(currency.code)                                    as currency_code : String(3)
  }
  group by
    supplier.ID,
    organization.ID;

/**
 * Simple grouping of expenses, e.g. Software, Travel or Rent. Each organization has its own list.
 * TODO(feature): DATEV/account mappings
 * TODO(feature): full bookkeeping chart of accounts
 */
entity ExpenseCategories : cuid, managed, OrganizationOwned {
  name   : String(80) @mandatory;
  active : Boolean default true;
}

/**
 * A supplier document waiting to be processed: uploaded first, then turned into a supplier invoice.
 */
entity IncomingDocuments : cuid, managed, OrganizationOwned {
  originalFileName      : String(255);
  content               : LargeBinary @Core.MediaType: mediaType
                                      @Core.ContentDisposition.Filename: originalFileName
                                      @Core.AcceptableMediaTypes: [
                                        'application/pdf',
                                        'image/png',
                                        'image/jpeg'
                                      ];
  mediaType             : String(100) @Core.IsMediaType;
  uploadedAt            : Timestamp @cds.on.insert: $now;
  source                : String(20) default 'UPLOAD';
  processingStatus      : Association to IncomingDocumentStatuses default 'NEW';
  // ZUGFERD when the PDF contains an e-invoice, otherwise PDF or IMAGE.
  detectedDocumentType  : String(20);
  linkedSupplierInvoice : Association to SupplierInvoices;
  notes                 : String(1000);
  // Read from an embedded e-invoice (ZUGFeRD), proposed when the supplier invoice is created.
  extractedSupplier     : Association to Suppliers;
  extractedSupplierName : String(120);
  extractedVatId        : String(20);
  extractedIBAN         : String(34);
  extractedInvoiceNumber: String(50);
  extractedInvoiceDate  : Date;
  extractedDueDate      : Date;
  extractedCurrency     : Currency;
  extractedNetAmount    : Amount;
  extractedTaxAmount    : Amount;
  extractedGrossAmount  : Amount;
  processingMessage     : String(500);
  statusCriticality     : Integer = (case
                                       when processingStatus.code = 'PROCESSED'
                                       then 3
                                       when processingStatus.code = 'ERROR'
                                       then 1
                                       when processingStatus.code = 'NEW'
                                       then 2
                                       else 0
                                     end);
}

entity IncomingDocumentStatuses : CodeList {
  key code : String(10) enum {
        new       = 'NEW';
        processed = 'PROCESSED';
        ignored   = 'IGNORED';
        error     = 'ERROR';
      };
}
