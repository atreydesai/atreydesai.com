// Type declarations for YAML files imported via @rollup/plugin-yaml
// Plugin generates both default export (entire data) and named exports for top-level properties

declare module '*.yaml' {
    const content: Record<string, unknown>;
    export default content;
    // Named exports for top-level YAML properties are available at runtime
    // Use: import { propertyName } from './file.yaml'
}

declare module '*.yml' {
    const content: Record<string, unknown>;
    export default content;
    // Named exports for top-level YAML properties are available at runtime
    // Use: import { propertyName } from './file.yml'
}
