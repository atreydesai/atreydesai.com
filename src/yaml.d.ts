// YAML files imported via @rollup/plugin-yaml. The plugin also emits a named
// export per top-level key, e.g. `import { propertyName } from './file.yaml'`.

declare module '*.yaml' {
    const content: Record<string, unknown>;
    export default content;
}
