let nowTS = Date.now() / 1000;

export const emptySession = {
  authentication: {
    user: {
      id: '0',
      name: 'Unauthenticated User',
      email: 'unauthenticated_user@unknown.com',
      active: false,
      locked: true,
      version: 1,
      linked_users: [],
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
    token_expiration: 0
  },
  acting: {
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

export const emptyActing = {
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

export const exampleActing = {
  id: '67711880',
  name: "Kevin's Fast Company",
  active: true,
  version: 1001,
  accessible_locations: [
    "defender-us-denver",
    "insight-us-virginia"
  ],
  default_location: 'defender-us-denver',
  created: {
    at: 123456789,
    by: 'McNielsen',
  },
  modified: {
    at: 123456790,
    by: 'Warsaw',
  }
};

export const exampleSession = {
  authentication: {
    user: {
      id: '1111000011110000',
      name: 'Mister McNielsen',
      email: 'mcnielsen@alertlogic.com',
      active: true,
      locked: false,
      version: 1002,
      linked_users: [],
      created: {
        at: 123456789,
        by: 'McNielsen',
      },
      modified: {
        at: 123456790,
        by: 'Warsaw',
      }
    },
    account: {
      id: '67108880',
      name: "Kevin's Fast Company",
      active: true,
      accessible_locations: [
        "defender-us-denver",
        "insight-us-virginia"
      ],
      default_location: 'defender-us-denver',
      created: {
        at: 123456789,
        by: 'McNielsen',
      },
      modified: {
        at: 123456790,
        by: 'Warsaw',
      }
    },
    token: 'BigFatFakeToken',
    token_expiration: nowTS + 86400,
  }
};
