const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/**
 * Ambiente padrao: node (regra de negocio e handlers de API).
 * Para testar componente, coloque no topo do arquivo de teste:
 *
 *   \/**
 *    * @jest-environment jsdom
 *    *\/
 *
 * @testing-library/react e jest-dom ja estao instalados.
 */
module.exports = createJestConfig({
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
});
