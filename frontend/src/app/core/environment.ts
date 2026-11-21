/** Konfiguracja czasu wykonania. */
export const environment = {
  apiBase: '/api/v1',
  /** true → dane z fixtures (bez backendu); false → prawdziwe API przez proxy /api. */
  useMock: false,
  /** Tokeny demo backendu (docs/implementation/backend.md §6), po jednym na rolę. */
  roleTokens: {
    analyst: 'demo-analyst',
    expert: 'demo-expert',
    operator: 'demo-operator',
  },
};
