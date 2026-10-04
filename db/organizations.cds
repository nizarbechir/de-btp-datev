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
  settings    : Association to CompanySettings
                  on settings.organization = $self;
  invitations : Association to many Invitations
                  on invitations.organization = $self;
}

// TAX_ADVISOR: an external Steuerberater with read access, export and comments.
// TODO(feature): granular/custom permissions
// TODO(feature): dedicated accountant permission profiles
type MembershipRole : String(12) enum {
  owner      = 'OWNER';
  admin      = 'ADMIN';
  member     = 'MEMBER';
  taxAdvisor = 'TAX_ADVISOR';
};

/**
 * Links a signed-in user (the user ID of the identity provider) to an organization.
 */
entity Memberships : cuid, managed {
  organization : Association to Organizations;
  userId       : String(255) @mandatory;
  role         : MembershipRole @mandatory default 'MEMBER'  @assert.range;
  // The organization a user with several memberships last switched to; used when no header picks one.
  lastUsedAt   : Timestamp;
}

/**
 * An invitation to join an organization, sent by e-mail. Only the SHA-256 hash of the token is
 * stored; the membership is created when the invited user accepts.
 */
entity Invitations : cuid, managed, OrganizationOwned {
  email      : String(255) @mandatory;
  role       : MembershipRole @mandatory default 'TAX_ADVISOR'  @assert.range;
  tokenHash  : String(64);
  status     : String(10) enum {
    pending  = 'PENDING';
    accepted = 'ACCEPTED';
    expired  = 'EXPIRED';
    revoked  = 'REVOKED';
  } default 'PENDING';
  expiresAt  : Timestamp;
  invitedBy  : String(255);
  acceptedBy : String(255);
  acceptedAt : Timestamp;
  // Pending invitations past their expiry count as expired.
  state      : String(10) = (case
                               when status = 'PENDING' and expiresAt < current_timestamp
                               then 'EXPIRED'
                               else status
                             end);
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
