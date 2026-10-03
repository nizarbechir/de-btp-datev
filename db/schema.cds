using {
  cuid,
  managed,
  Country,
  Currency,
  sap.common.CodeList
} from '@sap/cds/common';

namespace swiver;

type Amount : Decimal(15, 2);

/**
 * Companies the business buys from.
 * Suppliers are deactivated rather than deleted, so their invoices stay intact.
 */
entity Suppliers : cuid, managed {
  name           : String(120) @mandatory;
  supplierNumber : String(20);
  taxNumber      : String(30);
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
entity SupplierInvoices : cuid, managed {
  supplier          : Association to Suppliers @mandatory;
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
  paymentStatus     : Association to PaymentStatuses default 'OPEN';
  paymentDate       : Date;
  status            : String(10) = (case
                                      when paymentStatus.code = 'PAID'
                                      then 'Paid'
                                      when dueDate < current_date
                                      then 'Overdue'
                                      else 'Open'
                                    end);
  statusCriticality : Integer = (case
                                   when paymentStatus.code = 'PAID'
                                   then 3
                                   when dueDate < current_date
                                   then 1
                                   else 0
                                 end);
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
        open = 'OPEN';
        paid = 'PAID';
      };
}

/**
 * Invoice count and open amount per supplier.
 */
@readonly
view SupplierBalances as
  select from SupplierInvoices {
    key supplier.ID                                           as supplier_ID,
        count(1)                                              as invoiceCount : Integer,
        sum(case
              when paymentStatus.code = 'PAID'
              then 0
              else netAmount + taxAmount
            end)                                              as openAmount   : Decimal(15, 2),
        min(currency.code)                                    as currency_code : String(3)
  }
  group by
    supplier.ID;
