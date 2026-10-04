using SupportService as service from '../../srv/services';

// Support: customers see the tickets of their organization, support agents those of all
// organizations (with the organization column and filter). Field labels: srv/services/labels.cds.

annotate service.SupportTickets with @(
  // Sent tickets are not edited; the conversation continues with Reply.
  UI.UpdateHidden       : true,
  UI.DeleteHidden       : true,
  UI.HeaderInfo         : {
    TypeName      : '{i18n>SupportTicket}',
    TypeNamePlural: '{i18n>SupportTickets}',
    Title         : {Value: subject},
    Description   : {Value: ticketNumber}
  },
  UI.SelectionFields    : [
    status_code,
    priority_code,
    category_code,
    organizationName
  ],
  UI.LineItem           : [
    {Value: ticketNumber},
    {Value: subject},
    {Value: organizationName},
    {Value: category_code},
    {Value: priority_code},
    {
      Value      : status_code,
      Criticality: status.criticality
    },
    {Value: createdAt},
    {Value: modifiedAt}
  ],
  UI.PresentationVariant: {SortOrder: [{
    Property  : modifiedAt,
    Descending: true
  }]},
  UI.Identification     : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SupportService.reply',
      Label : '{i18n>Reply}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'SupportService.setStatus',
      Label : '{i18n>ChangeStatus}'
    }
  ],
  UI.HeaderFacets       : [{
    $Type : 'UI.ReferenceFacet',
    ID    : 'Status',
    Target: '@UI.FieldGroup#Status',
    @UI.Hidden: {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}}
  }],
  UI.FieldGroup #Status : {Data: [
    {
      Value      : status_code,
      Criticality: status.criticality
    },
    {Value: organizationName},
    {Value: createdBy},
    {Value: createdAt},
    {Value: modifiedAt},
    {Value: resolvedAt}
  ]},
  UI.FieldGroup #Request: {Data: [
    {Value: subject},
    {Value: category_code},
    {Value: priority_code},
    {Value: description}
  ]},
  UI.Facets             : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Request',
      Label : '{i18n>Details}',
      Target: '@UI.FieldGroup#Request'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Conversation',
      Label : '{i18n>Conversation}',
      Target: 'messages/@UI.LineItem',
      @UI.Hidden: {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}}
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Attachments',
      Label : '{i18n>Attachments}',
      Target: 'attachments/@UI.LineItem'
    }
  ]
) {
  organizationName @title: '{i18n>Organization}'  @readonly;
  canManage        @UI.Hidden;
};

annotate service.SupportTickets actions {
  reply     @Core.OperationAvailable: {$edmJson: {$And: [
    {$Path: 'in/IsActiveEntity'},
    {$Ne: [
      {$Path: 'in/status_code'},
      'CLOSED'
    ]}
  ]}};
  setStatus @Core.OperationAvailable: {$edmJson: {$And: [
    {$Path: 'in/IsActiveEntity'},
    {$Path: 'in/canManage'}
  ]}};
};

annotate service.SupportMessages with @(
  UI.LineItem           : [
    {Value: createdAt},
    {Value: createdBy},
    {Value: fromSupport},
    {Value: message}
  ],
  UI.PresentationVariant: {SortOrder: [{Property: createdAt}]}
);

annotate service.SupportAttachments with @(UI.LineItem: [
  {Value: fileName},
  {Value: content}
]);
