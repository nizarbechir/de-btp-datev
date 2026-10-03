using {
  cuid,
  managed
} from '@sap/cds/common';
using {swiver.CompanySettings} from './settings';

namespace swiver;

/**
 * A company or freelancer using Swiver. All business data belongs to exactly one organization,
 * and users only ever see the data of the organizations they are a member of.
 */
entity Organizations : cuid, managed {
  name     : String(120) @mandatory;
  slug     : String(60);
  status   : String(10) enum {
    active    = 'ACTIVE';
    suspended = 'SUSPENDED';
  } default 'ACTIVE';
  members  : Composition of many Memberships
               on members.organization = $self;
  settings : Association to CompanySettings
               on settings.organization = $self;
}

// TODO(feature): granular permissions
// TODO(feature): accountant/read-only roles
type MembershipRole : String(10) enum {
  owner  = 'OWNER';
  admin  = 'ADMIN';
  member = 'MEMBER';
};

/**
 * Links a signed-in user (the user ID of the identity provider) to an organization.
 */
entity Memberships : cuid, managed {
  organization : Association to Organizations;
  userId       : String(255) @mandatory;
  role         : MembershipRole @mandatory default 'MEMBER'  @assert.range;
}

/**
 * Root business records belong to one organization. The backend sets it from the signed-in
 * user's organization; it is never taken from the request.
 */
aspect OrganizationOwned {
  organization : Association to Organizations;
}

/** The roles offered when adding a member. */
entity MembershipRoles {
  key code : MembershipRole;
      name : localized String(40);
}
