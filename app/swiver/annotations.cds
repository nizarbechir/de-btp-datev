using FinanceService as service from '../../srv/services';

// ---------------------------------------------------------------------------
// Supplier invoices
// ---------------------------------------------------------------------------

annotate service.SupplierInvoices with @(
  UI.HeaderInfo             : {
    TypeName      : '{i18n>SupplierInvoice}',
    TypeNamePlural: '{i18n>SupplierInvoices}',
    Title         : {Value: invoiceNumber},
    Description   : {Value: supplier.name},
    TypeImageUrl  : 'sap-icon://receipt'
  },
  UI.SelectionFields        : [
    supplier_ID,
    paymentStatus_code,
    invoiceDate,
    dueDate
  ],
  UI.LineItem               : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.markInvoicePaid',
      Label : '{i18n>MarkPaid}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.markInvoiceOpen',
      Label : '{i18n>MarkOpen}'
    },
    {Value: supplier_ID},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: grossAmount},
    {
      Value      : status,
      Criticality: statusCriticality
    }
  ],
  UI.PresentationVariant    : {
    SortOrder     : [{
      Property  : dueDate,
      Descending: false
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.SelectionVariant #All  : {
    Text         : '{i18n>All}',
    SelectOptions: []
  },
  UI.SelectionVariant #Open : {
    Text         : '{i18n>Open}',
    SelectOptions: [{
      PropertyName: status,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'Open'
      }]
    }]
  },
  UI.SelectionVariant #Overdue: {
    Text         : '{i18n>Overdue}',
    SelectOptions: [{
      PropertyName: status,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'Overdue'
      }]
    }]
  },
  UI.SelectionVariant #Paid : {
    Text         : '{i18n>Paid}',
    SelectOptions: [{
      PropertyName: status,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'Paid'
      }]
    }]
  },
  // Header and actions of the invoice detail page
  UI.Identification         : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.markInvoicePaid',
      Label : '{i18n>MarkPaid}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.markInvoiceOpen',
      Label : '{i18n>MarkOpen}'
    }
  ],
  UI.DataPoint #grossAmount : {
    Value: grossAmount,
    Title: '{i18n>GrossAmount}'
  },
  UI.DataPoint #status      : {
    Value      : status,
    Title      : '{i18n>Status}',
    Criticality: statusCriticality
  },
  UI.DataPoint #dueDate     : {
    Value: dueDate,
    Title: '{i18n>DueDate}'
  },
  UI.HeaderFacets           : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#grossAmount'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#status'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#dueDate'
    }
  ],
  UI.FieldGroup #General    : {Data: [
    {Value: supplier_ID},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: dueDate}
  ]},
  UI.FieldGroup #Amounts    : {Data: [
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount},
    {Value: currency_code}
  ]},
  UI.FieldGroup #Payment    : {Data: [
    {
      Value      : status,
      Criticality: statusCriticality
    },
    {Value: paymentDate}
  ]},
  UI.FieldGroup #Document   : {Data: [{Value: documentContent}]},
  UI.FieldGroup #Notes      : {Data: [{Value: notes}]},
  UI.Facets                 : [
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Details',
      Label : '{i18n>General}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'General',
          Label : '{i18n>General}',
          Target: '@UI.FieldGroup#General'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Amounts',
          Label : '{i18n>Amounts}',
          Target: '@UI.FieldGroup#Amounts'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Payment',
          Label : '{i18n>Payment}',
          Target: '@UI.FieldGroup#Payment'
        }
      ]
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Document',
      Label : '{i18n>Document}',
      Target: '@UI.FieldGroup#Document'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Notes',
      Label : '{i18n>Notes}',
      Target: '@UI.FieldGroup#Notes'
    }
  ],
  // Recalculate gross amount and status while editing
  Common.SideEffects #Amounts: {
    SourceProperties: [
      netAmount,
      taxAmount
    ],
    TargetProperties: ['grossAmount']
  },
  Common.SideEffects #Status : {
    SourceProperties: [dueDate],
    TargetProperties: [
      'status',
      'statusCriticality'
    ]
  },
  // Dashboard: unpaid invoices ordered by due date
  UI.LineItem #Upcoming     : [
    {Value: supplier_ID},
    {Value: invoiceNumber},
    {Value: dueDate},
    {Value: grossAmount},
    {
      Value      : status,
      Criticality: statusCriticality
    }
  ],
  UI.SelectionPresentationVariant #Upcoming: {
    SelectionVariant   : {SelectOptions: [{
      PropertyName: paymentStatus_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'OPEN'
      }]
    }]},
    PresentationVariant: {
      SortOrder     : [{
        Property  : dueDate,
        Descending: false
      }],
      Visualizations: ['@UI.LineItem#Upcoming']
    }
  }
);

annotate service.SupplierInvoices with {
  supplier      @(
    Common.Text           : supplier.name,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath: 'Suppliers',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: supplier_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'name'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'city'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'active',
          Constant         : true
        }
      ]
    }
  );
  paymentStatus @(
    Common.Text                    : paymentStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

annotate service.SupplierInvoices actions {
  markInvoicePaid @(
    // Only on saved invoices, not while editing
    Core.OperationAvailable: {$edmJson: {$And: [
      {$Ne: [{$Path: 'in/paymentStatus_code'}, 'PAID']},
      {$Path: 'in/IsActiveEntity'}
    ]}},
    Common.SideEffects     : {TargetProperties: [
      'in/paymentStatus_code',
      'in/paymentDate',
      'in/status',
      'in/statusCriticality'
    ]}
  );
  markInvoiceOpen @(
    Core.OperationAvailable: {$edmJson: {$And: [
      {$Eq: [{$Path: 'in/paymentStatus_code'}, 'PAID']},
      {$Path: 'in/IsActiveEntity'}
    ]}},
    Common.SideEffects     : {TargetProperties: [
      'in/paymentStatus_code',
      'in/paymentDate',
      'in/status',
      'in/statusCriticality'
    ]}
  );
};

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

annotate service.Suppliers with @(
  UI.HeaderInfo              : {
    TypeName      : '{i18n>Supplier}',
    TypeNamePlural: '{i18n>Suppliers}',
    Title         : {Value: name},
    Description   : {Value: supplierNumber},
    TypeImageUrl  : 'sap-icon://supplier'
  },
  UI.SelectionFields         : [
    active,
    city,
    country_code
  ],
  UI.LineItem                : [
    {
      Value         : name,
      @UI.Importance: #High
    },
    {Value: supplierNumber},
    {Value: city},
    {Value: country_code},
    {Value: email},
    {Value: phone},
    {
      Value         : balance.openAmount,
      @UI.Importance: #High
    },
    {
      Value         : active,
      @UI.Importance: #High
    }
  ],
  UI.PresentationVariant     : {
    SortOrder     : [{Property: name}],
    Visualizations: ['@UI.LineItem']
  },
  UI.DataPoint #invoiceCount : {
    Value: balance.invoiceCount,
    Title: '{i18n>InvoiceCount}'
  },
  UI.DataPoint #openAmount   : {
    Value: balance.openAmount,
    Title: '{i18n>OpenAmount}'
  },
  UI.HeaderFacets            : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#invoiceCount'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#openAmount'
    }
  ],
  UI.FieldGroup #General     : {Data: [
    {Value: name},
    {Value: supplierNumber},
    {Value: taxNumber},
    {Value: active}
  ]},
  UI.FieldGroup #Contact     : {Data: [
    {Value: email},
    {Value: phone},
    {Value: address},
    {Value: postalCode},
    {Value: city},
    {Value: country_code}
  ]},
  UI.FieldGroup #BankDetails : {Data: [{Value: iban}]},
  UI.FieldGroup #Notes       : {Data: [{Value: notes}]},
  UI.Facets                  : [
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Details',
      Label : '{i18n>General}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'General',
          Label : '{i18n>General}',
          Target: '@UI.FieldGroup#General'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Contact',
          Label : '{i18n>Contact}',
          Target: '@UI.FieldGroup#Contact'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'BankDetails',
          Label : '{i18n>BankDetails}',
          Target: '@UI.FieldGroup#BankDetails'
        }
      ]
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Invoices',
      Label : '{i18n>SupplierInvoices}',
      Target: 'invoices/@UI.LineItem#SupplierInvoices'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Notes',
      Label : '{i18n>Notes}',
      Target: '@UI.FieldGroup#Notes'
    }
  ]
);

annotate service.Suppliers with {
  country @(
    Common.Text                    : country.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

// Invoices table on the supplier detail page
annotate service.SupplierInvoices with @(
  UI.LineItem #SupplierInvoices: [
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: grossAmount},
    {
      Value      : status,
      Criticality: statusCriticality
    }
  ]
);
