using {swiver as my} from '../../db/clients';

/**
 * The client cockpit: all organizations of the signed-in user (the clients of a tax advisor) with
 * what needs work, the open items across all of them, and the user's tax firm.
 * Unlike the other services, it is not limited to the current organization: each record is visible
 * if the user is a member of its organization (srv/authorization/authorization.cds).
 */
service ClientService @(path: '/odata/v4/clients') {
  @readonly
  entity Clients                 as
    projection on my.ClientOverview {
      *,
      openQuestions + missingDocuments + uncategorized + unprocessedReceipts + unmatchedTransactions as openTasks : Integer,
      case
        when openQuestions + missingDocuments + uncategorized + unprocessedReceipts + unmatchedTransactions > 0
             then 2
        else 3
      end as openTasksCriticality : Integer
    }
    actions {
      /** Makes this the organization the user works in. */
      action open();
    };

  // Open items across all clients

  @readonly
  entity OpenQuestions           as
    projection on my.FinancialComments {
      ID,
      organization,
      organization.name as clientName,
      text,
      authorRole,
      createdAt,
      createdBy,
      salesInvoice.ID     as salesInvoice_ID     : UUID,
      supplierInvoice.ID  as supplierInvoice_ID  : UUID,
      incomingDocument.ID as incomingDocument_ID : UUID,
      bankTransaction.ID  as bankTransaction_ID  : UUID,
      coalesce(
        salesInvoice.invoiceNumber, supplierInvoice.invoiceNumber, incomingDocument.originalFileName, bankTransaction.counterpartyName
      )                 as record              : String(255)
    }
    where
      resolved = false;

  @readonly
  entity SupplierInvoicesToReview as
    projection on my.SupplierInvoices {
      ID,
      organization,
      organization.name as clientName,
      invoiceNumber,
      supplier.name     as supplierName,
      invoiceDate,
      grossAmount,
      currency,
      hasDocument,
      isCategorized
    }
    where
         documentFileName   is null
      or expenseCategory.ID is null;

  @readonly
  entity NewReceipts             as
    projection on my.IncomingDocuments {
      ID,
      organization,
      organization.name as clientName,
      originalFileName,
      uploadedAt,
      processingStatus,
      statusCriticality,
      extractedSupplierName,
      extractedGrossAmount,
      extractedCurrency
    }
    where
         processingStatus.code = 'NEW'
      or processingStatus.code = 'ERROR';

  @readonly
  entity UnmatchedTransactions   as
    projection on my.BankTransactions {
      ID,
      organization,
      organization.name as clientName,
      bookingDate,
      amount,
      currency,
      counterpartyName,
      reference
    }
    where
      matchStatus.code = 'UNMATCHED';

  // The tax firm

  @odata.draft.enabled
  entity TaxFirms                as projection on my.TaxFirms;

  entity TaxFirmStaff            as projection on my.TaxFirmStaff;

  entity TaxFirmClients          as
    projection on my.TaxFirmClients {
      *,
      organization : redirected to Clients
    };

  // Set by the backend only
  annotate TaxFirmStaff with {
    firm @readonly;
  };

  annotate TaxFirmClients with {
    firm         @readonly;
    organization @readonly;
  };

  entity TaxFirmAssignments      as projection on my.TaxFirmAssignments;

  @readonly
  entity TaxFirmStaffRoles       as projection on my.TaxFirmStaffRoles;

  /** Only the user's own memberships; the client list is limited by them. */
  @readonly
  entity Memberships             as projection on my.Memberships {
    ID, organization, userId, role
  };

  /** Creates a tax firm with the signed-in user as admin; the user's existing clients become the firm's clients. */
  action createTaxFirm(name : String(120) @mandatory) returns TaxFirms;
}
