using {swiver as my} from '../../db/organizations';
using from '../../db/settings';
using from '../../db/collaboration';

/**
 * The signed-in user's organization: company settings, members and onboarding.
 */
service OrganizationService @(path: '/odata/v4/organization') {
  @Capabilities: {
    InsertRestrictions.Insertable: false,
    DeleteRestrictions.Deletable : false
  }
  entity Organizations     as projection on my.Organizations {
    *,
    virtual null as isCurrent : Boolean @title: '{i18n>CurrentOrganization}',
    virtual null as readOnly  : Boolean @UI.Hidden
  }
    actions {
      /** Sends an invitation e-mail; the membership is created when it is accepted. */
      @title: '{i18n>InviteMember}'
      action inviteMember(email : String(255) @title: '{i18n>Email}' @mandatory,
                          role : String(12) @title: '{i18n>Role}' @mandatory) returns Invitations;
      /** Makes this organization the one the user works in, for users with several memberships. */
      @title: '{i18n>SwitchOrganization}'
      action switchTo()                                                        returns Organizations;
    };

  entity Memberships       as projection on my.Memberships;

  @readonly
  entity Invitations       as projection on my.Invitations excluding {
    tokenHash
  }
    actions {
      /** Sends the invitation again with a new link and expiry date. */
      @title: '{i18n>ResendInvitation}'
      action resend() returns Invitations;
      @title: '{i18n>RevokeInvitation}'
      action revoke() returns Invitations;
    };

  @readonly
  entity AuditLogEntries   as projection on my.AuditLogEntries;

  @readonly
  entity MembershipRoles   as projection on my.MembershipRoles;

  @readonly
  entity DocumentLanguages as projection on my.DocumentLanguages;

  @Capabilities: {
    InsertRestrictions.Insertable: false,
    DeleteRestrictions.Deletable : false
  }
  entity CompanySettings   as projection on my.CompanySettings;

  type CurrentOrganization {
    organizationID : UUID;
    name           : String(120);
    role           : String(10);
    settingsID     : Integer;
    userId         : String(255);
  }

  /** The organization of the signed-in user, or nothing if the user has none yet. */
  function myOrganization() returns CurrentOrganization;

  /** Creates an organization with the signed-in user as owner, its settings and default expense categories. */
  action   createOrganization(companyName : String(120),
                              country : String(3),
                              currency : String(3),
                              vatId : String(20),
                              defaultTaxRate : Decimal,
                              defaultPaymentTermDays : Integer,
                              invoicePrefix : String(10)) returns CurrentOrganization;

  /** All data and documents of the organization as zip, for owners and admins (data export, offboarding). */
  @title: '{i18n>ExportOrganizationData}'
  function exportOrganizationData()        returns LargeBinary @Core.MediaType: 'application/zip';

  /** Accepts an invitation with the token from the e-mail link and creates the membership. */
  action   acceptInvitation(token : String(100)) returns CurrentOrganization;
}

annotate OrganizationService.Organizations with @odata.draft.enabled;
annotate OrganizationService.CompanySettings with @odata.draft.enabled;
