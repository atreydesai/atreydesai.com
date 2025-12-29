// Type declarations for YAML files imported via @rollup/plugin-yaml

declare module '*.yaml' {
    const content: unknown;
    export default content;
}

declare module '*.yml' {
    const content: unknown;
    export default content;
}
