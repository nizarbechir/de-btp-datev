using {
  cuid,
  managed,
  Country,
  Currency,
  sap.common.CodeList
} from '@sap/cds/common';
using {
  swiver.Amount,
  swiver.PaymentStatuses
} from './schema';
using {swiver.OrganizationOwned} from './organizations';
using {
  swiver.Payments,
  swiver.ReminderRecords
} from './finance';

namespace swiver;

// Without a fixed scale, so the UI shows 10 days and 19 %, not 10.000 and 19.00.
type Quantity : Decimal;
type TaxRate  : Decimal;

/**
 * Companies and people the business sells to.
 * Customers are deactivated rather than deleted, so their invoices stay intact.
 */
@assert: (case
            when companyName is null and name is null
            then 'CUSTOMER_NAME_MISSING'
          end)
entity Customers : cuid, managed, OrganizationOwned {
  // Assigned by the backend when the customer is saved for the first time.
  customerNumber : String(20);
  companyName    : String(120);
  name           : String(120);
  displayName    : String(120) = coalesce(companyName, name);
  email          : String(120);
  phone          : String(40);
  street         : String(200);
  postalCode     : String(10);
  city           : String(80);
  country        : Country default 'DE';
  taxNumber      : String(30);
  vatId          : String(20);
  // Used to recognize the customer's bank transfers.
  iban           : String(34);
  notes          : String(1000);
  active         : Boolean default true;
  invoices       : Association to many SalesInvoices
                     on invoices.customer = $self;
  balance        : Association to CustomerBalances
                     on balance.customer_ID = ID;
}

/**
 * Invoices the business writes to its customers.
 * Totals are calculated by the backend from the items.
 * The document status (draft, finalized, sent, cancelled) and the payment status (open, partially
 * paid, paid) are separate: the payment status follows from the payments. Overdue is not stored.
 */
entity SalesInvoices : cuid, managed, OrganizationOwned {
  // Assigned by the backend when the invoice is saved for the first time, e.g. INV-2026-0001.
  invoiceNumber            : String(30);
  customer                 : Association to Customers @mandatory;
  invoiceDate              : Date @mandatory;
  dueDate                  : Date @mandatory  @assert: (case
                                                          when dueDate < invoiceDate
                                                          then 'DUE_DATE_BEFORE_INVOICE_DATE'
                                                        end);
  currency                 : Currency @mandatory default 'EUR';
  status                   : Association to SalesInvoiceStatuses default 'DRAFT';
  subject                  : String(200);
  introductionText         : String(2000);
  footerText               : String(2000);
  netAmount                : Amount default 0;
  taxAmount                : Amount default 0;
  grossAmount              : Amount default 0;
  // Maintained by the backend from the payments.
  paymentStatus            : Association to PaymentStatuses default 'OPEN';
  paidAmount               : Amount default 0;
  outstandingAmount        : Amount = grossAmount - coalesce(paidAmount, 0);
  // Date of the last payment.
  paymentDate              : Date;
  notes                    : String(1000);
  // Correction workflow: an issued invoice is cancelled and replaced, never deleted.
  replacesInvoice          : Association to SalesInvoices;
  replacedBy               : Association to SalesInvoices
                               on replacedBy.replacesInvoice = $self;
  quote                    : Association to Quotes;
  sentAt                   : Timestamp;
  sentTo                   : String(255);
  emailMessageId           : String(255);
  items                    : Composition of many SalesInvoiceItems
                               on items.invoice = $self;
  taxes                    : Composition of many SalesInvoiceTaxes
                               on taxes.invoice = $self;
  payments                 : Association to many Payments
                               on payments.salesInvoice = $self;
  reminders                : Association to many ReminderRecords
                               on reminders.invoice = $self;
  isIssued                 : Boolean = (status.code = 'FINALIZED' or status.code = 'SENT');
  isOverdue                : Boolean = ((status.code = 'FINALIZED' or status.code = 'SENT') and paymentStatus.code != 'PAID' and dueDate < current_date);
  displayStatus            : String(20) = (case
                                             when status.code = 'DRAFT' or status.code = 'CANCELLED'
                                             then status.name
                                             when paymentStatus.code = 'PAID'
                                             then 'Paid'
                                             when dueDate < current_date
                                             then 'Overdue'
                                             when paymentStatus.code = 'PARTIAL'
                                             then 'Partially Paid'
                                             else status.name
                                           end);
  displayStatusCriticality : Integer = (case
                                          when status.code = 'DRAFT' or status.code = 'CANCELLED'
                                          then 0
                                          when paymentStatus.code = 'PAID'
                                          then 3
                                          when dueDate < current_date
                                          then 1
                                          when paymentStatus.code = 'PARTIAL'
                                          then 2
                                          else 5
                                        end);
  // Only drafts can be edited. Issued invoices are corrected by cancelling and replacing them.
  isEditable               : Boolean = (status.code = 'DRAFT');
  isLocked                 : Boolean = (status.code != 'DRAFT');
  isClosed                 : Boolean = (status.code = 'CANCELLED' or paymentStatus.code = 'PAID');
}

/**
 * One line of a sales invoice. Net, tax and gross amounts are calculated by the backend.
 */
entity SalesInvoiceItems : cuid {
  invoice        : Association to SalesInvoices;
  position       : Integer;
  // Optional: picking a product or service fills description, unit, price and VAT rate.
  productService : Association to ProductServices;
  description : String(500) @mandatory;
  quantity    : Quantity @mandatory default 1  @assert: (case
                                                            when quantity <= 0
                                                            then 'QUANTITY_NOT_POSITIVE'
                                                          end);
  unit        : String(20) default 'piece';
  unitPrice   : Amount @mandatory  @assert: (case
                                               when unitPrice < 0
                                               then 'AMOUNT_NEGATIVE'
                                             end);
  taxRate     : TaxRate @mandatory default 19  @assert: (case
                                                            when taxRate < 0
                                                            then 'TAX_RATE_NEGATIVE'
                                                          end);
  netAmount   : Amount default 0;
  taxAmount   : Amount default 0;
  grossAmount : Amount default 0;
}

/**
 * Net and tax amount per tax rate of a sales invoice, maintained by the backend.
 */
entity SalesInvoiceTaxes : cuid {
  invoice   : Association to SalesInvoices;
  taxRate   : TaxRate;
  netAmount : Amount;
  taxAmount : Amount;
}

entity SalesInvoiceStatuses : CodeList {
  key code : String(10) enum {
        draft     = 'DRAFT';
        finalized = 'FINALIZED';
        sent      = 'SENT';
        cancelled = 'CANCELLED';
      };
}

/** Units suggested for invoice items. Any other unit can be typed in. */
entity Units {
  key code : String(20);
}

/**
 * Last number given out per number range, e.g. sales invoices of a year.
 * Incremented inside the saving transaction, so numbers are unique and have no gaps.
 */
entity NumberRanges {
  // <organization ID>:<range>, e.g. ...:SalesInvoice-2026, so every organization has its own numbers.
  key range      : String(80);
      lastNumber : Integer default 0;
}

/**
 * Invoiced, outstanding and overdue amounts per customer.
 * Drafts and cancelled invoices are not counted.
 */
@readonly
view CustomerBalances as
  select from SalesInvoices {
    key customer.ID                                        as customer_ID,
        organization.ID                                    as organization_ID : UUID,
        count(1)                                           as invoiceCount   : Integer,
        sum(case
              when status.code = 'FINALIZED' or status.code = 'SENT'
              then grossAmount
              else 0
            end)                                           as totalInvoiced  : Decimal(15, 2),
        sum(case
              when status.code = 'FINALIZED' or status.code = 'SENT'
              then grossAmount - coalesce(paidAmount, 0)
              else 0
            end)                                           as outstanding    : Decimal(15, 2),
        sum(case
              when (status.code = 'FINALIZED' or status.code = 'SENT') and dueDate < current_date
              then grossAmount - coalesce(paidAmount, 0)
              else 0
            end)                                           as overdue        : Decimal(15, 2),
        min(currency.code)                                 as currency_code  : String(3)
  }
  group by
    customer.ID,
    organization.ID;

/**
 * Products and services the business sells, used to fill invoice and quote lines quickly.
 * No stock is kept.
 */
entity ProductServices : cuid, managed, OrganizationOwned {
  code           : String(40);
  name           : String(200) @mandatory;
  description    : String(1000);
  unit           : String(20) default 'piece';
  defaultPrice   : Amount default 0;
  defaultTaxRate : TaxRate default 19;
  active         : Boolean default true;
}

/**
 * Offers to customers. Accepted quotes are converted into a draft sales invoice.
 * Totals are calculated by the backend with the same rules as sales invoices.
 */
entity Quotes : cuid, managed, OrganizationOwned {
  // Assigned by the backend when the quote is saved for the first time, e.g. QUO-2026-0001.
  quoteNumber              : String(30);
  customer                 : Association to Customers @mandatory;
  quoteDate                : Date @mandatory;
  validUntil               : Date @assert: (case
                                              when validUntil < quoteDate
                                              then 'VALID_UNTIL_BEFORE_QUOTE_DATE'
                                            end);
  currency                 : Currency @mandatory default 'EUR';
  status                   : Association to QuoteStatuses default 'DRAFT';
  subject                  : String(200);
  introductionText         : String(2000);
  footerText               : String(2000);
  netAmount                : Amount default 0;
  taxAmount                : Amount default 0;
  grossAmount              : Amount default 0;
  convertedInvoice         : Association to SalesInvoices;
  sentAt                   : Timestamp;
  sentTo                   : String(255);
  notes                    : String(1000);
  items                    : Composition of many QuoteItems
                               on items.quote = $self;
  isExpired                : Boolean = ((status.code = 'DRAFT' or status.code = 'SENT') and validUntil < current_date);
  displayStatus            : String(20) = (case
                                             when (status.code = 'DRAFT' or status.code = 'SENT') and validUntil < current_date
                                             then 'Expired'
                                             else status.name
                                           end);
  displayStatusCriticality : Integer = (case
                                          when (status.code = 'DRAFT' or status.code = 'SENT') and validUntil < current_date
                                          then 1
                                          when status.code = 'ACCEPTED'
                                          then 3
                                          when status.code = 'REJECTED'
                                          then 1
                                          when status.code = 'SENT'
                                          then 5
                                          else 0
                                        end);
  isEditable               : Boolean = (status.code = 'DRAFT' or status.code = 'SENT');
}

/** One line of a quote, same rules as a sales invoice item. */
entity QuoteItems : cuid {
  quote          : Association to Quotes;
  position       : Integer;
  productService : Association to ProductServices;
  description    : String(500) @mandatory;
  quantity       : Quantity @mandatory default 1  @assert: (case
                                                               when quantity <= 0
                                                               then 'QUANTITY_NOT_POSITIVE'
                                                             end);
  unit           : String(20) default 'piece';
  unitPrice      : Amount @mandatory  @assert: (case
                                                  when unitPrice < 0
                                                  then 'AMOUNT_NEGATIVE'
                                                end);
  taxRate        : TaxRate @mandatory default 19  @assert: (case
                                                               when taxRate < 0
                                                               then 'TAX_RATE_NEGATIVE'
                                                             end);
  netAmount      : Amount default 0;
  taxAmount      : Amount default 0;
  grossAmount    : Amount default 0;
}

entity QuoteStatuses : CodeList {
  key code : String(10) enum {
        draft    = 'DRAFT';
        sent     = 'SENT';
        accepted = 'ACCEPTED';
        rejected = 'REJECTED';
        expired  = 'EXPIRED';
      };
}
