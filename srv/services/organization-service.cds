using {swiver as my} from '../../db/organizations';
using from '../../db/settings';

/**
 * The signed-in user's organization: company settings, members and onboarding.
 */
service OrganizationService @(path: '/odata/v4/organization') {
  @Capabilities: {
    InsertRestrictions.Insertable: false,
    DeleteRestrictions.Deletable : false
  }
  entity Organizations     as projection on my.Organizations;

  entity Memberships       as projection on my.Memberships;

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
}

annotate OrganizationService.Organizations with @odata.draft.enabled;
annotate OrganizationService.CompanySettings with @odata.draft.enabled;
