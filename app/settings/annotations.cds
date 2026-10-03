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
    {Value: quotePrefix}
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
  country         @(
    Common.Text                    : country.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
  defaultCurrency @Common.ValueListWithFixedValues: false;
};

// ---------------------------------------------------------------------------
// Organization and members
// ---------------------------------------------------------------------------

annotate service.Organizations with @(
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
    {Value: status}
  ],
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
    }
  ]
);

annotate service.Memberships with @(
  UI.HeaderInfo: {
    TypeName      : '{i18n>Member}',
    TypeNamePlural: '{i18n>Members}',
    Title         : {Value: userId}
  },
  UI.LineItem  : [
    {Value: userId},
    {Value: role}
  ]
);

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
