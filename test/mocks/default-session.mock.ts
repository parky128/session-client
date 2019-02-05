export const defaultSession = {
  authentication: {
    user: {
      id: '0',
      name: 'Unauthenticated User',
      email: 'unauthenticated_user@unknown.com',
      active: false,
      locked: true,
      version: 1,
      created: {
        at: 0,
        by: '',
      },
      modified: {
        at: 0,
        by: '',
      },
    },
    account: {
      id: '0',
      name: 'Unknown Company',
      active: false,
      accessible_locations: [],
      default_location: '',
      created: {
        at: 0,
        by: '',
      },
      modified: {
        at: 0,
        by: '',
      },
    },
    token: '',
    token_expiration: 0,
  },
  active: {
    id: '0',
    name: 'Unknown Company',
    active: false,
    version: 1,
    accessible_locations: [],
    default_location: '',
    created: {
      at: 0,
      by: '',
    },
    modified: {
      at: 0,
      by: '',
    },
  },
};

export const defaultActive = {
  id: '0',
  name: 'Unknown Company',
  active: false,
  version: 1,
  accessible_locations: [],
  default_location: '',
  created: {
    at: 0,
    by: '',
  },
  modified: {
    at: 0,
    by: '',
  },
};
