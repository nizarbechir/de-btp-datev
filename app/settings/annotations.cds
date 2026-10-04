using OrganizationService as service from '../../srv/services';

annotate service.CompanySettings with @(
  UI.HeaderInfo          : {
    TypeName      : '{i18n>CompanySettings}',
    TypeNamePlural: '{i18n>CompanySettings}',
    Title         : {Value: companyName},
    Description   : {Value: '{i18n>CompanySettingsDescription}'},
    TypeImageUrl  : 'sap-icon://building'
  },
  UI.FieldGroup #Company : {Data: [
    {Value: companyName},
    {Value: ownerName},
    {Value: street},
    {Value: postalCode},
    {Value: city},
    {Value: country_code}
  ]},
  UI.FieldGroup #Contact : {Data: [
    {Value: email},
    {Value: phone},
    {Value: website}
  ]},
  UI.FieldGroup #Tax     : {Data: [
    {Value: taxNumber},
    {Value: vatId}
  ]},
  UI.FieldGroup #Legal   : {Data: [
    {Value: managingDirectors},
    {Value: registerCourt},
    {Value: registerNumber}
  ]},
  UI.FieldGroup #Bank    : {Data: [
    {Value: bankName},
    {Value: iban},
    {Value: bic}
  ]},
  UI.FieldGroup #Defaults: {Data: [
    {Value: defaultCurrency_code},
    {Value: defaultTaxRate},
    {Value: defaultPaymentTermDays},
    {Value: invoicePrefix},
    {Value: quotePrefix},
    {Value: documentLanguage_code}
  ]},
  UI.FieldGroup #Logo    : {Data: [{Value: logo}]},
  UI.Facets              : [
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'CompanyDetails',
      Label : '{i18n>Company}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Company',
          Label : '{i18n>Company}',
          Target: '@UI.FieldGroup#Company'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Contact',
          Label : '{i18n>Contact}',
          Target: '@UI.FieldGroup#Contact'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Tax',
          Label : '{i18n>TaxDetails}',
          Target: '@UI.FieldGroup#Tax'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Legal',
          Label : '{i18n>LegalDetails}',
          Target: '@UI.FieldGroup#Legal'
        }
      ]
    },
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Invoicing',
      Label : '{i18n>Invoicing}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Bank',
          Label : '{i18n>BankDetails}',
          Target: '@UI.FieldGroup#Bank'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Defaults',
          Label : '{i18n>InvoiceDefaults}',
          Target: '@UI.FieldGroup#Defaults'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Logo',
          Label : '{i18n>Logo}',
          Target: '@UI.FieldGroup#Logo'
        }
      ]
    }
  ]
);

annotate service.CompanySettings with {
  country          @(
    Common.Text                    : country.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
  defaultCurrency  @Common.ValueListWithFixedValues: false;
  documentLanguage @(
    Common.Text                    : documentLanguage.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true,
    Common.ValueList               : {
      CollectionPath: 'DocumentLanguages',
      Parameters    : [{
        $Type            : 'Common.ValueListParameterInOut',
        LocalDataProperty: documentLanguage_code,
        ValueListProperty: 'code'
      }]
    }
  );
};

// ---------------------------------------------------------------------------
// Organization and members
// ---------------------------------------------------------------------------

annotate service.Organizations with @(
  // Only owners and admins edit, and only the organization they currently work in.
  UI.UpdateHidden       : readOnly,
  UI.HeaderInfo         : {
    TypeName      : '{i18n>Organization}',
    TypeNamePlural: '{i18n>Organizations}',
    Title         : {Value: name},
    Description   : {Value: slug},
    TypeImageUrl  : 'sap-icon://building'
  },
  UI.LineItem           : [
    {Value: name},
    {Value: slug},
    {Value: status},
    {Value: isCurrent},
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'OrganizationService.switchTo',
      Label : '{i18n>SwitchOrganization}',
      Inline: true
    }
  ],
  UI.Identification     : [{
    $Type : 'UI.DataFieldForAction',
    Action: 'OrganizationService.inviteMember',
    Label : '{i18n>InviteMember}'
  }],
  UI.FieldGroup #General: {Data: [
    {Value: name},
    {Value: slug},
    {Value: status}
  ]},
  UI.Facets             : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'General',
      Label : '{i18n>General}',
      Target: '@UI.FieldGroup#General'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Members',
      Label : '{i18n>Members}',
      Target: 'members/@UI.LineItem'
    },
    {
      $Type        : 'UI.ReferenceFacet',
      ID           : 'Invitations',
      Label        : '{i18n>Invitations}',
      Target       : 'invitations/@UI.LineItem',
      @UI.Hidden: readOnly
    },
    {
      $Type        : 'UI.ReferenceFacet',
      ID           : 'AuditLog',
      Label        : '{i18n>AuditLog}',
      Target       : 'auditLog/@UI.LineItem',
      @UI.Hidden: readOnly
    }
  ]
);

annotate service.Organizations actions {
  inviteMember @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Path: 'in/IsActiveEntity'}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {TargetEntities: ['in/invitations', 'in/auditLog']}
  )(role @(
    UI.ParameterDefaultValue       : 'TAX_ADVISOR',
    Common.ValueListWithFixedValues: true,
    Common.ValueList               : {
      CollectionPath: 'MembershipRoles',
      Parameters    : [{
        $Type            : 'Common.ValueListParameterInOut',
        LocalDataProperty: role,
        ValueListProperty: 'code'
      }]
    }
  ));
  switchTo     @(
    Core.OperationAvailable: {$edmJson: {$Not: {$Path: 'in/isCurrent'}}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
};

annotate service.Memberships with @(
  UI.HeaderInfo: {
    TypeName      : '{i18n>Member}',
    TypeNamePlural: '{i18n>Members}',
    Title         : {Value: userId}
  },
  UI.LineItem  : [
    {Value: userId},
    {Value: role},
    {Value: createdAt}
  ]
);

annotate service.Invitations with @(UI.LineItem: [
  {
    $Type : 'UI.DataFieldForAction',
    Action: 'OrganizationService.resend',
    Label : '{i18n>ResendInvitation}'
  },
  {
    $Type : 'UI.DataFieldForAction',
    Action: 'OrganizationService.revoke',
    Label : '{i18n>RevokeInvitation}'
  },
  {Value: email},
  {Value: role},
  {Value: state},
  {Value: expiresAt},
  {Value: invitedBy},
  {Value: acceptedAt}
]);

annotate service.Invitations actions {
  resend @(
    Core.OperationAvailable: {$edmJson: {$Or: [{$Eq: [{$Path: 'in/state'}, 'PENDING']}, {$Eq: [{$Path: 'in/state'}, 'EXPIRED']}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  revoke @(
    Core.OperationAvailable: {$edmJson: {$Eq: [{$Path: 'in/state'}, 'PENDING']}},
    Common.IsActionCritical: true,
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
};

annotate service.AuditLogEntries with @(UI.LineItem: [
  {Value: at},
  {Value: actor},
  {Value: action},
  {Value: targetType},
  {Value: details}
]);

annotate service.Memberships with {
  role @(
    Common.ValueListWithFixedValues: true,
    Common.ValueList               : {
      CollectionPath: 'MembershipRoles',
      Parameters    : [{
        $Type            : 'Common.ValueListParameterInOut',
        LocalDataProperty: role,
        ValueListProperty: 'code'
      }]
    }
  );
};
