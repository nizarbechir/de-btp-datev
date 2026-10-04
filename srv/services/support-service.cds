using {swiver as my} from '../../db/support';

/**
 * Support tickets: customers create and follow the tickets of their organization, support agents
 * (role SupportAgent) answer the tickets of all organizations. Access rules: srv/authorization.
 */
service SupportService @(path: '/odata/v4/support') {
  entity SupportTickets     as
    projection on my.SupportTickets {
      *,
      organization.name as organizationName : String(120),
      // True for support agents; shows the status action.
      virtual null      as canManage        : Boolean
    }
    actions {
      @title: '{i18n>Reply}'
      action reply(message : String(5000) @title: '{i18n>Message}' @UI.MultiLineText @mandatory) returns SupportTickets;

      @title: '{i18n>ChangeStatus}'
      action setStatus(status : String(25) @title: '{i18n>Status}' @mandatory @Common.ValueListWithFixedValues @Common.ValueList: {
        CollectionPath: 'SupportStatuses',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: status,
            ValueListProperty: 'code'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name'
          }
        ]
      })                                                                                              returns SupportTickets;
    };

  @readonly
  entity SupportMessages    as projection on my.SupportMessages;

  entity SupportAttachments as projection on my.SupportAttachments;
  entity SupportStatuses    as projection on my.SupportStatuses;
  entity SupportCategories  as projection on my.SupportCategories;
  entity SupportPriorities  as projection on my.SupportPriorities;
}

// Tickets are created as drafts (subject, description, attachments) and cannot be edited once sent.
annotate SupportService.SupportTickets with @odata.draft.enabled;
