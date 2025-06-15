declare global {
    namespace jest {
        interface Matchers<R> {
            toContainValidKotlinClass(): R;
            toHaveValidPackageDeclaration(): R;
            toContainRequiredImports(): R;
        }
    }
}
export declare const testUtils: {
    /**
     * Extract class name from Kotlin file content
     */
    extractClassName(content: string): string | null;
    /**
     * Extract all property names from Kotlin data class
     */
    extractPropertyNames(content: string): string[];
    /**
     * Check if content contains specific annotation
     */
    hasAnnotation(content: string, annotation: string): boolean;
    /**
     * Validate Kotlin syntax basics
     */
    validateKotlinSyntax(content: string): {
        valid: boolean;
        errors: string[];
    };
};
