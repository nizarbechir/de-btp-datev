using {
  cuid,
  managed,
  Currency
} from '@sap/cds/common';
using {swiver.Amount} from './schema';
using {swiver.OrganizationOwned} from './organizations';
using {
  swiver.SalesInvoices,
  swiver.Customers
} from './sales';
using {
  swiver.SupplierInvoices,
  swiver.Suppliers
} from './schema';

namespace swiver;

/**
 * Money received from a customer or paid to a supplier, for one invoice.
 * The payment status and open amount of the invoice are calculated from its payments.
 */
entity Payments : cuid, managed, OrganizationOwned {
  direction       : String(3) enum {
    incoming = 'IN';
    outgoing = 'OUT';
  };
  amount          : Amount @mandatory;
  currency        : Currency default 'EUR';
  paymentDate     : Date @mandatory;
  reference       : String(255);
  // MANUAL (entered or Mark as Paid) or BANK (confirmed bank match).
  source          : String(10) default 'MANUAL';
  salesInvoice    : Association to SalesInvoices;
  supplierInvoice : Association to SupplierInvoices;
  bankTransaction : Association to BankTransactions;
}

/** One uploaded bank statement file. */
entity BankImportBatches : cuid, managed, OrganizationOwned {
  fileName         : String(255);
  adapter          : String(40);
  importedCount    : Integer default 0;
  duplicateCount   : Integer default 0;
  transactions     : Association to many BankTransactions
                       on transactions.importBatch = $self;
}

/**
 * A booking on the business bank account, imported from a CSV statement.
 * Positive amounts are money in, negative amounts money out.
 * TODO(feature): PSD2/live bank connection
 */
entity BankTransactions : cuid, managed, OrganizationOwned {
  bookingDate            : Date @mandatory;
  valueDate              : Date;
  amount                 : Amount @mandatory;
  currency               : Currency default 'EUR';
  counterpartyName       : String(200);
  counterpartyIBAN       : String(34);
  reference              : String(1000);
  externalReference      : String(100);
  importBatch            : Association to BankImportBatches;
  matchStatus            : Association to BankMatchStatuses default 'UNMATCHED';
  // Identifies the booking across imports, so the same statement can be imported twice safely.
  fingerprint            : String(64);
  // Best deterministic match, waiting for confirmation.
  suggestedSalesInvoice    : Association to SalesInvoices;
  suggestedSupplierInvoice : Association to SupplierInvoices;
  suggestionReason       : String(200);
  payment                : Association to Payments;
  direction              : String(3) = (case
                                          when amount < 0
                                          then 'OUT'
                                          else 'IN'
                                        end);
  // The document of the suggested supplier invoice, to compare before confirming.
  suggestedDocument      : LargeBinary = suggestedSupplierInvoice.documentContent  @Core.MediaType: suggestedDocumentType
                                                                                   @Core.ContentDisposition.Type: 'inline';
  suggestedDocumentType  : String(100) = suggestedSupplierInvoice.documentMediaType;
  // Money in green, money out red.
  amountCriticality      : Integer = (case
                                        when amount < 0
                                        then 1
                                        else 3
                                      end);
  matchStatusCriticality : Integer = (case
                                        when matchStatus.code = 'MATCHED'
                                        then 3
                                        when matchStatus.code = 'SUGGESTED'
                                        then 2
                                        when matchStatus.code = 'UNMATCHED'
                                        then 1
                                        else 0
                                      end);
}

entity BankMatchStatuses {
  key code  : String(10) enum {
        unmatched = 'UNMATCHED';
        suggested = 'SUGGESTED';
        matched   = 'MATCHED';
        ignored   = 'IGNORED';
      };
      name  : localized String(60);
}

/**
 * A payment reminder sent for an overdue sales invoice.
 * TODO(feature): automatic configurable dunning/reminder schedules
 */
entity ReminderRecords : cuid, managed, OrganizationOwned {
  invoice   : Association to SalesInvoices;
  sentAt    : Timestamp;
  recipient : String(255);
  level     : Integer default 1;
  subject   : String(255);
  message   : LargeString;
}
