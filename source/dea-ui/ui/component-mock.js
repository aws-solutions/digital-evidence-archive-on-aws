import kebabCase from 'lodash.kebabcase';

const Components = jest.requireActual('@cloudscape-design/components');
for (const mockComponentName of Object.keys(Components)) {
  jest.mock(
    `@cloudscape-design/components/${kebabCase(mockComponentName).replace('s-3', 's3')}`,
    () => mockComponentName
  );
}
