using {
  cuid,
  managed,
  Country,
  Currency,
  sap.common.CodeList
} from '@sap/cds/common';
using {swiver.Amount} from './schema';

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
entity Customers : cuid, managed {
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
  notes          : String(1000);
  active         : Boolean default true;
  invoices       : Association to many SalesInvoices
                     on invoices.customer = $self;
  balance        : Association to CustomerBalances
                     on balance.customer_ID = ID;
}

/**
 * Invoices the business writes to its customers.
 * Totals are calculated by the backend from the items. Overdue is not stored:
 * it is derived from the status and the due date.
 */
entity SalesInvoices : cuid, managed {
  // Assigned by the backend when the invoice is saved for the first time, e.g. INV-2026-0001.
  invoiceNumber           : String(30);
  customer                : Association to Customers @mandatory;
  invoiceDate             : Date @mandatory;
  dueDate                 : Date @mandatory  @assert: (case
                                                         when dueDate < invoiceDate
                                                         then 'DUE_DATE_BEFORE_INVOICE_DATE'
                                                       end);
  currency                : Currency @mandatory default 'EUR';
  status                  : Association to SalesInvoiceStatuses default 'DRAFT';
  subject                 : String(200);
  introductionText        : String(2000);
  footerText              : String(2000);
  netAmount               : Amount default 0;
  taxAmount               : Amount default 0;
  grossAmount             : Amount default 0;
  paymentDate             : Date;
  notes                   : String(1000);
  items                   : Composition of many SalesInvoiceItems
                              on items.invoice = $self;
  taxes                   : Composition of many SalesInvoiceTaxes
                              on taxes.invoice = $self;
  isOverdue               : Boolean = (status.code = 'SENT' and dueDate < current_date);
  displayStatus           : String(10) = (case
                                            when status.code = 'SENT' and dueDate < current_date
                                            then 'Overdue'
                                            else status.name
                                          end);
  displayStatusCriticality : Integer = (case
                                          when status.code = 'SENT' and dueDate < current_date
                                          then 1
                                          when status.code = 'SENT'
                                          then 5
                                          when status.code = 'PAID'
                                          then 3
                                          else 0
                                        end);
  // Paid and cancelled invoices are closed; they can be reopened, but not edited.
  isEditable              : Boolean = (status.code = 'DRAFT' or status.code = 'SENT');
  isClosed                : Boolean = (status.code = 'PAID' or status.code = 'CANCELLED');
}

/**
 * One line of a sales invoice. Net, tax and gross amounts are calculated by the backend.
 */
entity SalesInvoiceItems : cuid {
  invoice     : Association to SalesInvoices;
  position    : Integer;
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
        sent      = 'SENT';
        paid      = 'PAID';
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
  key range      : String(30);
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
        count(1)                                           as invoiceCount   : Integer,
        sum(case
              when status.code = 'SENT' or status.code = 'PAID'
              then grossAmount
              else 0
            end)                                           as totalInvoiced  : Decimal(15, 2),
        sum(case
              when status.code = 'SENT'
              then grossAmount
              else 0
            end)                                           as outstanding    : Decimal(15, 2),
        sum(case
              when status.code = 'SENT' and dueDate < current_date
              then grossAmount
              else 0
            end)                                           as overdue        : Decimal(15, 2),
        min(currency.code)                                 as currency_code  : String(3)
  }
  group by
    customer.ID;
