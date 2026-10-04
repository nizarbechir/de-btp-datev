using {
  cuid,
  managed
} from '@sap/cds/common';
using {
  swiver.Organizations,
  swiver.OrganizationOwned
} from './organizations';
using {swiver.SalesInvoices} from './sales';
using {
  swiver.SupplierInvoices,
  swiver.IncomingDocuments
} from './schema';
using {swiver.BankTransactions} from './finance';

namespace swiver;

/**
 * A question or note on a financial record, e.g. "Bitte Beleg hochladen." from the tax advisor.
 * Exactly one of the record associations is set. Comments are added and resolved through actions.
 * TODO(feature): comment notifications
 * TODO(feature): mentions
 * TODO(feature): email notification for unanswered accountant questions
 */
entity FinancialComments : cuid, managed, OrganizationOwned {
  salesInvoice     : Association to SalesInvoices;
  supplierInvoice  : Association to SupplierInvoices;
  incomingDocument : Association to IncomingDocuments;
  bankTransaction  : Association to BankTransactions;
  text             : String(1000) @mandatory;
  // Membership role of the author, so questions of the tax advisor stand out.
  authorRole       : String(12);
  resolved         : Boolean default false;
  resolvedAt       : Timestamp;
  resolvedBy       : String(255);
  resolvedCriticality : Integer = (case
                                     when resolved = true
                                     then 3
                                     else 2
                                   end);
}

extend SalesInvoices with {
  comments : Association to many FinancialComments
               on comments.salesInvoice = $self;
}

extend SupplierInvoices with {
  comments : Association to many FinancialComments
               on comments.supplierInvoice = $self;
}

extend IncomingDocuments with {
  comments : Association to many FinancialComments
               on comments.incomingDocument = $self;
}

extend BankTransactions with {
  comments : Association to many FinancialComments
               on comments.bankTransaction = $self;
}

/**
 * Important business actions (invitations, members, invoice lifecycle, payments, bank matches,
 * exports, comments). Never contains secrets or document contents.
 */
entity AuditLogEntries : cuid, OrganizationOwned {
  at         : Timestamp @cds.on.insert: $now;
  actor      : String(255);
  action     : String(40);
  targetType : String(40);
  targetID   : String(36);
  details    : String(500);
}

extend Organizations with {
  auditLog : Association to many AuditLogEntries
               on auditLog.organization = $self;
}
