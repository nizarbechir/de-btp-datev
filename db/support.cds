using {
  cuid,
  managed,
  sap.common.CodeList
} from '@sap/cds/common';
using {swiver.OrganizationOwned} from './organizations';

namespace swiver;

/**
 * A support request of an organization to the Swiver team. Customers create tickets and reply;
 * support agents (application role SupportAgent, not an organization membership) answer and change
 * the status. The conversation is in SupportMessages, files the customer added in SupportAttachments.
 */
@assert.unique: {ticketNumber: [ticketNumber]}
entity SupportTickets : cuid, managed, OrganizationOwned {
  // Sequential across all organizations (1001, 1002, ...), assigned by the backend on creation.
  ticketNumber : Integer;
  subject      : String(200) @mandatory;
  description  : String(5000) @mandatory;
  category     : Association to SupportCategories default 'GENERAL' @assert.target;
  priority     : Association to SupportPriorities default 'NORMAL' @assert.target;
  status       : Association to SupportStatuses default 'NEW';
  // E-mail address of the creator for notifications, taken from the signed-in user.
  creatorEmail : String(255);
  resolvedAt   : Timestamp;
  messages     : Association to many SupportMessages
                   on messages.ticket = $self;
  attachments  : Composition of many SupportAttachments
                   on attachments.ticket = $self;
}

/** A reply in the conversation of a ticket; the author is createdBy. */
entity SupportMessages : cuid, managed {
  ticket      : Association to SupportTickets;
  message     : String(5000) @mandatory;
  fromSupport : Boolean default false;
}

/** A file the customer attached to a ticket. Only PDF, PNG and JPEG (see core/document-upload.ts). */
entity SupportAttachments : cuid, managed {
  ticket   : Association to SupportTickets;
  fileName : String(255);
  mimeType : String(100) @Core.IsMediaType;
  content  : LargeBinary @Core.MediaType: mimeType
                         @Core.ContentDisposition: {
                           Filename: fileName,
                           Type    : 'attachment'
                         }
                         @Core.AcceptableMediaTypes: [
                           'application/pdf',
                           'image/png',
                           'image/jpeg'
                         ];
}

entity SupportCategories : CodeList {
  key code : String(20) enum {
        general       = 'GENERAL';
        salesInvoices = 'SALES_INVOICES';
        purchases     = 'PURCHASES';
        banking       = 'BANKING';
        taxVat        = 'TAX_VAT';
        accountLogin  = 'ACCOUNT_LOGIN';
        other         = 'OTHER';
      };
}

entity SupportPriorities : CodeList {
  key code : String(10) enum {
        low    = 'LOW';
        normal = 'NORMAL';
        high   = 'HIGH';
      };
}

entity SupportStatuses : CodeList {
  key code        : String(25) enum {
        new                = 'NEW';
        inProgress         = 'IN_PROGRESS';
        waitingForCustomer = 'WAITING_FOR_CUSTOMER';
        resolved           = 'RESOLVED';
        closed             = 'CLOSED';
      };
      criticality : Integer;
}
