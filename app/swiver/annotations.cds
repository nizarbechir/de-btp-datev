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

// ---------------------------------------------------------------------------
// Sales invoices
// ---------------------------------------------------------------------------

annotate service.SalesInvoices with @(
  UI.HeaderInfo                  : {
    TypeName      : '{i18n>SalesInvoice}',
    TypeNamePlural: '{i18n>SalesInvoices}',
    Title         : {Value: invoiceNumber},
    Description   : {Value: customer.displayName},
    TypeImageUrl  : 'sap-icon://sales-document'
  },
  UI.SelectionFields             : [
    customer_ID,
    status_code,
    invoiceDate,
    dueDate
  ],
  UI.LineItem                    : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.markAsSent',
      Label : '{i18n>MarkAsSent}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.markAsPaid',
      Label : '{i18n>MarkPaid}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.duplicate',
      Label : '{i18n>Duplicate}'
    },
    {
      Value         : invoiceNumber,
      @UI.Importance: #High
    },
    {
      Value         : customer_ID,
      @UI.Importance: #High
    },
    {Value: invoiceDate},
    {Value: dueDate},
    {
      Value         : grossAmount,
      @UI.Importance: #High
    },
    {
      Value         : displayStatus,
      Criticality   : displayStatusCriticality,
      @UI.Importance: #High
    }
  ],
  UI.PresentationVariant         : {
    SortOrder     : [{
      Property  : invoiceDate,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.SelectionVariant #All       : {
    Text         : '{i18n>All}',
    SelectOptions: []
  },
  UI.SelectionVariant #Draft     : {
    Text         : '{i18n>Draft}',
    SelectOptions: [{
      PropertyName: status_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'DRAFT'
      }]
    }]
  },
  UI.SelectionVariant #Sent      : {
    Text         : '{i18n>OpenSent}',
    SelectOptions: [{
      PropertyName: status_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'SENT'
      }]
    }]
  },
  UI.SelectionVariant #Overdue   : {
    Text         : '{i18n>Overdue}',
    SelectOptions: [{
      PropertyName: isOverdue,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : true
      }]
    }]
  },
  UI.SelectionVariant #Paid      : {
    Text         : '{i18n>Paid}',
    SelectOptions: [{
      PropertyName: status_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'PAID'
      }]
    }]
  },
  // Object page: the invoice editor. Only the actions that fit the current status are shown.
  UI.Identification              : [
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'FinanceService.markAsSent',
      Label        : '{i18n>MarkAsSent}',
      Criticality  : #Positive,
      @UI.Hidden: {$edmJson: {$Not: {$And: [
          {$Eq: [
            {$Path: 'status_code'},
            'DRAFT'
          ]},
          {$Path: 'IsActiveEntity'}
        ]}}}
    },
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'FinanceService.markAsPaid',
      Label        : '{i18n>MarkPaid}',
      Criticality  : #Positive,
      @UI.Hidden: {$edmJson: {$Not: {$And: [
          {$Eq: [
            {$Path: 'status_code'},
            'SENT'
          ]},
          {$Path: 'IsActiveEntity'}
        ]}}}
    },
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'FinanceService.reopen',
      Label        : '{i18n>Reopen}',
      @UI.Hidden: {$edmJson: {$Not: {$And: [
          {$Or: [
            {$Eq: [
              {$Path: 'status_code'},
              'PAID'
            ]},
            {$Eq: [
              {$Path: 'status_code'},
              'CANCELLED'
            ]}
          ]},
          {$Path: 'IsActiveEntity'}
        ]}}}
    },
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'FinanceService.cancelInvoice',
      Label        : '{i18n>CancelInvoice}',
      @UI.Hidden: {$edmJson: {$Not: {$And: [
          {$Or: [
            {$Eq: [
              {$Path: 'status_code'},
              'DRAFT'
            ]},
            {$Eq: [
              {$Path: 'status_code'},
              'SENT'
            ]}
          ]},
          {$Path: 'IsActiveEntity'}
        ]}}}
    }
  ],
  UI.DataPoint #grossAmount      : {
    Value: grossAmount,
    Title: '{i18n>Total}'
  },
  UI.DataPoint #status           : {
    Value      : displayStatus,
    Title      : '{i18n>Status}',
    Criticality: displayStatusCriticality
  },
  UI.DataPoint #dueDate          : {
    Value: dueDate,
    Title: '{i18n>DueDate}'
  },
  UI.HeaderFacets                : [
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
  UI.FieldGroup #Invoice         : {Data: [
    {Value: customer_ID},
    {
      $Type        : 'UI.DataFieldForAction',
      Action       : 'FinanceService.createCustomer',
      Label        : '{i18n>NewCustomer}',
      @UI.Hidden: {$edmJson: {$Path: 'IsActiveEntity'}}
    },
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: currency_code},
    {Value: subject},
    {
      Value        : paymentDate,
      @UI.Hidden: {$edmJson: {$Ne: [
        {$Path: 'status_code'},
        'PAID'
      ]}}
    }
  ]},
  UI.FieldGroup #Texts           : {Data: [
    {Value: introductionText},
    {Value: footerText},
    {Value: notes}
  ]},
  UI.Facets                      : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Invoice',
      Label : '{i18n>InvoiceDetails}',
      Target: '@UI.FieldGroup#Invoice'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Items',
      Label : '{i18n>Items}',
      Target: 'items/@UI.PresentationVariant'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Texts',
      Label : '{i18n>Texts}',
      Target: '@UI.FieldGroup#Texts'
    }
  ],
  // Recalculate while editing: items and totals, the due date, and the customer shown in the header
  Common.SideEffects #Items      : {
    SourceEntities  : [items],
    SourceProperties: [
      items.quantity,
      items.unitPrice,
      items.taxRate
    ],
    TargetProperties: [
      'netAmount',
      'taxAmount',
      'grossAmount'
    ],
    TargetEntities  : [
      items,
      taxes
    ]
  },
  Common.SideEffects #InvoiceDate: {
    SourceProperties: [invoiceDate],
    TargetProperties: [
      'dueDate',
      'displayStatus',
      'displayStatusCriticality'
    ]
  },
  Common.SideEffects #DueDate    : {
    SourceProperties: [dueDate],
    TargetProperties: [
      'displayStatus',
      'displayStatusCriticality'
    ]
  },
  Common.SideEffects #Customer   : {
    SourceProperties: [customer_ID],
    TargetEntities  : [customer]
  },
  // Dashboard: invoices customers still have to pay, oldest due date first
  UI.LineItem #Receivables       : [
    {Value: customer_ID},
    {Value: invoiceNumber},
    {Value: dueDate},
    {Value: grossAmount},
    {
      Value      : displayStatus,
      Criticality: displayStatusCriticality
    }
  ],
  UI.SelectionPresentationVariant #Receivables: {
    SelectionVariant   : {SelectOptions: [{
      PropertyName: status_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'SENT'
      }]
    }]},
    PresentationVariant: {
      SortOrder     : [{
        Property  : dueDate,
        Descending: false
      }],
      Visualizations: ['@UI.LineItem#Receivables']
    }
  },
  // Invoices table on the customer page
  UI.LineItem #Customer          : [
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: grossAmount},
    {
      Value      : displayStatus,
      Criticality: displayStatusCriticality
    }
  ]
);

annotate service.SalesInvoices with {
  customer @(
    Common.Text           : customer.displayName,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath : 'Customers',
      SearchSupported: true,
      Parameters     : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: customer_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'displayName'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'customerNumber'
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
  status   @(
    Common.Text                    : status.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
  currency @Common.ValueListWithFixedValues: false;
};

annotate service.SalesInvoices actions {
  markAsSent     @(
    Core.OperationAvailable: {$edmJson: {$And: [
      {$Eq: [
        {$Path: 'in/status_code'},
        'DRAFT'
      ]},
      {$Path: 'in/IsActiveEntity'}
    ]}},
    Common.SideEffects     : {TargetProperties: [
      'in/status_code',
      'in/displayStatus',
      'in/displayStatusCriticality',
      'in/isEditable',
      'in/isClosed'
    ]}
  );
  markAsPaid     @(
    Core.OperationAvailable: {$edmJson: {$And: [
      {$Eq: [
        {$Path: 'in/status_code'},
        'SENT'
      ]},
      {$Path: 'in/IsActiveEntity'}
    ]}},
    Common.SideEffects     : {TargetProperties: [
      'in/status_code',
      'in/paymentDate',
      'in/displayStatus',
      'in/displayStatusCriticality',
      'in/isEditable',
      'in/isClosed'
    ]}
  );
  cancelInvoice  @(
    Core.OperationAvailable: {$edmJson: {$And: [
      {$Or: [
        {$Eq: [
          {$Path: 'in/status_code'},
          'DRAFT'
        ]},
        {$Eq: [
          {$Path: 'in/status_code'},
          'SENT'
        ]}
      ]},
      {$Path: 'in/IsActiveEntity'}
    ]}},
    Common.IsActionCritical: true,
    Common.SideEffects     : {TargetProperties: [
      'in/status_code',
      'in/displayStatus',
      'in/displayStatusCriticality',
      'in/isEditable',
      'in/isClosed'
    ]}
  );
  reopen         @(
    Core.OperationAvailable: {$edmJson: {$And: [
      {$Or: [
        {$Eq: [
          {$Path: 'in/status_code'},
          'PAID'
        ]},
        {$Eq: [
          {$Path: 'in/status_code'},
          'CANCELLED'
        ]}
      ]},
      {$Path: 'in/IsActiveEntity'}
    ]}},
    Common.SideEffects     : {TargetProperties: [
      'in/status_code',
      'in/paymentDate',
      'in/displayStatus',
      'in/displayStatusCriticality',
      'in/isEditable',
      'in/isClosed'
    ]}
  );
  duplicate      @(Core.OperationAvailable: {$edmJson: {$Path: 'in/IsActiveEntity'}});
  createCustomer @(
    Core.OperationAvailable: {$edmJson: {$Not: {$Path: 'in/IsActiveEntity'}}},
    Common.SideEffects     : {
      TargetProperties: ['in/customer_ID'],
      TargetEntities  : ['in/customer']
    }
  )(
    country @(
      UI.ParameterDefaultValue: 'DE',
      Common.ValueListWithFixedValues,
      Common.ValueList        : {
        CollectionPath: 'Countries',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: country,
            ValueListProperty: 'code'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name'
          }
        ]
      }
    )
  );
};

// Invoice items: an editable table with the amounts calculated by the backend
annotate service.SalesInvoiceItems with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>Item}',
    TypeNamePlural: '{i18n>Items}',
    Title         : {Value: description}
  },
  UI.LineItem           : [
    {
      Value                : description,
      @UI.Importance       : #High,
      @HTML5.CssDefaults   : {width: '24rem'}
    },
    {
      Value                : quantity,
      @UI.Importance       : #High,
      @HTML5.CssDefaults   : {width: '6rem'}
    },
    {
      Value                : unit,
      @HTML5.CssDefaults   : {width: '7rem'}
    },
    {
      Value                : unitPrice,
      @UI.Importance       : #High,
      @HTML5.CssDefaults   : {width: '9rem'}
    },
    {
      Value                : taxRate,
      @HTML5.CssDefaults   : {width: '6rem'}
    },
    {
      Value                : netAmount,
      @HTML5.CssDefaults   : {width: '9rem'}
    },
    {
      Value                : grossAmount,
      @UI.Importance       : #High,
      @HTML5.CssDefaults   : {width: '9rem'}
    }
  ],
  UI.PresentationVariant: {
    SortOrder     : [{Property: position}],
    Visualizations: ['@UI.LineItem']
  }
);

annotate service.SalesInvoiceItems with {
  unit @Common.ValueList: {
    CollectionPath: 'Units',
    Parameters    : [{
      $Type            : 'Common.ValueListParameterInOut',
      LocalDataProperty: unit,
      ValueListProperty: 'code'
    }]
  };
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

annotate service.Customers with @(
  UI.HeaderInfo              : {
    TypeName      : '{i18n>Customer}',
    TypeNamePlural: '{i18n>Customers}',
    Title         : {Value: displayName},
    Description   : {Value: customerNumber},
    TypeImageUrl  : 'sap-icon://customer'
  },
  UI.SelectionFields         : [
    active,
    city,
    country_code
  ],
  UI.LineItem                : [
    {
      Value         : displayName,
      @UI.Importance: #High
    },
    {Value: customerNumber},
    {Value: name},
    {Value: city},
    {Value: email},
    {
      Value         : balance.outstanding,
      @UI.Importance: #High
    },
    {
      Value         : active,
      @UI.Importance: #High
    }
  ],
  UI.PresentationVariant     : {
    SortOrder     : [{Property: displayName}],
    Visualizations: ['@UI.LineItem']
  },
  UI.DataPoint #totalInvoiced: {
    Value: balance.totalInvoiced,
    Title: '{i18n>TotalInvoiced}'
  },
  UI.DataPoint #outstanding  : {
    Value: balance.outstanding,
    Title: '{i18n>Outstanding}'
  },
  UI.DataPoint #overdue      : {
    Value      : balance.overdue,
    Title      : '{i18n>Overdue}',
    Criticality: #Negative
  },
  UI.HeaderFacets            : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#totalInvoiced'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#outstanding'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#overdue'
    }
  ],
  UI.FieldGroup #General     : {Data: [
    {Value: companyName},
    {Value: name},
    {Value: customerNumber},
    {Value: active}
  ]},
  UI.FieldGroup #Contact     : {Data: [
    {Value: email},
    {Value: phone},
    {Value: street},
    {Value: postalCode},
    {Value: city},
    {Value: country_code}
  ]},
  UI.FieldGroup #Tax         : {Data: [
    {Value: taxNumber},
    {Value: vatId}
  ]},
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
          ID    : 'Tax',
          Label : '{i18n>TaxDetails}',
          Target: '@UI.FieldGroup#Tax'
        }
      ]
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Invoices',
      Label : '{i18n>SalesInvoices}',
      Target: 'invoices/@UI.LineItem#Customer'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Notes',
      Label : '{i18n>Notes}',
      Target: '@UI.FieldGroup#Notes'
    }
  ],
  Common.SideEffects #Name   : {
    SourceProperties: [
      companyName,
      name
    ],
    TargetProperties: ['displayName']
  }
);

annotate service.Customers with {
  country @(
    Common.Text                    : country.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

// ---------------------------------------------------------------------------
// Company settings
// ---------------------------------------------------------------------------

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
    {Value: invoicePrefix}
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
