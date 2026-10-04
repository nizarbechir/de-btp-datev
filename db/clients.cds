using {
  cuid,
  managed
} from '@sap/cds/common';
using {
  swiver.Organizations,
  swiver.Memberships
} from './organizations';
using {
  swiver.SupplierInvoices,
  swiver.IncomingDocuments
} from './schema';
using {swiver.BankTransactions} from './finance';
using {
  swiver.FinancialComments,
  swiver.AuditLogEntries
} from './collaboration';

namespace swiver;

/**
 * A tax firm (Steuerberatungskanzlei) with its staff. A client grants access to the firm by
 * inviting one of its staff; the firm then decides which of its staff work on which client.
 * Each assignment becomes an ordinary TAX_ADVISOR membership of the client (srv/organizations/tax-firms.ts),
 * so the client sees every person with access in its member list and can remove them.
 */
entity TaxFirms : cuid, managed {
  name    : String(120) @mandatory;
  staff   : Composition of many TaxFirmStaff
              on staff.firm = $self;
  clients : Composition of many TaxFirmClients
              on clients.firm = $self;
}

entity TaxFirmStaff : cuid {
  firm   : Association to TaxFirms;
  // The user ID the person signs in with (usually the e-mail address).
  userId : String(255) @mandatory;
  role   : String(10) enum {
    admin = 'ADMIN';
    staff = 'STAFF';
  } default 'STAFF';
}

/** A client of the firm: added when a client's invitation is accepted, never by the firm itself. */
entity TaxFirmClients : cuid {
  firm         : Association to TaxFirms;
  organization : Association to Organizations;
  clientName   : String = organization.name;
  assignments  : Composition of many TaxFirmAssignments
                   on assignments.client = $self;
}

/** Who of the firm's staff works on a client. */
entity TaxFirmAssignments : cuid {
  client : Association to TaxFirmClients;
  staff  : Association to TaxFirmStaff @mandatory;
}

extend Memberships with {
  // Set on memberships the firm manages through its assignments.
  firm : Association to TaxFirms;
}

/**
 * One row per organization with what is open for the bookkeeping, for the client cockpit of tax
 * advisors and of users with several organizations.
 */
@readonly
view ClientOverview as
  select from Organizations as organization {
    key organization.ID,
        organization.name,
        organization.status,
        organization.members,
        (
          select count(1) from FinancialComments as comment
          where
                comment.organization.ID = organization.ID
            and comment.resolved        = false
        ) as openQuestions         : Integer,
        (
          select count(1) from SupplierInvoices as invoice
          where
                invoice.organization.ID  = organization.ID
            and invoice.documentFileName is null
        ) as missingDocuments      : Integer,
        (
          select count(1) from SupplierInvoices as invoice
          where
                invoice.organization.ID = organization.ID
            and invoice.expenseCategory.ID is null
        ) as uncategorized         : Integer,
        (
          select count(1) from IncomingDocuments as receipt
          where
                receipt.organization.ID = organization.ID
            and (
                 receipt.processingStatus.code = 'NEW'
              or receipt.processingStatus.code = 'ERROR'
            )
        ) as unprocessedReceipts   : Integer,
        (
          select count(1) from BankTransactions as transaction
          where
                transaction.organization.ID = organization.ID
            and transaction.matchStatus.code = 'UNMATCHED'
        ) as unmatchedTransactions : Integer,
        (
          select max(entry.at) from AuditLogEntries as entry
          where
                entry.organization.ID = organization.ID
            and entry.action          = 'accountantExport'
        ) as lastExportAt          : Timestamp
  };
