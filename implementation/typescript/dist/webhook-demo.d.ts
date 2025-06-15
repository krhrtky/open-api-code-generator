#!/usr/bin/env node
/**
 * Webhook Demo for Issue #3 Implementation
 * Demonstrates external reference support and webhook functionality
 */
declare module './parser' {
    interface OpenAPIParser {
        parseString(content: string): Promise<any>;
    }
}
declare module './generator' {
    interface OpenAPICodeGenerator {
        generateFromString(content: string): Promise<any>;
    }
}
export {};
